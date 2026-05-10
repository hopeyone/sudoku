import {
  ALL_CANDIDATES,
  BOXES,
  Candidates,
  COLS,
  Grid,
  N,
  PEERS,
  ROWS,
  SIZE,
  bitFor,
  bitsToDigits,
  boxOf,
  colOf,
  popcount,
  rowOf,
} from './grid';

export interface SolveState {
  grid: Grid;
  cand: Candidates; // bitmasks for empty cells; 0 for filled cells
}

function placeDigit(state: SolveState, i: number, d: number): boolean {
  const { grid, cand } = state;
  if (grid[i] !== 0) return false;
  grid[i] = d;
  cand[i] = 0;
  const b = bitFor(d);
  for (const p of PEERS[i]) {
    if (cand[p] & b) cand[p] &= ~b;
  }
  return true;
}

function eliminate(state: SolveState, i: number, mask: number): boolean {
  const { cand } = state;
  if ((cand[i] & mask) === 0) return false;
  cand[i] &= ~mask;
  return true;
}

// --- Naked single ---
export function nakedSingle(state: SolveState): boolean {
  const { grid, cand } = state;
  for (let i = 0; i < SIZE; i++) {
    if (grid[i] !== 0) continue;
    const m = cand[i];
    if (popcount(m) === 1) {
      const d = bitsToDigits(m)[0];
      placeDigit(state, i, d);
      return true;
    }
  }
  return false;
}

// --- Hidden single ---
export function hiddenSingle(state: SolveState): boolean {
  const { grid, cand } = state;
  const units = [...ROWS, ...COLS, ...BOXES];
  for (const unit of units) {
    for (let d = 1; d <= 9; d++) {
      const b = bitFor(d);
      let foundIdx = -1;
      let count = 0;
      for (const i of unit) {
        if (grid[i] === d) {
          count = -1;
          break;
        }
        if (cand[i] & b) {
          foundIdx = i;
          count++;
          if (count > 1) break;
        }
      }
      if (count === 1 && foundIdx !== -1) {
        placeDigit(state, foundIdx, d);
        return true;
      }
    }
  }
  return false;
}

// --- Naked pair ---
export function nakedPair(state: SolveState): boolean {
  const { grid, cand } = state;
  const units = [...ROWS, ...COLS, ...BOXES];
  for (const unit of units) {
    const empties: number[] = [];
    for (const i of unit) if (grid[i] === 0) empties.push(i);
    for (let a = 0; a < empties.length; a++) {
      const ia = empties[a];
      const ma = cand[ia];
      if (popcount(ma) !== 2) continue;
      for (let b = a + 1; b < empties.length; b++) {
        const ib = empties[b];
        if (cand[ib] !== ma) continue;
        // Pair found — eliminate ma from other cells in this unit
        let changed = false;
        for (const i of unit) {
          if (i === ia || i === ib) continue;
          if (grid[i] !== 0) continue;
          if (eliminate(state, i, ma)) changed = true;
        }
        if (changed) return true;
      }
    }
  }
  return false;
}

// --- Hidden pair ---
export function hiddenPair(state: SolveState): boolean {
  const { grid, cand } = state;
  const units = [...ROWS, ...COLS, ...BOXES];
  for (const unit of units) {
    // For each digit, find which cells in this unit can hold it
    const cellsFor: Record<number, number[]> = {};
    const unitDigits: number[] = [];
    for (let d = 1; d <= 9; d++) {
      const b = bitFor(d);
      const cells: number[] = [];
      let placed = false;
      for (const i of unit) {
        if (grid[i] === d) {
          placed = true;
          break;
        }
        if (cand[i] & b) cells.push(i);
      }
      if (!placed && cells.length > 0) {
        cellsFor[d] = cells;
        unitDigits.push(d);
      }
    }
    for (let a = 0; a < unitDigits.length; a++) {
      const da = unitDigits[a];
      if (cellsFor[da].length !== 2) continue;
      for (let b = a + 1; b < unitDigits.length; b++) {
        const db = unitDigits[b];
        if (cellsFor[db].length !== 2) continue;
        const [a1, a2] = cellsFor[da];
        const [b1, b2] = cellsFor[db];
        if ((a1 === b1 && a2 === b2) || (a1 === b2 && a2 === b1)) {
          // Hidden pair: cells {a1,a2} hold {da,db}
          const keep = bitFor(da) | bitFor(db);
          let changed = false;
          for (const i of [a1, a2]) {
            const removeMask = cand[i] & ~keep;
            if (removeMask !== 0) {
              cand[i] &= keep;
              changed = true;
            }
          }
          if (changed) return true;
        }
      }
    }
  }
  return false;
}

