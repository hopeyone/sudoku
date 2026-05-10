import {
  ALL_CANDIDATES,
  Grid,
  N,
  SIZE,
  bitFor,
  boxOf,
  cloneGrid,
  colOf,
  popcount,
  rowOf,
} from './grid';

interface SolverState {
  rowMask: Int32Array;
  colMask: Int32Array;
  boxMask: Int32Array;
}

function buildState(g: Grid): SolverState | null {
  const s: SolverState = {
    rowMask: new Int32Array(N),
    colMask: new Int32Array(N),
    boxMask: new Int32Array(N),
  };
  for (let i = 0; i < SIZE; i++) {
    const v = g[i];
    if (v === 0) continue;
    const b = bitFor(v);
    const r = rowOf(i),
      c = colOf(i),
      x = boxOf(i);
    if (s.rowMask[r] & b || s.colMask[c] & b || s.boxMask[x] & b) return null;
    s.rowMask[r] |= b;
    s.colMask[c] |= b;
    s.boxMask[x] |= b;
  }
  return s;
}

function nextCell(g: Grid, s: SolverState): { i: number; mask: number } | null {
  let best = -1;
  let bestMask = 0;
  let bestCount = 10;
  for (let i = 0; i < SIZE; i++) {
    if (g[i] !== 0) continue;
    const r = rowOf(i),
      c = colOf(i),
      x = boxOf(i);
    const used = s.rowMask[r] | s.colMask[c] | s.boxMask[x];
    const mask = ALL_CANDIDATES & ~used;
    const cnt = popcount(mask);
    if (cnt === 0) return { i, mask: 0 };
    if (cnt < bestCount) {
      bestCount = cnt;
      best = i;
      bestMask = mask;
      if (cnt === 1) break;
    }
  }
  if (best === -1) return null;
  return { i: best, mask: bestMask };
}

function search(
  g: Grid,
  s: SolverState,
  randomize: boolean,
  found: { count: number; first: Grid | null },
  limit: number
): boolean {
  const next = nextCell(g, s);
  if (next === null) {
    found.count++;
    if (!found.first) found.first = cloneGrid(g);
    return found.count >= limit;
  }
  const { i, mask } = next;
  if (mask === 0) return false;
  const r = rowOf(i),
    c = colOf(i),
    x = boxOf(i);
  const digits: number[] = [];
  for (let d = 1; d <= 9; d++) if (mask & bitFor(d)) digits.push(d);
  if (randomize) shuffleInPlace(digits);
  for (const d of digits) {
    const b = bitFor(d);
    g[i] = d;
    s.rowMask[r] |= b;
    s.colMask[c] |= b;
    s.boxMask[x] |= b;
    const stop = search(g, s, randomize, found, limit);
    g[i] = 0;
    s.rowMask[r] &= ~b;
    s.colMask[c] &= ~b;
    s.boxMask[x] &= ~b;
    if (stop) return true;
  }
  return false;
}

export function solve(g: Grid): Grid | null {
  const s = buildState(g);
  if (!s) return null;
  const work = cloneGrid(g);
  const found = { count: 0, first: null as Grid | null };
  search(work, s, false, found, 1);
  return found.first;
}

export function countSolutions(g: Grid, max = 2): number {
  const s = buildState(g);
  if (!s) return 0;
  const work = cloneGrid(g);
  const found = { count: 0, first: null as Grid | null };
  search(work, s, false, found, max);
  return found.count;
}

export function randomSolution(): Grid {
  const g = new Array<number>(SIZE).fill(0);
  const s = buildState(g)!;
  const found = { count: 0, first: null as Grid | null };
  search(g, s, true, found, 1);
  return found.first!;
}

function shuffleInPlace<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}
