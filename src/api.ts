import type { Puzzle } from './sudoku/generator';
import type { Difficulty } from './sudoku/rate';

const API_BASE = (import.meta.env.VITE_API_BASE ?? '') as string;

export const apiEnabled = API_BASE.length > 0;

export interface CurrentGameDTO {
  puzzle: Puzzle;
  entries: number[];
  pencil: number[];
  selected: number;
  pencilMode: boolean;
  startedAt: number;
  updatedAt: number;
}

export interface Stats {
  byDifficulty: Record<Difficulty, { solved: number; bestMs: number | null }>;
  totalSolved: number;
}

export interface HistoryItem {
  id: string;
  difficulty: Difficulty;
  durationMs: number;
  clues: number;
  completedAt: number;
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(API_BASE + path, {
    credentials: 'include',
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`API ${path} -> ${res.status}`);
  return res.json() as Promise<T>;
}

export function fetchState(): Promise<{ current: CurrentGameDTO | null; stats: Stats }> {
  return call('/api/state');
}

export function saveCurrent(game: CurrentGameDTO): Promise<{ ok: true }> {
  return call('/api/current', { method: 'PUT', body: JSON.stringify(game) });
}

export function clearCurrent(): Promise<{ ok: true }> {
  return call('/api/current', { method: 'DELETE' });
}

export function completeGame(input: {
  difficulty: Difficulty;
  durationMs: number;
  clues: number;
}): Promise<{ stats: Stats; item: HistoryItem }> {
  return call('/api/complete', { method: 'POST', body: JSON.stringify(input) });
}

export function fetchHistory(limit = 50): Promise<{ items: HistoryItem[] }> {
  return call(`/api/history?limit=${limit}`);
}
