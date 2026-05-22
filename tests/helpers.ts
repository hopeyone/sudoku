import { Page, expect } from '@playwright/test';

export interface SudokuState {
  puzzle: {
    given: number[];
    solution: number[];
    difficulty: 'easy' | 'medium' | 'hard' | 'expert';
    clues: number;
  } | null;
  entries: number[];
  pencil: number[];
  selected: number;
  pencilMode: boolean;
  loading: boolean;
  solved: boolean;
  stats: {
    byDifficulty: Record<string, { solved: number; bestMs: number | null }>;
    totalSolved: number;
  } | null;
  startedAt: number;
  uid: string | null;
  authLoading: boolean;
  firebaseEnabled: boolean;
}

declare global {
  interface Window {
    __sudoku?: SudokuState;
  }
}

const FIREBASE_PROJECT = 'sudoku-emulator';
const FIRESTORE_EMULATOR = 'http://localhost:8080';
const AUTH_EMULATOR = 'http://localhost:9099';

export async function waitForPuzzle(page: Page): Promise<SudokuState> {
  await page.waitForFunction(
    () => {
      const s = window.__sudoku;
      return !!(s && !s.authLoading && s.puzzle && !s.loading);
    },
    undefined,
    { timeout: 30_000 }
  );
  return getState(page);
}

export async function waitForAuthReady(page: Page): Promise<SudokuState> {
  await page.waitForFunction(
    () => {
      const s = window.__sudoku;
      return !!(s && !s.authLoading);
    },
    undefined,
    { timeout: 30_000 }
  );
  return getState(page);
}

export async function getState(page: Page): Promise<SudokuState> {
  const s = await page.evaluate(() => window.__sudoku);
  if (!s) throw new Error('window.__sudoku is not set — is the dev server in DEV mode?');
  return s;
}

export function cell(page: Page, i: number) {
  return page.locator(`[data-cell="${i}"]`);
}

export async function clickCell(page: Page, i: number) {
  await cell(page, i).click();
}

export async function pressDigit(page: Page, d: number) {
  await page.keyboard.press(String(d));
}

export async function pressKey(page: Page, key: string) {
  await page.keyboard.press(key);
}

export async function expectSelected(page: Page, i: number) {
  await expect.poll(async () => (await getState(page)).selected).toBe(i);
}

// Sign in via the on-page button. In emulator mode this performs an anonymous
// sign-in (see firebase.ts), giving each test a fresh UID.
export async function signIn(page: Page) {
  await page.locator('[data-auth="signed-out"]').click();
  // Wait until the init effect has resolved post-sign-in: uid set AND stats
  // hydrated from Firestore. Without the stats wait we'd race the test against
  // the initial fetchState.
  await page.waitForFunction(
    () => !!window.__sudoku?.uid && window.__sudoku?.stats !== null,
    undefined,
    { timeout: 10_000 }
  );
}

export async function signOutViaUi(page: Page) {
  await page.locator('[data-auth="signed-in"]').click();
  await page.waitForFunction(() => !window.__sudoku?.uid, undefined, { timeout: 10_000 });
}

// Reset all data in the Firebase Auth + Firestore emulators. Run between tests
// so that one spec can't contaminate another's user accounts or documents.
export async function resetEmulator() {
  await fetch(
    `${FIRESTORE_EMULATOR}/emulator/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents`,
    { method: 'DELETE' }
  );
  await fetch(`${AUTH_EMULATOR}/emulator/v1/projects/${FIREBASE_PROJECT}/accounts`, {
    method: 'DELETE',
  });
}
