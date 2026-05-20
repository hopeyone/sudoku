export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert';

export const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard', 'expert'];

export interface StoredPuzzle {
  given: number[];
  solution: number[];
  difficulty: Difficulty;
  clues: number;
}

export interface CurrentGame {
  puzzle: StoredPuzzle;
  entries: number[];
  pencil: number[];
  selected: number;
  pencilMode: boolean;
  startedAt: number;
  updatedAt: number;
}

export interface HistoryItem {
  id: string;
  difficulty: Difficulty;
  durationMs: number;
  clues: number;
  completedAt: number;
}

export interface Stats {
  byDifficulty: Record<Difficulty, { solved: number; bestMs: number | null }>;
  totalSolved: number;
}

export interface Env {
  PROGRESS: R2Bucket;
  DEV_USER_EMAIL?: string;
  ALLOWED_ORIGIN?: string;
}
