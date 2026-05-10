import { expect, test } from '@playwright/test';
import { clickCell, getState, pressDigit, waitForPuzzle } from './helpers';

test('filling every empty cell with the solution shows the Solved! banner', async ({ page }) => {
  test.slow(); // 81 cell ops takes a moment in a browser
  await page.goto('/');
  const state = await waitForPuzzle(page);
  const { given, solution } = state.puzzle!;

  for (let i = 0; i < 81; i++) {
    if (given[i] !== 0) continue;
    await clickCell(page, i);
    await pressDigit(page, solution[i]);
  }

  await expect(page.locator('.solved-banner')).toHaveText('Solved!');
  await expect.poll(async () => (await getState(page)).solved).toBe(true);
});

test('partial entries do not show the Solved! banner', async ({ page }) => {
  await page.goto('/');
  const state = await waitForPuzzle(page);
  const { given, solution } = state.puzzle!;

  // Fill all but one empty cell correctly.
  let lastEmpty = -1;
  for (let i = 0; i < 81; i++) if (given[i] === 0) lastEmpty = i;
  for (let i = 0; i < 81; i++) {
    if (given[i] !== 0 || i === lastEmpty) continue;
    await clickCell(page, i);
    await pressDigit(page, solution[i]);
  }

  await expect(page.locator('.solved-banner')).toHaveCount(0);
  expect((await getState(page)).solved).toBe(false);
});
