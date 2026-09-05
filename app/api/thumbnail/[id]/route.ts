import fs from "node:fs";
import path from "node:path";
import { THUMBNAILS_DIR, getRating } from "@/lib/db";

export const runtime = "nodejs";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
};

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) {
    return Response.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  const entry = getRating(id);
  if (!entry) {
    return Response.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  const filePath = path.join(/* turbopackIgnore: true */ THUMBNAILS_DIR, `${id}.${entry.imgExt}`);
  if (!fs.existsSync(filePath)) {
    return Response.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  const bytes = fs.readFileSync(filePath);
  return new Response(bytes, {
    headers: {
      "Content-Type": MIME_BY_EXT[entry.imgExt] ?? "application/octet-stream",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
