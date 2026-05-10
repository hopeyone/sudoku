import { Grid, SIZE, cloneGrid } from './grid';
import { countSolutions, randomSolution } from './solver';
import { Difficulty, rate } from './rate';

export interface Puzzle {
  given: Grid;          // 0 for empty cells
  solution: Grid;       // full solution
  difficulty: Difficulty;
  clues: number;
}

interface Plan {
  minClues: number;
  maxClues: number;
}

// Clue-count targets by difficulty. The rater is the source of truth — these
// just bound the search so we don't over- or under-remove.
const PLANS: Record<Difficulty, Plan> = {
  easy: { minClues: 38, maxClues: 50 },
  medium: { minClues: 30, maxClues: 38 },
  hard: { minClues: 26, maxClues: 32 },
  expert: { minClues: 22, maxClues: 28 },
};

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function countClues(g: Grid): number {
  let n = 0;
  for (let i = 0; i < SIZE; i++) if (g[i] !== 0) n++;
  return n;
}

function digRandom(solution: Grid, minClues: number): Grid {
  const puzzle = cloneGrid(solution);
  // Use 180° rotational symmetry — pleasant aesthetic and slightly tighter puzzles.
  const halves: number[] = [];
  for (let i = 0; i < SIZE / 2; i++) halves.push(i);
  halves.push(40); // center
  const order = shuffle(halves);

  for (const i of order) {
    if (countClues(puzzle) <= minClues) break;
    const pair = SIZE - 1 - i;
    const a = puzzle[i];
    const b = puzzle[pair];
    if (a === 0 && b === 0) continue;
    puzzle[i] = 0;
    if (pair !== i) puzzle[pair] = 0;
    if (countSolutions(puzzle, 2) !== 1) {
      puzzle[i] = a;
      if (pair !== i) puzzle[pair] = b;
    }
  }
  return puzzle;
}

export function generate(difficulty: Difficulty, maxAttempts = 80): Puzzle {
  const plan = PLANS[difficulty];
  let bestFallback: Puzzle | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const solution = randomSolution();
    const puzzle = digRandom(solution, plan.minClues);
    const clues = countClues(puzzle);
    const rating = rate(puzzle);

    if (rating.difficulty === difficulty && clues <= plan.maxClues) {
      return { given: puzzle, solution, difficulty, clues };
    }

    // Keep the best fallback (closest difficulty) in case we never hit the target.
    if (rating.difficulty !== 'unsolved') {
      const candidate: Puzzle = {
        given: puzzle,
        solution,
        difficulty: rating.difficulty,
        clues,
      };
      if (
        bestFallback === null ||
        Math.abs(diffIndex(candidate.difficulty) - diffIndex(difficulty)) <
          Math.abs(diffIndex(bestFallback.difficulty) - diffIndex(difficulty))
      ) {
        bestFallback = candidate;
      }
    }
  }

  // Couldn't hit target after maxAttempts — return closest match.
  return bestFallback ?? {
    given: cloneGrid(randomSolution()),
    solution: randomSolution(),
    difficulty,
    clues: SIZE,
  };
}

function diffIndex(d: Difficulty): number {
  return ['easy', 'medium', 'hard', 'expert'].indexOf(d);
}
