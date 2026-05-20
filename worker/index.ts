import { getUserEmail } from './access';
import {
  appendHistory,
  applyCompletion,
  deleteCurrent,
  getCurrent,
  getStats,
  listHistory,
  putCurrent,
  putStats,
} from './storage';
import type { CurrentGame, Env, HistoryItem } from './types';
import { DIFFICULTIES } from './types';

function corsHeaders(env: Env, req: Request): Record<string, string> {
  const origin = env.ALLOWED_ORIGIN || req.headers.get('Origin') || '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET,PUT,POST,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Cf-Access-Jwt-Assertion',
    'Access-Control-Allow-Credentials': 'true',
    Vary: 'Origin',
  };
}

function json(body: unknown, status: number, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  });
}

function isCurrentGame(g: unknown): g is CurrentGame {
  if (!g || typeof g !== 'object') return false;
  const v = g as Record<string, unknown>;
  const puzzle = v.puzzle as Record<string, unknown> | undefined;
  if (!puzzle) return false;
  if (!Array.isArray(puzzle.given) || puzzle.given.length !== 81) return false;
  if (!Array.isArray(puzzle.solution) || puzzle.solution.length !== 81) return false;
  if (!Array.isArray(v.entries) || (v.entries as unknown[]).length !== 81) return false;
  if (!Array.isArray(v.pencil) || (v.pencil as unknown[]).length !== 81) return false;
  return true;
}

interface CompleteBody {
  difficulty: HistoryItem['difficulty'];
  durationMs: number;
  clues: number;
  completedAt?: number;
  id?: string;
}

function isCompleteBody(b: unknown): b is CompleteBody {
  if (!b || typeof b !== 'object') return false;
  const v = b as Record<string, unknown>;
  if (!DIFFICULTIES.includes(v.difficulty as HistoryItem['difficulty'])) return false;
  if (typeof v.durationMs !== 'number' || v.durationMs < 0) return false;
  if (typeof v.clues !== 'number') return false;
  return true;
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const cors = corsHeaders(env, req);

    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    const email = getUserEmail(req, env);
    if (!email) return json({ error: 'unauthorized' }, 401, cors);

    try {
      const route = `${req.method} ${url.pathname}`;

      if (route === 'GET /api/state') {
        const [current, stats] = await Promise.all([getCurrent(env, email), getStats(env, email)]);
        return json({ current, stats }, 200, cors);
      }

      if (route === 'PUT /api/current') {
        const body = await req.json();
        if (!isCurrentGame(body)) return json({ error: 'invalid body' }, 400, cors);
        body.updatedAt = Date.now();
        await putCurrent(env, email, body);
        return json({ ok: true }, 200, cors);
      }

      if (route === 'DELETE /api/current') {
        await deleteCurrent(env, email);
        return json({ ok: true }, 200, cors);
      }

      if (route === 'POST /api/complete') {
        const body = await req.json();
        if (!isCompleteBody(body)) return json({ error: 'invalid body' }, 400, cors);
        const item: HistoryItem = {
          id: body.id ?? crypto.randomUUID(),
          difficulty: body.difficulty,
          durationMs: body.durationMs,
          clues: body.clues,
          completedAt: body.completedAt ?? Date.now(),
        };
        const stats = await getStats(env, email);
        const next = applyCompletion(stats, item);
        await Promise.all([
          appendHistory(env, email, item),
          putStats(env, email, next),
          deleteCurrent(env, email),
        ]);
        return json({ stats: next, item }, 200, cors);
      }

      if (route === 'GET /api/history') {
        const limit = Math.min(Number(url.searchParams.get('limit') ?? 50) || 50, 200);
        const items = await listHistory(env, email, limit);
        return json({ items }, 200, cors);
      }

      return json({ error: 'not found' }, 404, cors);
    } catch (err) {
      return json({ error: 'internal error', message: (err as Error).message }, 500, cors);
    }
  },
} satisfies ExportedHandler<Env>;
