export const MAX_SOURCE_BYTES = 50 * 1024 * 1024;

const ANALYSIS_MAX_DIM = 2048;
const THUMB_MAX_DIM = 400;

interface Processed {
  analysis: Blob;
  thumb: Blob;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("decode-failed"));
    img.src = url;
  });
}

async function drawToJpeg(
  img: HTMLImageElement,
  maxDim: number,
  quality: number,
): Promise<Blob> {
  const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.max(1, Math.round(img.naturalWidth * scale));
  const height = Math.max(1, Math.round(img.naturalHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no-canvas-context");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("encode-failed"))),
      "image/jpeg",
      quality,
    );
  });
}

export async function processImage(file: File): Promise<Processed> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const [analysis, thumb] = await Promise.all([
      drawToJpeg(img, ANALYSIS_MAX_DIM, 0.85),
      drawToJpeg(img, THUMB_MAX_DIM, 0.72),
    ]);
    return { analysis, thumb };
  } finally {
    URL.revokeObjectURL(url);
  }
}

const META_TAGS = [
  "Make",
  "Model",
  "LensModel",
  "FocalLength",
  "FNumber",
  "ExposureTime",
  "ISO",
  "ExposureCompensation",
  "WhiteBalance",
  "Flash",
  "MeteringMode",
  "DateTimeOriginal",
];

function prettyParts(tags: Record<string, unknown>): string[] {
  const parts: string[] = [];
  const push = (label: string, value: unknown) => {
    if (value === undefined || value === null || value === "") return;
    parts.push(`${label}: ${String(value)}`);
  };

  const camera = [tags.Make, tags.Model].filter(Boolean).join(" ");
  if (camera) push("Camera", camera);
  push("Lens", tags.LensModel);
  if (typeof tags.FocalLength === "number") {
    push("Focal length", `${Math.round(tags.FocalLength)}mm`);
  }
  if (typeof tags.FNumber === "number") {
    push("Aperture", `f/${tags.FNumber}`);
  }
  if (typeof tags.ExposureTime === "number" && tags.ExposureTime > 0) {
    const et = tags.ExposureTime;
    push("Shutter", et >= 1 ? `1/${Math.round(et)}s` : `${et}s`);
  }
  if (typeof tags.ISO === "number") push("ISO", tags.ISO);
  if (typeof tags.ExposureCompensation === "number" && tags.ExposureCompensation !== 0) {
    push("Exposure comp", `${tags.ExposureCompensation > 0 ? "+" : ""}${tags.ExposureCompensation} EV`);
  }
  if (typeof tags.WhiteBalance === "number" && tags.WhiteBalance !== undefined) {
    push("White balance", tags.WhiteBalance === 1 ? "auto" : "manual");
  }
  if (tags.Flash !== undefined) push("Flash", tags.Flash ? "fired" : "no flash");
  if (tags.DateTimeOriginal) push("Taken", tags.DateTimeOriginal);
  return parts;
}

export async function readMetadataText(file: File): Promise<string | null> {
  try {
    const exifr = await import("exifr");
    const raw = (await exifr.parse(file, {
      pick: META_TAGS,
      translateKeys: false,
      reviveValues: false,
    })) as Record<string, unknown> | undefined;

    if (!raw) return null;
    const parts = prettyParts(raw);
    if (parts.length === 0) return null;
    return parts.join(" · ");
  } catch {
    return null;
  }
}
