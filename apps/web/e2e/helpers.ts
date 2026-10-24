import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, type Page } from '@playwright/test';
import lz from 'lz-string';

/** Board and variant of golden fixture devkitc-v4-wroom-bme280-rc522-st7735s-relays-switches. */
export const BOARD = { ref: 'esp32-devkitc-v4@V4', variant: 'esp32-devkitc-32e' };

export const WORKED_MODULES = [
  { breakout: 'gy-bme280-6pin', instance: 'env' },
  { breakout: 'rfid-rc522-blue', instance: 'rfid' },
  { breakout: 'st7735s-1.8-spi-tft', instance: 'tft' },
  { breakout: 'relay-board-4ch-transistor', instance: 'relays' },
  { breakout: 'push-button', instance: 'sw1' },
  { breakout: 'push-button', instance: 'sw2' },
  { breakout: 'push-button', instance: 'sw3' },
  { breakout: 'push-button', instance: 'sw4' },
];

export const SOLVE_TIMEOUT = 30_000;

/** The catalog pin the preview server serves (what the app itself loads). */
export async function currentCatalog(page: Page): Promise<{ version: string; sha256: string }> {
  const r = await page.request.get('catalog/catalog-manifest.json');
  const m = (await r.json()) as { version: string; sha256: string };
  return { version: m.version, sha256: m.sha256 };
}

/** A share-link hash for a project (same format the app writes). */
export function shareHash(
  catalog: { version: string; sha256: string },
  project: {
    modules: { breakout: string; instance: string }[];
    locked?: { instance: string; role: string; pad: string }[];
    wifi?: boolean;
  },
): string {
  const file = {
    format: 'pinout-finder-project',
    version: 1,
    catalog,
    project: {
      board: BOARD.ref,
      variant: BOARD.variant,
      modules: project.modules,
      locked: project.locked ?? [],
      reserved: [],
      wifi: project.wifi ?? false,
    },
  };
  return `#/p/${lz.compressToEncodedURIComponent(JSON.stringify(file))}`;
}

/** Opens a share link and accepts it, then shows the results screen. */
export async function openShared(page: Page, hash: string): Promise<void> {
  await page.goto(`./${hash}`);
  await page.getByRole('button', { name: 'Open this project' }).click();
  await page.goto('./#/results');
}

/** Every URL listed in the catalog evidence records (`url` and `url_original`). */
export function evidenceUrls(): Set<string> {
  const dir = resolve(import.meta.dirname, '../../../catalog/evidence');
  const urls = new Set<string>();
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.yaml'))) {
    for (const line of readFileSync(resolve(dir, f), 'utf8').split('\n')) {
      const m = /^url(?:_original)?:\s*"?(https?:\/\/[^"\s]+)"?\s*$/.exec(line);
      if (m?.[1] !== undefined) urls.add(m[1]);
    }
  }
  return urls;
}

export async function chooseWorkedBoard(page: Page): Promise<void> {
  await page.goto('./#/board');
  await page.getByRole('radio', { name: /ESP32-DevKitC.*esp32-devkitc-32e/s }).check();
  await expect(page.getByRole('heading', { name: 'Selected' })).toBeVisible();
}

/** Searches for a part and adds it; when several boards carry it, picks the variant by its pins. */
export async function addModule(page: Page, query: string, variantPins?: RegExp): Promise<void> {
  await page.getByLabel(/Search modules/).fill(query);
  const group = page.getByRole('list', { name: 'Search results' }).getByRole('listitem').first();
  await group.getByRole('button').click();
  if (variantPins !== undefined) {
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('radio', { name: variantPins }).check();
    await dialog.getByRole('button', { name: 'Add this board' }).click();
    await expect(dialog).toBeHidden();
  }
}

export async function addWorkedModules(page: Page): Promise<void> {
  await page.goto('./#/modules');
  await addModule(page, 'bme280', /VCC, GND, SCL, SDA, CSB, SDO/);
  await addModule(page, 'rc522');
  await addModule(page, 'st7735');
  await addModule(page, 'relay', /transistor|keyestudio/i);
  for (let i = 0; i < 4; i++) await addModule(page, 'push button');
}

/** The allocation table as { "instance.role": "GPIOn" }. */
export async function allocation(page: Page): Promise<Record<string, string>> {
  const rows = page.getByRole('region', { name: /Pin allocation table/ }).locator('tbody tr');
  const out: Record<string, string> = {};
  for (const row of await rows.all()) {
    const cells = await row.locator('td').allInnerTexts();
    out[`${cells[0] ?? ''}.${cells[1] ?? ''}`] = (cells[2] ?? '').split(' ')[0] ?? '';
  }
  return out;
}
