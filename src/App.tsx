import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Board } from './components/Board';
import { NumberPad } from './components/NumberPad';
import { N, SIZE, bitFor, colOf, rowOf } from './sudoku/grid';
import { generate, Puzzle } from './sudoku/generator';
import { Difficulty, DIFFICULTIES } from './sudoku/rate';
import './App.css';

const DIFF_LABEL: Record<Difficulty, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
  expert: 'Expert',
};

export default function App() {
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [entries, setEntries] = useState<number[]>(() => new Array<number>(SIZE).fill(0));
  const [pencil, setPencil] = useState<number[]>(() => new Array<number>(SIZE).fill(0));
  const [selected, setSelected] = useState<number>(40);
  const [pencilMode, setPencilMode] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  const generationToken = useRef(0);

  const newGame = useCallback((diff: Difficulty) => {
    const token = ++generationToken.current;
    setLoading(true);
    setPuzzle(null);
    // Yield to the browser so the loading state paints before generation blocks the thread.
    setTimeout(() => {
      const p = generate(diff);
      if (token !== generationToken.current) return;
      setPuzzle(p);
      setEntries(new Array<number>(SIZE).fill(0));
      setPencil(new Array<number>(SIZE).fill(0));
      setSelected(40);
      setLoading(false);
    }, 16);
  }, []);

  useEffect(() => {
    newGame('easy');
  }, [newGame]);

  const solved = useMemo(() => {
    if (!puzzle) return false;
    for (let i = 0; i < SIZE; i++) {
      const v = puzzle.given[i] || entries[i];
      if (v !== puzzle.solution[i]) return false;
    }
    return true;
  }, [puzzle, entries]);

  const digitCounts = useMemo(() => {
    const counts = new Array<number>(10).fill(0);
    if (!puzzle) return counts;
    for (let i = 0; i < SIZE; i++) {
      const v = puzzle.given[i] || entries[i];
      if (v !== 0) counts[v]++;
    }
    return counts;
  }, [puzzle, entries]);

  // Dev-only test hook: expose puzzle/state for Playwright. Stripped from prod builds.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as unknown as { __sudoku?: unknown }).__sudoku = {
      puzzle,
      entries,
      pencil,
      selected,
      pencilMode,
      loading,
      solved,
    };
  }, [puzzle, entries, pencil, selected, pencilMode, loading, solved]);

  const enterDigit = useCallback(
    (d: number) => {
      if (!puzzle || solved) return;
      const i = selected;
      if (puzzle.given[i] !== 0) return;
      if (pencilMode) {
        // Toggle pencil mark; clear any committed entry first.
        setEntries((prev) => {
          if (prev[i] === 0) return prev;
          const next = prev.slice();
          next[i] = 0;
          return next;
        });
        setPencil((prev) => {
          const next = prev.slice();
          next[i] = prev[i] ^ bitFor(d);
          return next;
        });
      } else {
        setPencil((prev) => {
          if (prev[i] === 0) return prev;
          const next = prev.slice();
          next[i] = 0;
          return next;
        });
        setEntries((prev) => {
          const next = prev.slice();
          next[i] = prev[i] === d ? 0 : d;
          return next;
        });
      }
    },
    [puzzle, selected, pencilMode, solved]
  );

  const eraseCell = useCallback(() => {
    if (!puzzle || solved) return;
    const i = selected;
    if (puzzle.given[i] !== 0) return;
    setEntries((prev) => {
      if (prev[i] === 0) return prev;
      const next = prev.slice();
      next[i] = 0;
      return next;
    });
    setPencil((prev) => {
      if (prev[i] === 0) return prev;
      const next = prev.slice();
      next[i] = 0;
      return next;
    });
  }, [puzzle, selected, solved]);

  const moveSelection = useCallback((dr: number, dc: number) => {
    setSelected((s) => {
      const r = Math.min(N - 1, Math.max(0, rowOf(s) + dr));
      const c = Math.min(N - 1, Math.max(0, colOf(s) + dc));
      return r * N + c;
    });
  }, []);

  // Global keyboard handling
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key >= '1' && e.key <= '9') {
        enterDigit(Number(e.key));
        e.preventDefault();
        return;
      }
      switch (e.key) {
        case 'Backspace':
        case 'Delete':
        case '0':
          eraseCell();
          e.preventDefault();
          break;
        case 'ArrowUp':
          moveSelection(-1, 0);
          e.preventDefault();
          break;
        case 'ArrowDown':
          moveSelection(1, 0);
          e.preventDefault();
          break;
        case 'ArrowLeft':
          moveSelection(0, -1);
          e.preventDefault();
          break;
        case 'ArrowRight':
          moveSelection(0, 1);
          e.preventDefault();
          break;
        case 'p':
        case 'P':
          setPencilMode((p) => !p);
          e.preventDefault();
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enterDigit, eraseCell, moveSelection]);

  return (
    <div className="app">
      <header className="header">
        <h1 className="title">Sudoku</h1>
        <div className="difficulty">
          {DIFFICULTIES.map((d) => (
            <button
              key={d}
              type="button"
              className={`diff-btn ${difficulty === d ? 'active' : ''}`}
              onClick={() => {
                setDifficulty(d);
                newGame(d);
              }}
            >
              {DIFF_LABEL[d]}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="new-game"
          onClick={() => newGame(difficulty)}
          disabled={loading}
        >
          New game
        </button>
      </header>

      <main className="main">
        {loading || !puzzle ? (
          <div className="placeholder">Generating {DIFF_LABEL[difficulty]} puzzle…</div>
        ) : (
          <>
            <Board
              given={puzzle.given}
              entries={entries}
              pencil={pencil}
              selected={selected}
              solved={solved}
              onSelect={setSelected}
            />
            {solved && <div className="solved-banner">Solved!</div>}
            <NumberPad
              onDigit={enterDigit}
              onErase={eraseCell}
              pencilMode={pencilMode}
              onTogglePencil={() => setPencilMode((p) => !p)}
              digitCounts={digitCounts}
            />
            <div className="meta">
              {DIFF_LABEL[puzzle.difficulty]} · {puzzle.clues} clues
            </div>
          </>
        )}
      </main>
    </div>
  );
}
