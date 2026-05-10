export type Digit = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
export type Grid = number[]; // length 81; 0 = empty
export type Candidates = number[]; // length 81; bitmask, bit (d-1) set means digit d is possible

export const N = 9;
export const SIZE = 81;
export const ALL_CANDIDATES = 0b111111111; // bits 0..8 -> digits 1..9

export const rowOf = (i: number) => Math.floor(i / N);
export const colOf = (i: number) => i % N;
export const boxOf = (i: number) => Math.floor(rowOf(i) / 3) * 3 + Math.floor(colOf(i) / 3);
export const idx = (r: number, c: number) => r * N + c;

export const ROWS: number[][] = Array.from({ length: N }, (_, r) =>
  Array.from({ length: N }, (_, c) => idx(r, c))
);
export const COLS: number[][] = Array.from({ length: N }, (_, c) =>
  Array.from({ length: N }, (_, r) => idx(r, c))
);
export const BOXES: number[][] = Array.from({ length: N }, (_, b) => {
  const br = Math.floor(b / 3) * 3;
  const bc = (b % 3) * 3;
  const out: number[] = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) out.push(idx(br + r, bc + c));
  return out;
});
export const UNITS: number[][] = [...ROWS, ...COLS, ...BOXES];

// Peers: all cells in the same row, column, or box (excluding self)
export const PEERS: number[][] = Array.from({ length: SIZE }, (_, i) => {
  const set = new Set<number>();
  for (const j of ROWS[rowOf(i)]) if (j !== i) set.add(j);
  for (const j of COLS[colOf(i)]) if (j !== i) set.add(j);
  for (const j of BOXES[boxOf(i)]) if (j !== i) set.add(j);
  return [...set];
});

export function emptyGrid(): Grid {
  return new Array<number>(SIZE).fill(0);
}

export function cloneGrid(g: Grid): Grid {
  return g.slice();
}

export function bitFor(d: number): number {
  return 1 << (d - 1);
}

export function digitOfBit(bit: number): number {
  // assumes bit is a single set bit
  let d = 0;
  while (bit > 0) {
    bit >>= 1;
    d++;
  }
  return d;
}

export function popcount(x: number): number {
  let c = 0;
  while (x) {
    x &= x - 1;
    c++;
  }
  return c;
}

export function bitsToDigits(mask: number): number[] {
  const out: number[] = [];
  for (let d = 1; d <= 9; d++) if (mask & bitFor(d)) out.push(d);
  return out;
}

export function isValidPlacement(g: Grid, i: number, d: number): boolean {
  for (const p of PEERS[i]) if (g[p] === d) return false;
  return true;
}

export function computeCandidates(g: Grid): Candidates {
  const cand: Candidates = new Array<number>(SIZE).fill(0);
  for (let i = 0; i < SIZE; i++) {
    if (g[i] !== 0) continue;
    let mask = ALL_CANDIDATES;
    for (const p of PEERS[i]) {
      const v = g[p];
      if (v !== 0) mask &= ~bitFor(v);
    }
    cand[i] = mask;
  }
  return cand;
}
