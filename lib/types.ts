export interface RoastItem {
  burn: string;
  fix: string;
}

export interface RateResult {
  name: string;
  score: number;
  verdict: string;
  working: string[];
  roast: RoastItem[];
}

export interface RateResponse {
  id: string;
  result: RateResult;
}

export interface LeaderboardEntry {
  id: string;
  name: string;
  score: number;
  verdict: string;
  createdAt: string;
  thumbnailUrl: string;
}
