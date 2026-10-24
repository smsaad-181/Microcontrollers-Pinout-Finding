import { compressToEncodedURIComponent } from 'lz-string';
import { describe, expect, it } from 'vitest';
import { draftReducer, EMPTY_DRAFT, type ProjectDraft } from '../src/project/draft';
import {
  decodeShare,
  encodeShare,
  MAX_SHARE_LENGTH,
  projectFileText,
  readProjectFile,
  shareUrl,
  toProjectFile,
} from '../src/project/projectFile';
import { parseHashRoute } from '../src/route';

const sha = 'ee866a322554820d2a4a8c8888566e654a5bb74ee4ce5d547712c85c9b67cc35';
const latest = { version: '21f71471a3f0', sha256: sha };

let draft: ProjectDraft = draftReducer(EMPTY_DRAFT, {
  type: 'select-board',
  board: 'esp32-devkitc-v4@V4',
  variant: 'esp32-devkitc-32e',
});
draft = draftReducer(draft, { type: 'add-module', breakout: 'gy-bme280-6pin', base: 'env' });
draft = draftReducer(draft, { type: 'set-wifi', wifi: true });
draft = draftReducer(draft, { type: 'add-connection', connection: { pad: 'GPIO2', note: 'LED' } });

describe('share links', () => {
  it('round-trip the project with the catalog pinned, through the hash route', () => {
    const payload = encodeShare(toProjectFile(draft, latest));
    const url = shareUrl('https://x.github.io/repo/#/results', payload);
    expect(url.startsWith('https://x.github.io/repo/#/p/')).toBe(true);
    const route = parseHashRoute(url.slice(url.indexOf('#')));
    expect(route.name).toBe('shared');
    if (route.name !== 'shared') return;
    const read = decodeShare(route.data);
    expect(read).toEqual({ ok: true, draft: { ...draft, catalogPin: latest }, catalog: latest });
  });

  it('keep an existing pin (a re-shared older project stays on its catalog)', () => {
    const old = { version: 'aaaaaaaaaaaa', sha256: 'b'.repeat(64) };
    const read = decodeShare(encodeShare(toProjectFile({ ...draft, catalogPin: old }, latest)));
    expect(read.ok && read.catalog).toEqual(old);
  });

  it.each([
    ['garbage', 'not-a-link'],
    ['empty JSON', compressToEncodedURIComponent('{}')],
    ['not JSON', compressToEncodedURIComponent('{')],
    [
      'unsafe catalog version',
      compressToEncodedURIComponent(
        JSON.stringify({
          ...toProjectFile(draft, latest),
          catalog: { version: '../x', sha256: sha },
        }),
      ),
    ],
    [
      'newer format',
      compressToEncodedURIComponent(
        JSON.stringify({ ...toProjectFile(draft, latest), version: 2 }),
      ),
    ],
    [
      'no board',
      compressToEncodedURIComponent(
        JSON.stringify(toProjectFile({ ...EMPTY_DRAFT, modules: draft.modules }, latest)),
      ),
    ],
    ['too long', 'A'.repeat(MAX_SHARE_LENGTH + 1)],
  ])('reject a damaged link (%s) with a message, never throwing', (_name, data) => {
    const r = decodeShare(data);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message.length).toBeGreaterThan(0);
  });
});

describe('project files', () => {
  it('round-trip as JSON', () => {
    const text = projectFileText(toProjectFile(draft, latest));
    expect(JSON.parse(text)).toMatchObject({ format: 'pinout-finder-project', version: 1 });
    expect(readProjectFile(text)).toEqual({
      ok: true,
      draft: { ...draft, catalogPin: latest },
      catalog: latest,
    });
  });

  it('reject other JSON and broken files', () => {
    expect(readProjectFile('{"a":1}').ok).toBe(false);
    expect(readProjectFile('nope').ok).toBe(false);
    expect(readProjectFile(' '.repeat(300_000)).ok).toBe(false);
  });
});
