import { expect, test } from '@playwright/test';
import {
  clickCell,
  getState,
  pressDigit,
  resetEmulator,
  signIn,
  signOutViaUi,
  waitForPuzzle,
} from './helpers';

test.beforeEach(async () => {
  await resetEmulator();
});

test('app loads in local-only mode when signed out', async ({ page }) => {
  await page.goto('/');
  const state = await waitForPuzzle(page);
  expect(state.firebaseEnabled).toBe(true);
  expect(state.uid).toBeNull();
  expect(state.puzzle).not.toBeNull();
  // Sign-in button visible; sign-out button not.
  await expect(page.locator('[data-auth="signed-out"]')).toBeVisible();
  await expect(page.locator('[data-auth="signed-in"]')).toHaveCount(0);
});

test('signing in fetches an empty state from Firestore', async ({ page }) => {
  await page.goto('/');
  await waitForPuzzle(page);
  await signIn(page);

  const state = await getState(page);
  expect(state.uid).not.toBeNull();
  expect(state.stats).not.toBeNull();
  expect(state.stats!.totalSolved).toBe(0);
  await expect(page.locator('[data-auth="signed-in"]')).toBeVisible();
});

test('solving a game increments stats in Firestore', async ({ page }) => {
  await page.goto('/');
  await waitForPuzzle(page);
  await signIn(page);

  // After signing in the app refreshes state — wait for the puzzle again.
  const state = await waitForPuzzle(page);
  const { given, solution, difficulty } = state.puzzle!;

  for (let i = 0; i < 81; i++) {
    if (given[i] !== 0) continue;
    await clickCell(page, i);
    await pressDigit(page, solution[i]);
  }

  await expect(page.locator('.solved-banner')).toHaveText('Solved!');
  // Wait for the completion transaction to settle and stats to reflect.
  await expect
    .poll(async () => (await getState(page)).stats?.totalSolved ?? 0, { timeout: 10_000 })
    .toBe(1);
  const after = await getState(page);
  expect(after.stats!.byDifficulty[difficulty].solved).toBe(1);
  expect(after.stats!.byDifficulty[difficulty].bestMs).toBeGreaterThan(0);
});

test('in-progress game is persisted and restored on reload', async ({ page }) => {
  await page.goto('/');
  await waitForPuzzle(page);
  await signIn(page);
  const state = await waitForPuzzle(page);
  const { given } = state.puzzle!;
  const empty = given.findIndex((v) => v === 0);

  await clickCell(page, empty);
  await pressDigit(page, given[empty] === 5 ? 6 : 5);

  // Auto-save fires ~1s after the last edit; give it a beat.
  const entryValue = (await getState(page)).entries[empty];
  expect(entryValue).not.toBe(0);
  await page.waitForTimeout(1500);

  await page.reload();
  // Same browser context retains the auth cookie, so we land authenticated.
  const restored = await waitForPuzzle(page);
  expect(restored.uid).not.toBeNull();
  expect(restored.entries[empty]).toBe(entryValue);
  expect(restored.puzzle!.given).toEqual(given);
});

test('signing out clears the sign-in indicator', async ({ page }) => {
  await page.goto('/');
  await waitForPuzzle(page);
  await signIn(page);
  await signOutViaUi(page);
  await expect(page.locator('[data-auth="signed-out"]')).toBeVisible();
  const state = await getState(page);
  expect(state.uid).toBeNull();
});
