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
}

declare global {
  interface Window {
    __sudoku?: SudokuState;
  }
}

export async function waitForPuzzle(page: Page): Promise<SudokuState> {
  await page.waitForFunction(() => {
    const s = window.__sudoku;
    return !!(s && s.puzzle && !s.loading);
  }, undefined, { timeout: 30_000 });
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
