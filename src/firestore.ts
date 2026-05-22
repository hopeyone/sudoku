import {
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  limit as fbLimit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  type DocumentData,
} from 'firebase/firestore';
import { getFirebase } from './firebase';
import type { Puzzle } from './sudoku/generator';
import { DIFFICULTIES, type Difficulty } from './sudoku/rate';

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

function defaultStats(): Stats {
  const byDifficulty = {} as Stats['byDifficulty'];
  for (const d of DIFFICULTIES) byDifficulty[d] = { solved: 0, bestMs: null };
  return { byDifficulty, totalSolved: 0 };
}

function userDoc(uid: string) {
  return doc(getFirebase().db, 'users', uid);
}

function historyCollection(uid: string) {
  return collection(getFirebase().db, 'users', uid, 'history');
}

export async function fetchState(
  uid: string
): Promise<{ current: CurrentGameDTO | null; stats: Stats }> {
  const snap = await getDoc(userDoc(uid));
  if (!snap.exists()) return { current: null, stats: defaultStats() };
  const data = snap.data() as DocumentData;
  const current = (data.currentGame ?? null) as CurrentGameDTO | null;
  const stats = (data.stats ?? defaultStats()) as Stats;
  return { current, stats };
}

export async function saveCurrent(uid: string, game: CurrentGameDTO): Promise<void> {
  await setDoc(
    userDoc(uid),
    { currentGame: { ...game, updatedAt: Date.now() }, lastTouched: serverTimestamp() },
    { merge: true }
  );
}

export async function clearCurrent(uid: string): Promise<void> {
  await setDoc(userDoc(uid), { currentGame: deleteField() }, { merge: true });
}

// Atomic completion: write a history doc, update the stats object, and clear
// currentGame — all in one transaction so partial failures can't leave the
// stats out of sync with history.
export async function completeGame(
  uid: string,
  input: { difficulty: Difficulty; durationMs: number; clues: number }
): Promise<{ stats: Stats; item: HistoryItem }> {
  const userRef = userDoc(uid);
  const historyRef = doc(historyCollection(uid));

  return runTransaction(getFirebase().db, async (tx) => {
    const snap = await tx.get(userRef);
    const prevStats: Stats =
      snap.exists() && snap.data().stats ? (snap.data().stats as Stats) : defaultStats();

    const prevSlot = prevStats.byDifficulty[input.difficulty];
    const nextStats: Stats = {
      totalSolved: prevStats.totalSolved + 1,
      byDifficulty: {
        ...prevStats.byDifficulty,
        [input.difficulty]: {
          solved: prevSlot.solved + 1,
          bestMs:
            prevSlot.bestMs === null
              ? input.durationMs
              : Math.min(prevSlot.bestMs, input.durationMs),
        },
      },
    };

    const item: HistoryItem = {
      id: historyRef.id,
      difficulty: input.difficulty,
      durationMs: input.durationMs,
      clues: input.clues,
      completedAt: Date.now(),
    };

    tx.set(historyRef, { ...item, completedAtServer: serverTimestamp() });
    tx.set(
      userRef,
      { stats: nextStats, currentGame: deleteField(), lastTouched: serverTimestamp() },
      { merge: true }
    );

    return { stats: nextStats, item };
  });
}

export async function fetchHistory(uid: string, count = 50): Promise<HistoryItem[]> {
  const q = query(historyCollection(uid), orderBy('completedAt', 'desc'), fbLimit(count));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data() as DocumentData;
    return {
      id: d.id,
      difficulty: data.difficulty as Difficulty,
      durationMs: data.durationMs as number,
      clues: data.clues as number,
      completedAt:
        data.completedAt instanceof Timestamp
          ? data.completedAt.toMillis()
          : (data.completedAt as number),
    };
  });
}

