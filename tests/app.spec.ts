import { expect, test } from '@playwright/test';
import { cell, clickCell, expectSelected, getState, pressKey, waitForPuzzle } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await waitForPuzzle(page);
});

test('boots with 81 cells and a generated easy puzzle', async ({ page }) => {
  await expect(page.locator('[data-cell]')).toHaveCount(81);
  const state = await getState(page);
  expect(state.puzzle).not.toBeNull();
  expect(state.puzzle!.difficulty).toBe('easy');
  expect(state.puzzle!.clues).toBeGreaterThanOrEqual(30);
  // Number of given cells in the DOM should match clue count.
  const givens = await page.locator('[data-given="1"]').count();
  expect(givens).toBe(state.puzzle!.clues);
});

test('clicking a cell selects it', async ({ page }) => {
  await clickCell(page, 12);
  await expectSelected(page, 12);
  await expect(cell(page, 12)).toHaveClass(/\bselected\b/);
});

test('arrow keys move selection within bounds', async ({ page }) => {
  await clickCell(page, 40); // center
  await expectSelected(page, 40);

  await pressKey(page, 'ArrowRight');
  await expectSelected(page, 41);
  await pressKey(page, 'ArrowDown');
  await expectSelected(page, 50);
  await pressKey(page, 'ArrowLeft');
  await expectSelected(page, 49);
  await pressKey(page, 'ArrowUp');
  await expectSelected(page, 40);

  // Bounds: top-left corner shouldn't move past edges.
  await clickCell(page, 0);
  await pressKey(page, 'ArrowUp');
  await expectSelected(page, 0);
  await pressKey(page, 'ArrowLeft');
  await expectSelected(page, 0);
});

test('switching difficulty starts a new game at that level', async ({ page }) => {
  await page.getByRole('button', { name: 'Hard' }).click();
  await waitForPuzzle(page);
  const state = await getState(page);
  expect(state.puzzle!.difficulty).toBe('hard');
  // Entries cleared on new game.
  expect(state.entries.every((v) => v === 0)).toBe(true);
});

test('"New game" button regenerates the same difficulty', async ({ page }) => {
  const before = (await getState(page)).puzzle!;
  await page.getByRole('button', { name: 'New game' }).click();
  await waitForPuzzle(page);
  const after = (await getState(page)).puzzle!;
  expect(after.difficulty).toBe(before.difficulty);
  // Astronomically unlikely to be the same grid, but assert just on difficulty + clues range.
  expect(after.clues).toBeGreaterThanOrEqual(30);
});
