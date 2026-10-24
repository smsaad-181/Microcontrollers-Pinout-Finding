import { createRequire } from 'node:module';
import { expect, test, type Page } from '@playwright/test';
import {
  chooseWorkedBoard,
  currentCatalog,
  openShared,
  shareHash,
  SOLVE_TIMEOUT,
  WORKED_MODULES,
} from './helpers';

const axeSource = createRequire(import.meta.url).resolve('axe-core/axe.min.js');

interface Violation {
  id: string;
  impact: string | null;
  nodes: { target: unknown[] }[];
}

async function axeViolations(page: Page): Promise<Violation[]> {
  await page.addScriptTag({ path: axeSource });
  return page.evaluate(async () => {
    const axe = (
      window as unknown as { axe: { run: (c: unknown, o: unknown) => Promise<unknown> } }
    ).axe;
    const r = (await axe.run(document, {
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'],
      },
      resultTypes: ['violations'],
    })) as { violations: Violation[] };
    return r.violations;
  });
}

async function expectNoSeriousViolations(page: Page): Promise<void> {
  const v = await axeViolations(page);
  const bad = v.filter((x) => x.impact === 'serious' || x.impact === 'critical');
  expect(
    bad.map((x) => `${x.id} (${x.impact ?? ''}): ${JSON.stringify(x.nodes.map((n) => n.target))}`),
  ).toEqual([]);
}

test.describe('axe', () => {
  // axe-core is injected as an inline script, which the app's strict CSP correctly blocks.
  test.use({ bypassCSP: true, reducedMotion: 'reduce' });
  test('real-browser axe-core: 0 serious or critical on all screens and the module cards', async ({
    page,
  }) => {
    const cat = await currentCatalog(page);
    await openShared(page, shareHash(cat, { modules: WORKED_MODULES, wifi: true }));
    await expect(page.getByText('Pins assigned')).toBeVisible({ timeout: SOLVE_TIMEOUT });
    for (const d of await page.locator('details').all()) {
      await d.evaluate((el) => {
        (el as HTMLDetailsElement).open = true;
      });
    }
    await expectNoSeriousViolations(page); // results, with every disclosure open

    for (const route of ['', '#/board', '#/modules', '#/constraints']) {
      await page.goto(`./${route}`);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(page.getByText('Loading the catalog…')).toHaveCount(0);
      await expectNoSeriousViolations(page);
    }

    await page.goto('./#/modules');
    await page.getByLabel(/Search modules/).fill('bme280');
    await expect(page.getByRole('button', { name: /^Add / }).first()).toBeVisible();
    await expectNoSeriousViolations(page);
  });
});

test('only the app origin is contacted at runtime', async ({ page, baseURL }) => {
  const origin = new URL(baseURL ?? '').origin;
  const seen: string[] = [];
  page.on('request', (r) => {
    if (!r.url().startsWith('data:') && !r.url().startsWith('blob:')) seen.push(r.url());
  });
  const cat = await currentCatalog(page);
  await chooseWorkedBoard(page);
  await openShared(page, shareHash(cat, { modules: WORKED_MODULES, wifi: true }));
  await expect(page.getByText('Pins assigned')).toBeVisible({ timeout: SOLVE_TIMEOUT });
  for (const d of await page.locator('details').all()) {
    await d.evaluate((el) => {
      (el as HTMLDetailsElement).open = true;
    });
  }
  await page.waitForLoadState('networkidle');
  expect(seen.length).toBeGreaterThan(3);
  expect(seen.filter((u) => new URL(u).origin !== origin)).toEqual([]);
});

test('offline reload serves the app and the worked example from the cache', async ({
  page,
  context,
}) => {
  const cat = await currentCatalog(page);
  await page.goto('./');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  // Reload once so the page is controlled by the service worker.
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null))
    .toBe(true);
  await openShared(page, shareHash(cat, { modules: WORKED_MODULES, wifi: true }));
  await expect(page.getByText('Pins assigned')).toBeVisible({ timeout: SOLVE_TIMEOUT });

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Results' })).toBeVisible();
  await expect(page.getByText('Pins assigned')).toBeVisible({ timeout: SOLVE_TIMEOUT });
  await page.goto('./#/board');
  await expect(page.getByRole('button', { name: /ESP32-DevKitC/ }).first()).toBeVisible();
  await context.setOffline(false);
});

