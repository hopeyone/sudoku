import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Board } from './components/Board';
import { NumberPad } from './components/NumberPad';
import { N, SIZE, bitFor, colOf, rowOf } from './sudoku/grid';
import { generate, Puzzle } from './sudoku/generator';
import { Difficulty, DIFFICULTIES } from './sudoku/rate';
import { useAuth } from './auth';
import {
  firebaseEnabled,
  signInAnonymouslyForEmulator,
  signInWithGoogle,
  signOut,
  usingEmulators,
} from './firebase';
import {
  clearCurrent,
  completeGame,
  fetchState,
  saveCurrent,
  type Stats,
} from './firestore';
import './App.css';

const DIFF_LABEL: Record<Difficulty, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
  expert: 'Expert',
};

function formatDuration(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function App() {
  const { user, loading: authLoading } = useAuth();
  const uid = user?.uid ?? null;
  const syncEnabled = firebaseEnabled && !!uid;

  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [entries, setEntries] = useState<number[]>(() => new Array<number>(SIZE).fill(0));
  const [pencil, setPencil] = useState<number[]>(() => new Array<number>(SIZE).fill(0));
  const [selected, setSelected] = useState<number>(40);
  const [pencilMode, setPencilMode] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [startedAt, setStartedAt] = useState<number>(() => Date.now());
  const [stats, setStats] = useState<Stats | null>(null);
  const [signInError, setSignInError] = useState<string | null>(null);

  const generationToken = useRef(0);
  const lastSavedSig = useRef<string>('');
  const completedRef = useRef<boolean>(false);

  const newGame = useCallback((diff: Difficulty) => {
    const token = ++generationToken.current;
    setLoading(true);
    setPuzzle(null);
    completedRef.current = false;
    setTimeout(() => {
      const p = generate(diff);
      if (token !== generationToken.current) return;
      setPuzzle(p);
      setEntries(new Array<number>(SIZE).fill(0));
      setPencil(new Array<number>(SIZE).fill(0));
      setSelected(40);
      setPencilMode(false);
      setStartedAt(Date.now());
      setLoading(false);
    }, 16);
  }, []);

  // Hydrate from Firestore once auth is ready. Falls back to a fresh easy
  // game on any error, or when Firebase isn't configured at all.
  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;
    async function init() {
      if (!syncEnabled || !uid) {
        if (!cancelled) newGame('easy');
        return;
      }
      try {
        const { current, stats: initialStats } = await fetchState(uid);
        if (cancelled) return;
        setStats(initialStats);
        if (current) {
          setPuzzle(current.puzzle);
          setEntries(current.entries);
          setPencil(current.pencil);
          setSelected(current.selected);
          setPencilMode(current.pencilMode);
          setStartedAt(current.startedAt);
          setDifficulty(current.puzzle.difficulty);
          setLoading(false);
          lastSavedSig.current = signatureOf(
            current.puzzle,
            current.entries,
            current.pencil,
            current.selected,
            current.pencilMode,
            current.startedAt
          );
        } else {
          newGame('easy');
        }
      } catch {
        if (!cancelled) newGame('easy');
      }
    }
    init();
    return () => {
      cancelled = true;
    };
  }, [authLoading, syncEnabled, uid, newGame]);

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

  // Debounced auto-save to Firestore.
  useEffect(() => {
    if (!syncEnabled || !uid || !puzzle || loading || solved) return;
    const sig = signatureOf(puzzle, entries, pencil, selected, pencilMode, startedAt);
    if (sig === lastSavedSig.current) return;
    const timer = setTimeout(() => {
      saveCurrent(uid, {
        puzzle,
        entries,
        pencil,
        selected,
        pencilMode,
        startedAt,
        updatedAt: Date.now(),
      })
        .then(() => {
          lastSavedSig.current = sig;
        })
        .catch(() => {
          /* non-fatal */
        });
    }, 1000);
    return () => clearTimeout(timer);
  }, [syncEnabled, uid, puzzle, entries, pencil, selected, pencilMode, startedAt, loading, solved]);

  // On solved transition: complete + update stats exactly once.
  useEffect(() => {
    if (!syncEnabled || !uid || !puzzle || !solved) return;
    if (completedRef.current) return;
    completedRef.current = true;
    const durationMs = Date.now() - startedAt;
    completeGame(uid, { difficulty: puzzle.difficulty, durationMs, clues: puzzle.clues })
      .then((res) => {
        setStats(res.stats);
        lastSavedSig.current = '';
      })
      .catch(() => {
        completedRef.current = false;
      });
  }, [syncEnabled, uid, solved, puzzle, startedAt]);

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
      stats,
      startedAt,
      uid,
      authLoading,
      firebaseEnabled,
    };
  }, [
    puzzle,
    entries,
    pencil,
    selected,
    pencilMode,
    loading,
    solved,
    stats,
    startedAt,
    uid,
    authLoading,
  ]);

  const enterDigit = useCallback(
    (d: number) => {
      if (!puzzle || solved) return;
      const i = selected;
      if (puzzle.given[i] !== 0) return;
      if (pencilMode) {
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

  const handleSignIn = async () => {
    setSignInError(null);
    try {
      if (usingEmulators) await signInAnonymouslyForEmulator();
      else await signInWithGoogle();
    } catch (err) {
      setSignInError((err as Error).message);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    setStats(null);
    lastSavedSig.current = '';
    // Discard server-cleared current so we don't try to push it under a different user.
    completedRef.current = false;
  };

  const handleNewGameClick = async () => {
    if (syncEnabled && uid && puzzle && !solved) {
      try {
        await clearCurrent(uid);
      } catch {
        /* non-fatal */
      }
    }
    newGame(difficulty);
  };

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
        <div className="header-actions">
          <button
            type="button"
            className="new-game"
            onClick={handleNewGameClick}
            disabled={loading}
          >
            New game
          </button>
          {firebaseEnabled && (
            user ? (
              <button
                type="button"
                className="auth-btn"
                onClick={handleSignOut}
                data-auth="signed-in"
                title={user.email || user.uid}
              >
                Sign out
              </button>
            ) : (
              <button
                type="button"
                className="auth-btn"
                onClick={handleSignIn}
                disabled={authLoading}
                data-auth="signed-out"
              >
                {usingEmulators ? 'Sign in (anon)' : 'Sign in with Google'}
              </button>
            )
          )}
        </div>
        {signInError && <div className="auth-error">{signInError}</div>}
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
              {syncEnabled ? ' · synced' : firebaseEnabled ? ' · local only — sign in to sync' : ''}
            </div>
            {stats && <StatsLine stats={stats} startedAt={startedAt} solved={solved} />}
          </>
        )}
      </main>
    </div>
  );
}

function signatureOf(
  puzzle: Puzzle,
  entries: number[],
  pencil: number[],
  selected: number,
  pencilMode: boolean,
  startedAt: number
): string {
  return JSON.stringify({
    g: puzzle.given,
    s: puzzle.solution,
    d: puzzle.difficulty,
    e: entries,
    p: pencil,
    sel: selected,
    pm: pencilMode,
    sa: startedAt,
  });
}

function StatsLine({
  stats,
  startedAt,
  solved,
}: {
  stats: Stats;
  startedAt: number;
  solved: boolean;
}) {
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    if (solved) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [solved]);
  const elapsed = solved ? null : formatDuration(now - startedAt);
  return (
    <div className="stats">
      {elapsed && <span className="stats-timer">{elapsed}</span>}
      <span className="stats-counts">
        Solved: {stats.totalSolved}
        {DIFFICULTIES.map((d) =>
          stats.byDifficulty[d].solved > 0 ? (
            <span key={d} className="stats-pill">
              {DIFF_LABEL[d]} {stats.byDifficulty[d].solved}
            </span>
          ) : null
        )}
      </span>
    </div>
  );
}
