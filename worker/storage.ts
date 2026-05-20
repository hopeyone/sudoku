import type { CurrentGame, Env, HistoryItem, Stats } from './types';
import { DIFFICULTIES } from './types';

function userKey(email: string, suffix: string): string {
  return `users/${encodeURIComponent(email)}/${suffix}`;
}

export function defaultStats(): Stats {
  const byDifficulty = {} as Stats['byDifficulty'];
  for (const d of DIFFICULTIES) byDifficulty[d] = { solved: 0, bestMs: null };
  return { byDifficulty, totalSolved: 0 };
}

export async function getCurrent(env: Env, email: string): Promise<CurrentGame | null> {
  const obj = await env.PROGRESS.get(userKey(email, 'current.json'));
  if (!obj) return null;
  return obj.json<CurrentGame>();
}

export async function putCurrent(env: Env, email: string, game: CurrentGame): Promise<void> {
  await env.PROGRESS.put(userKey(email, 'current.json'), JSON.stringify(game), {
    httpMetadata: { contentType: 'application/json' },
  });
}

export async function deleteCurrent(env: Env, email: string): Promise<void> {
  await env.PROGRESS.delete(userKey(email, 'current.json'));
}

export async function getStats(env: Env, email: string): Promise<Stats> {
  const obj = await env.PROGRESS.get(userKey(email, 'stats.json'));
  if (!obj) return defaultStats();
  return obj.json<Stats>();
}

export async function putStats(env: Env, email: string, stats: Stats): Promise<void> {
  await env.PROGRESS.put(userKey(email, 'stats.json'), JSON.stringify(stats), {
    httpMetadata: { contentType: 'application/json' },
  });
}

// Append a history item as its own R2 object — avoids read/modify/write races
// on a single growing file. Key is sortable so the listing is ordered.
export async function appendHistory(env: Env, email: string, item: HistoryItem): Promise<void> {
  const ts = String(item.completedAt).padStart(15, '0');
  const key = userKey(email, `history/${ts}-${item.id}.json`);
  await env.PROGRESS.put(key, JSON.stringify(item), {
    httpMetadata: { contentType: 'application/json' },
  });
}

export async function listHistory(env: Env, email: string, limit = 50): Promise<HistoryItem[]> {
  const prefix = userKey(email, 'history/');
  const list = await env.PROGRESS.list({ prefix, limit: Math.min(limit, 1000) });
  const items = await Promise.all(
    list.objects.map(async (o) => {
      const obj = await env.PROGRESS.get(o.key);
      return obj ? obj.json<HistoryItem>() : null;
    })
  );
  return items
    .filter((x): x is HistoryItem => x !== null)
    .sort((a, b) => b.completedAt - a.completedAt)
    .slice(0, limit);
}

export function applyCompletion(stats: Stats, item: HistoryItem): Stats {
  const next: Stats = {
    byDifficulty: { ...stats.byDifficulty },
    totalSolved: stats.totalSolved + 1,
  };
  const prev = next.byDifficulty[item.difficulty];
  next.byDifficulty[item.difficulty] = {
    solved: prev.solved + 1,
    bestMs: prev.bestMs === null ? item.durationMs : Math.min(prev.bestMs, item.durationMs),
  };
  return next;
}
