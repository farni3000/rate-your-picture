import { topRatings } from "@/lib/db";
import type { LeaderboardEntry } from "@/lib/types";

export const runtime = "nodejs";

export function GET(): Response {
  const entries = topRatings(5).map((row): LeaderboardEntry => ({
    id: row.id,
    name: row.name,
    score: row.score,
    verdict: row.verdict,
    createdAt: row.createdAt,
    thumbnailUrl: `/api/thumbnail/${row.id}`,
  }));

  return Response.json({ ok: true, entries });
}
