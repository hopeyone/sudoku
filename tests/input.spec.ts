import { expect, test } from '@playwright/test';
import { cell, clickCell, getState, pressDigit, pressKey, waitForPuzzle } from './helpers';

async function findEmptyCell(page: import('@playwright/test').Page): Promise<number> {
  const state = await getState(page);
  for (let i = 0; i < 81; i++) if (state.puzzle!.given[i] === 0) return i;
  throw new Error('no empty cells');
}

async function findGivenCell(page: import('@playwright/test').Page): Promise<number> {
  const state = await getState(page);
  for (let i = 0; i < 81; i++) if (state.puzzle!.given[i] !== 0) return i;
  throw new Error('no given cells');
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await waitForPuzzle(page);
});

test('typing a digit fills the selected empty cell', async ({ page }) => {
  const i = await findEmptyCell(page);
  await clickCell(page, i);
  await pressDigit(page, 5);
  await expect.poll(async () => (await getState(page)).entries[i]).toBe(5);
  await expect(cell(page, i)).toContainText('5');
});

test('pressing the same digit again clears the cell (toggle)', async ({ page }) => {
  const i = await findEmptyCell(page);
  await clickCell(page, i);
  await pressDigit(page, 7);
  await expect.poll(async () => (await getState(page)).entries[i]).toBe(7);
  await pressDigit(page, 7);
  await expect.poll(async () => (await getState(page)).entries[i]).toBe(0);
});

test('Backspace clears entries and pencil marks', async ({ page }) => {
  const i = await findEmptyCell(page);
  await clickCell(page, i);
  await pressDigit(page, 3);
  await expect.poll(async () => (await getState(page)).entries[i]).toBe(3);
  await pressKey(page, 'Backspace');
  await expect.poll(async () => (await getState(page)).entries[i]).toBe(0);
});

test('given cells are immutable', async ({ page }) => {
  const i = await findGivenCell(page);
  const before = await getState(page);
  const givenValue = before.puzzle!.given[i];
  await clickCell(page, i);
  // Try to overwrite with a different digit.
  const other = givenValue === 9 ? 1 : givenValue + 1;
  await pressDigit(page, other);
  const after = await getState(page);
  expect(after.entries[i]).toBe(0);
  expect(after.puzzle!.given[i]).toBe(givenValue);
  await expect(cell(page, i)).toHaveClass(/\bgiven\b/);
});

test('P toggles pencil mode and digits become pencil marks', async ({ page }) => {
  const i = await findEmptyCell(page);
  await clickCell(page, i);
  await pressKey(page, 'p');
  await expect.poll(async () => (await getState(page)).pencilMode).toBe(true);

  await pressDigit(page, 4);
  await pressDigit(page, 8);
  const state = await getState(page);
  // Bit (d-1) for digit d.
  expect(state.pencil[i] & (1 << 3)).not.toBe(0); // 4
  expect(state.pencil[i] & (1 << 7)).not.toBe(0); // 8
  expect(state.entries[i]).toBe(0);

  // Toggle off — digits go back to entries.
  await pressKey(page, 'p');
  await expect.poll(async () => (await getState(page)).pencilMode).toBe(false);
  await pressDigit(page, 6);
  await expect.poll(async () => (await getState(page)).entries[i]).toBe(6);
  // Entering a value clears pencil marks for that cell.
  await expect.poll(async () => (await getState(page)).pencil[i]).toBe(0);
});

test('number pad: clicking a digit fills the cell', async ({ page }) => {
  const i = await findEmptyCell(page);
  await clickCell(page, i);
  await page.locator('.pad-digit', { hasText: /^2$/ }).click();
  await expect.poll(async () => (await getState(page)).entries[i]).toBe(2);
});

test('number pad: pencil toggle and erase work', async ({ page }) => {
  const i = await findEmptyCell(page);
  await clickCell(page, i);

  await page.locator('.pad-toggle').click();
  await expect.poll(async () => (await getState(page)).pencilMode).toBe(true);
  await page.locator('.pad-digit', { hasText: /^9$/ }).click();
  await expect.poll(async () => (await getState(page)).pencil[i] & (1 << 8)).not.toBe(0);

  // Turn off pencil, fill a value, then erase via pad.
  await page.locator('.pad-toggle').click();
  await page.locator('.pad-digit', { hasText: /^1$/ }).click();
  await expect.poll(async () => (await getState(page)).entries[i]).toBe(1);
  await page.locator('.pad-erase').click();
  await expect.poll(async () => (await getState(page)).entries[i]).toBe(0);
  await expect.poll(async () => (await getState(page)).pencil[i]).toBe(0);
});
