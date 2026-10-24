import { expect, test } from '@playwright/test';
import {
  addModule,
  addWorkedModules,
  allocation,
  chooseWorkedBoard,
  currentCatalog,
  evidenceUrls,
  openShared,
  shareHash,
  SOLVE_TIMEOUT,
  WORKED_MODULES,
} from './helpers';

const INPUT_ONLY = ['GPIO34', 'GPIO35', 'GPIO36', 'GPIO39'];

test('worked example end to end matches the engine fixture', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('link', { name: /Start: choose a board/ }).click();
  await chooseWorkedBoard(page);
  await addWorkedModules(page);
  await expect(page.getByRole('heading', { name: /Modules in this project \(8\)/ })).toBeVisible();

  await page.goto('./#/constraints');
  await page.getByLabel(/This project uses Wi-Fi/).check();
  await page.goto('./#/results');
  await expect(page.getByText('Pins assigned')).toBeVisible({ timeout: SOLVE_TIMEOUT });

  const a = await allocation(page);
  const pads = (suffix: string): string[] =>
    Object.entries(a)
      .filter(([k]) => k.endsWith(suffix))
      .map(([, v]) => v);
  // Fixture exact pins: the shared SPI3 IO_MUX lines.
  expect(pads('.SCLK')).toContain('GPIO18');
  expect(pads('.MOSI')).toContain('GPIO23');
  expect(pads('.MISO')).toContain('GPIO19');
  // Fixture property all_used and no_pad_in.
  const used = new Set(Object.values(a));
  for (const p of [16, 17, 18, 19, 21, 22, 23, 25, 26, 27, 32, 33]) {
    expect(used.has(`GPIO${String(p)}`), `GPIO${String(p)} used`).toBe(true);
  }
  for (const p of [6, 7, 8, 9, 10, 11, 1, 3]) expect(used.has(`GPIO${String(p)}`)).toBe(false);
  // Fixture: switches on the input-only pads, no output on them.
  const sw = Object.entries(a).filter(([k]) => /push_button.*\.SW/.test(k));
  expect(sw).toHaveLength(4);
  for (const [, v] of sw) expect(INPUT_ONLY).toContain(v);
  const outputs = Object.entries(a).filter(([k]) => !k.startsWith('push_button'));
  for (const [, v] of outputs) expect(INPUT_ONLY).not.toContain(v);
  // Fixture warnings.
  for (const code of ['I2C_PULLUP_UNKNOWN', 'FLOATING_AT_RESET_LOAD', 'RAIL_BUDGET_UNKNOWN']) {
    await expect(page.locator('ul.warnings').getByText(code, { exact: true })).toBeVisible();
  }
  await expect(page.getByRole('heading', { name: 'Before you wire anything' })).toBeVisible();
});

test('every citation link is a URL listed in the evidence records', async ({ page }) => {
  const cat = await currentCatalog(page);
  await openShared(page, shareHash(cat, { modules: WORKED_MODULES, wifi: true }));
  await expect(page.getByText('Pins assigned')).toBeVisible({ timeout: SOLVE_TIMEOUT });
  for (const d of await page.locator('details').all()) {
    await d.evaluate((el) => {
      (el as HTMLDetailsElement).open = true;
    });
  }
  const hrefs = await page
    .locator('.citations a')
    .evaluateAll((as) => as.map((x) => x.getAttribute('href') ?? ''));
  expect(hrefs.length).toBeGreaterThan(10);
  const allowed = evidenceUrls();
  expect(allowed.size).toBeGreaterThan(20);
  expect([...new Set(hrefs)].filter((h) => !allowed.has(h))).toEqual([]);
});

test('every board version of a part is its own card', async ({ page }) => {
  await page.goto('./#/modules');
  await page.getByLabel(/Search modules/).fill('bme280');
  const cards = page.getByRole('list', { name: 'Search results' }).getByRole('listitem');
  await expect(cards).toHaveCount(3);
  await expect(cards.first()).toContainText('version 1 of 3');
  await expect(page.getByText('No modules yet')).toBeVisible();
  await cards
    .filter({ hasText: /Adafruit/ })
    .getByRole('button')
    .click();
  await expect(page.getByRole('heading', { name: /Modules in this project \(1\)/ })).toBeVisible();
  await addModule(page, 'rc522');
  await expect(page.getByRole('heading', { name: /Modules in this project \(2\)/ })).toBeVisible();
});

test('share link round trip gives the same allocation in a fresh browser', async ({
  page,
  browser,
}) => {
  await chooseWorkedBoard(page);
  await addWorkedModules(page);
  await page.goto('./#/results');
  await expect(page.getByText('Pins assigned')).toBeVisible({ timeout: SOLVE_TIMEOUT });
  const before = await allocation(page);
  await page.getByRole('button', { name: 'Copy share link' }).click();
  const link = await page.getByLabel(/Share link/).inputValue();
  expect(link).toContain('#/p/');

  const other = await browser.newContext();
  const p2 = await other.newPage();
  await p2.goto(link);
  await expect(p2.getByRole('heading', { name: /shared|project/i }).first()).toBeVisible();
  await p2.getByRole('button', { name: 'Open this project' }).click();
  await p2.goto(new URL('./#/results', link).toString());
  await expect(p2.getByText('Pins assigned')).toBeVisible({ timeout: SOLVE_TIMEOUT });
  expect(await allocation(p2)).toEqual(before);
  await other.close();
});

test('unsatisfiable project shows the conflict and the fixes', async ({ page }) => {
  const cat = await currentCatalog(page);
  await openShared(
    page,
    shareHash(cat, {
      modules: [{ breakout: 'potentiometer-10k', instance: 'pot' }],
      locked: [{ instance: 'pot', role: 'WIPER', pad: 'GPIO25' }],
      wifi: true,
    }),
  );
  await expect(page.getByRole('heading', { name: /No safe assignment/ })).toBeVisible({
    timeout: SOLVE_TIMEOUT,
  });
  await expect(page.getByText('locked:pot.WIPER=GPIO25')).toBeVisible();
  await expect(page.getByText('adc2-wifi:GPIO25')).toBeVisible();
  await expect(page.getByText('unlock:pot.WIPER')).toBeVisible();
});