// --- Pointing pair/triple (box -> row/col) ---
export function pointing(state: SolveState): boolean {
  const { grid, cand } = state;
  for (let bi = 0; bi < N; bi++) {
    const box = BOXES[bi];
    for (let d = 1; d <= 9; d++) {
      const b = bitFor(d);
      let placed = false;
      const cellsInBox: number[] = [];
      for (const i of box) {
        if (grid[i] === d) {
          placed = true;
          break;
        }
        if (cand[i] & b) cellsInBox.push(i);
      }
      if (placed || cellsInBox.length < 2) continue;
      const rows = new Set(cellsInBox.map(rowOf));
      const cols = new Set(cellsInBox.map(colOf));
      let changed = false;
      if (rows.size === 1) {
        const r = rows.values().next().value!;
        for (const i of ROWS[r]) {
          if (boxOf(i) === bi) continue;
          if (grid[i] !== 0) continue;
          if (eliminate(state, i, b)) changed = true;
        }
      } else if (cols.size === 1) {
        const c = cols.values().next().value!;
        for (const i of COLS[c]) {
          if (boxOf(i) === bi) continue;
          if (grid[i] !== 0) continue;
          if (eliminate(state, i, b)) changed = true;
        }
      }
      if (changed) return true;
    }
  }
  return false;
}

// --- Box-line reduction (row/col -> box) ---
export function boxLine(state: SolveState): boolean {
  const { grid, cand } = state;
  const lines: { unit: number[]; kind: 'row' | 'col' }[] = [];
  for (let i = 0; i < N; i++) lines.push({ unit: ROWS[i], kind: 'row' });
  for (let i = 0; i < N; i++) lines.push({ unit: COLS[i], kind: 'col' });
  for (const { unit } of lines) {
    for (let d = 1; d <= 9; d++) {
      const b = bitFor(d);
      let placed = false;
      const cells: number[] = [];
      for (const i of unit) {
        if (grid[i] === d) {
          placed = true;
          break;
        }
        if (cand[i] & b) cells.push(i);
      }
      if (placed || cells.length < 2) continue;
      const boxes = new Set(cells.map(boxOf));
      if (boxes.size !== 1) continue;
      const bx = boxes.values().next().value!;
      let changed = false;
      const lineSet = new Set(unit);
      for (const i of BOXES[bx]) {
        if (lineSet.has(i)) continue;
        if (grid[i] !== 0) continue;
        if (eliminate(state, i, b)) changed = true;
      }
      if (changed) return true;
    }
  }
  return false;
}

// --- X-Wing ---
export function xWing(state: SolveState): boolean {
  const { grid, cand } = state;
  for (let d = 1; d <= 9; d++) {
    const b = bitFor(d);
    // Row-based X-wing
    const rowCells: number[][] = ROWS.map((row) => {
      let placed = false;
      const cells: number[] = [];
      for (const i of row) {
        if (grid[i] === d) {
          placed = true;
          break;
        }
        if (cand[i] & b) cells.push(i);
      }
      return placed ? [] : cells;
    });
    for (let r1 = 0; r1 < N; r1++) {
      if (rowCells[r1].length !== 2) continue;
      const c1 = colOf(rowCells[r1][0]);
      const c2 = colOf(rowCells[r1][1]);
      for (let r2 = r1 + 1; r2 < N; r2++) {
        if (rowCells[r2].length !== 2) continue;
        if (colOf(rowCells[r2][0]) !== c1 || colOf(rowCells[r2][1]) !== c2) continue;
        // X-wing on rows r1,r2 / cols c1,c2 — eliminate digit d from cols c1,c2 elsewhere
        let changed = false;
        for (const c of [c1, c2]) {
          for (const i of COLS[c]) {
            if (rowOf(i) === r1 || rowOf(i) === r2) continue;
            if (grid[i] !== 0) continue;
            if (eliminate(state, i, b)) changed = true;
          }
        }
        if (changed) return true;
      }
    }
    // Col-based X-wing
    const colCells: number[][] = COLS.map((col) => {
      let placed = false;
      const cells: number[] = [];
      for (const i of col) {
        if (grid[i] === d) {
          placed = true;
          break;
        }
        if (cand[i] & b) cells.push(i);
      }
      return placed ? [] : cells;
    });
    for (let c1 = 0; c1 < N; c1++) {
      if (colCells[c1].length !== 2) continue;
      const r1 = rowOf(colCells[c1][0]);
      const r2 = rowOf(colCells[c1][1]);
      for (let c2 = c1 + 1; c2 < N; c2++) {
        if (colCells[c2].length !== 2) continue;
        if (rowOf(colCells[c2][0]) !== r1 || rowOf(colCells[c2][1]) !== r2) continue;
        let changed = false;
        for (const r of [r1, r2]) {
          for (const i of ROWS[r]) {
            if (colOf(i) === c1 || colOf(i) === c2) continue;
            if (grid[i] !== 0) continue;
            if (eliminate(state, i, b)) changed = true;
          }
        }
        if (changed) return true;
      }
    }
  }
  return false;
}

export function makeState(grid: Grid): SolveState {
  const cand: Candidates = new Array<number>(SIZE).fill(0);
  for (let i = 0; i < SIZE; i++) {
    if (grid[i] !== 0) continue;
    let mask = ALL_CANDIDATES;
    for (const p of PEERS[i]) {
      const v = grid[p];
      if (v !== 0) mask &= ~bitFor(v);
    }
    cand[i] = mask;
  }
  return { grid, cand };
}