test('refresh on every hash route works', async ({ page }) => {
  const cat = await currentCatalog(page);
  const routes: [string, RegExp][] = [
    ['', /Pinout Finder/],
    ['#/board', /Choose your board/],
    ['#/modules', /Add parts/],
    ['#/constraints', /Your rules/],
    ['#/results', /Results/],
    [shareHash(cat, { modules: WORKED_MODULES }), /./],
    ['#/nothing-here', /./],
  ];
  for (const [hash, heading] of routes) {
    await page.goto(`./${hash}`);
    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toContainText(heading);
    await expect(page.locator('#root')).not.toBeEmpty();
  }
  // The share route shows the project, not a blank page or the home page.
  await page.goto(`./${shareHash(cat, { modules: WORKED_MODULES })}`);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Open this project' })).toBeVisible();
  await page.goto('./#/nothing-here');
  await page.reload();
  await expect(page.getByText(/not found|no page/i).first()).toBeVisible();
});

test('keyboard only: board, module, results', async ({ page }) => {
  // Presses Tab until the focused element has this input type, or its text or label matches.
  const tabTo = async (target: string | { input: string }, max = 120): Promise<void> => {
    const spec =
      typeof target === 'string' ? { text: target, input: '' } : { text: '', input: target.input };
    for (let i = 0; i < max; i++) {
      await page.keyboard.press('Tab');
      const hit = await page.evaluate(({ text, input }) => {
        const el = document.activeElement;
        if (el === null) return false;
        if (input !== '') return el instanceof HTMLInputElement && el.type === input;
        return new RegExp(text, 'i').test(el.textContent + (el.getAttribute('aria-label') ?? ''));
      }, spec);
      if (hit) return;
    }
    throw new Error(`keyboard focus never reached the target in ${String(max)} tabs`);
  };

  await page.goto('./');
  await expect(page.getByRole('link', { name: /Start: choose a board/ })).toBeVisible();
  await tabTo('Start: choose a board');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { level: 1, name: 'Choose your board' })).toBeFocused();

  // Board card button opens the version radios; Tab lands in the group, arrows or Space choose.
  await tabTo('Use this board ESP32-DevKitC V4');
  await page.keyboard.press('Enter');
  await tabTo({ input: 'radio' });
  for (let i = 0; i < 12; i++) {
    const label = await page.evaluate(
      () => (document.activeElement as HTMLInputElement).closest('label')?.textContent ?? '',
    );
    if (label.includes('ESP32-WROOM-32E')) break;
    await page.keyboard.press('ArrowDown');
  }
  await page.keyboard.press('Space');
  await expect(page.getByRole('heading', { name: 'Selected' })).toBeVisible();
  await tabTo('Next: add parts');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { level: 1, name: 'Add parts' })).toBeFocused();

  await tabTo({ input: 'search' });
  await page.keyboard.type('bme280');
  await tabTo('Add ');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: /Your parts \(1\)/ })).toBeVisible();

  await tabTo('Get my pins');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { level: 1, name: 'Results' })).toBeFocused();
  await expect(page.getByText('Pins assigned')).toBeVisible({ timeout: SOLVE_TIMEOUT });
  // Disclosures open from the keyboard.
  await tabTo('Why|Sources', 400);
  await page.keyboard.press('Enter');
  await expect(page.locator('details[open]').first()).toBeVisible();
});

test.describe('axe, dark scheme', () => {
  test.use({ bypassCSP: true, colorScheme: 'dark', reducedMotion: 'reduce' });
  test('dark scheme: 0 serious or critical (contrast included) on the main screens', async ({
    page,
  }) => {
    for (const route of ['', '#/board', '#/modules', '#/constraints']) {
      await page.goto(`./${route}`);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(page.getByText('Loading the catalog…')).toHaveCount(0);
      await expectNoSeriousViolations(page);
    }
  });
});
