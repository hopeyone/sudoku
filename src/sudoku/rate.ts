import { Grid, SIZE, cloneGrid } from './grid';
import {
  boxLine,
  hiddenPair,
  hiddenSingle,
  makeState,
  nakedPair,
  nakedSingle,
  pointing,
  xWing,
} from './techniques';

export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert';

export const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard', 'expert'];

// Highest level a technique was needed at:
//   0 = naked single only          → easy
//   1 = hidden single              → medium
//   2 = naked/hidden pair          → hard
//   3 = pointing/box-line/X-wing   → expert
//   -1 = couldn't be solved with these techniques
export interface RatingResult {
  solved: boolean;
  level: number;
  difficulty: Difficulty | 'unsolved';
}

const LEVELS: { level: number; fn: (s: ReturnType<typeof makeState>) => boolean }[] = [
  { level: 0, fn: nakedSingle },
  { level: 1, fn: hiddenSingle },
  { level: 2, fn: nakedPair },
  { level: 2, fn: hiddenPair },
  { level: 3, fn: pointing },
  { level: 3, fn: boxLine },
  { level: 3, fn: xWing },
];

function levelToDifficulty(level: number): Difficulty | 'unsolved' {
  if (level < 0) return 'unsolved';
  if (level === 0) return 'easy';
  if (level === 1) return 'medium';
  if (level === 2) return 'hard';
  return 'expert';
}

export function rate(grid: Grid): RatingResult {
  const state = makeState(cloneGrid(grid));
  let hardest = -1;

  outer: while (true) {
    for (const { level, fn } of LEVELS) {
      if (fn(state)) {
        if (level > hardest) hardest = level;
        continue outer;
      }
    }
    break;
  }

  let solved = true;
  for (let i = 0; i < SIZE; i++) {
    if (state.grid[i] === 0) {
      solved = false;
      break;
    }
  }

  if (!solved) return { solved, level: -1, difficulty: 'unsolved' };
  return { solved, level: hardest, difficulty: levelToDifficulty(hardest) };
}
