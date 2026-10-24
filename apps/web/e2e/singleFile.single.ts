// The single-file build (dist-single/pinout-finder.html) opened from file://, as a user would by
// double-clicking it: the worked example solves, nothing is requested from anywhere, no console errors.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import { SINGLE_FILE } from '../playwright.single.config';
import { addModule, allocation, SOLVE_TIMEOUT } from './helpers';

/** Records every request and every console error / uncaught exception of the page. */
function watch(page: Page): { requests: string[]; errors: string[] } {
  const requests: string[] = [];
  const errors: string[] = [];
  page.on('request', (r) => requests.push(r.url()));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  return { requests, errors };
}

/** The worked example (golden fixture devkitc-v4-wroom-bme280-rc522-st7735s-relays-switches). */
async function solveWorkedExample(page: Page): Promise<Record<string, string>> {
  await page.goto(SINGLE_FILE);
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
  await page.getByRole('link', { name: /Start: choose a board/ }).click();
  await page.getByRole('radio', { name: /ESP32-DevKitC.*esp32-devkitc-32e/s }).check();
  await expect(page.getByRole('heading', { name: 'Selected' })).toBeVisible();
  await page.goto(`${SINGLE_FILE}#/modules`);
  await addModule(page, 'bme280', /VCC, GND, SCL, SDA, CSB, SDO/);
  await addModule(page, 'rc522');
  await addModule(page, 'st7735');
  await addModule(page, 'relay', /transistor|keyestudio/i);
  for (let i = 0; i < 4; i++) await addModule(page, 'push button');
  await expect(page.getByRole('heading', { name: /Modules in this project \(8\)/ })).toBeVisible();
  await page.goto(`${SINGLE_FILE}#/constraints`);
  await page.getByLabel(/This project uses Wi-Fi/).check();
  await page.goto(`${SINGLE_FILE}#/results`);
  await expect(page.getByText('Pins assigned')).toBeVisible({ timeout: SOLVE_TIMEOUT });
  return allocation(page);
}

function expectWorkedPins(a: Record<string, string>): void {
  const pads = (suffix: string): string[] =>
    Object.entries(a)
      .filter(([k]) => k.endsWith(suffix))
      .map(([, v]) => v);
  expect(pads('.SCLK')).toContain('GPIO18');
  expect(pads('.MOSI')).toContain('GPIO23');
  expect(pads('.MISO')).toContain('GPIO19');
  const sw = Object.entries(a).filter(([k]) => /push_button.*\.SW/.test(k));
  expect(sw).toHaveLength(4);
}

/** Only the page itself, and the blob: worker made from it, may be loaded. */
function expectNoRequests(requests: readonly string[]): void {
  const others = requests.filter((u) => u.split('#')[0] !== SINGLE_FILE && !u.startsWith('blob:'));
  expect(others).toEqual([]);
}

test('worked example solves from file:// in a blob worker, offline, with no requests', async ({
  page,
  context,
}) => {
  await context.setOffline(true);
  const seen = watch(page);
  const workers: string[] = [];
  page.on('worker', (w) => workers.push(w.url()));
  expectWorkedPins(await solveWorkedExample(page));
  expect(workers.length).toBeGreaterThan(0);
  expect(workers.every((u) => u.startsWith('blob:'))).toBe(true);
  // file:// has no service workers at all; the page must not even try to register one.
  expect(readFileSync(fileURLToPath(SINGLE_FILE), 'utf8')).not.toContain('serviceWorker');
  expectNoRequests(seen.requests);
  expect(seen.errors).toEqual([]);
});

test('without Web Workers the engine runs on the main thread with the same result', async ({
  page,
}) => {
  await page.addInitScript(() => {
    // As a browser that refuses workers on file:// would: the constructor throws.
    Object.defineProperty(window, 'Worker', {
      value: function BlockedWorker(): never {
        throw new Error('Workers are blocked here');
      },
    });
  });
  const seen = watch(page);
  expectWorkedPins(await solveWorkedExample(page));
  expectNoRequests(seen.requests);
  expect(seen.errors).toEqual([]);
});

test('hash routes load directly', async ({ page }) => {
  const seen = watch(page);
  await page.goto(`${SINGLE_FILE}#/board`);
  await expect(page.getByRole('radio', { name: /ESP32-DevKitC/ }).first()).toBeVisible();
  expectNoRequests(seen.requests);
  expect(seen.errors).toEqual([]);
});
