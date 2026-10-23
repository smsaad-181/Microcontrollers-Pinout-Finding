// Project files and share links. Both carry the draft plus the catalog it was made with, so a
// result can be reproduced against that exact catalog (or re-checked against the latest one).
import {
  compressToEncodedURIComponent as compress,
  decompressFromEncodedURIComponent as decompress,
} from 'lz-string';
import { EMPTY_DRAFT, type CatalogPin, type ProjectDraft } from './draft';
import { draftFromUnknown, isRecord, parseCatalogPin } from './storage';

export const FILE_FORMAT = 'pinout-finder-project';
export const FILE_VERSION = 1;
/** Longest share-link payload accepted (characters after `#/p/`). */
export const MAX_SHARE_LENGTH = 16000;
/** Largest project file accepted, in characters. */
export const MAX_FILE_LENGTH = 200_000;

export interface ProjectFile {
  format: typeof FILE_FORMAT;
  version: typeof FILE_VERSION;
  catalog: CatalogPin;
  project: Omit<ProjectDraft, 'catalogPin'>;
}

export type ProjectReadResult =
  { ok: true; draft: ProjectDraft; catalog: CatalogPin } | { ok: false; message: string };

/** The project with the catalog it is pinned to (its own pin, else the catalog in use). */
export function toProjectFile(draft: ProjectDraft, current: CatalogPin): ProjectFile {
  const { catalogPin, ...project } = draft;
  return { format: FILE_FORMAT, version: FILE_VERSION, catalog: catalogPin ?? current, project };
}

function fromObject(v: unknown): ProjectReadResult {
  if (!isRecord(v) || v.format !== FILE_FORMAT) {
    return { ok: false, message: 'This is not a Pinout Finder project.' };
  }
  if (v.version !== FILE_VERSION) {
    return { ok: false, message: 'This project was saved by a newer version of Pinout Finder.' };
  }
  const catalog = parseCatalogPin(v.catalog);
  if (catalog === null) {
    return { ok: false, message: 'The project does not say which catalog it was made with.' };
  }
  const draft = draftFromUnknown(v.project);
  if (draft === EMPTY_DRAFT || draft.board === null) {
    return { ok: false, message: 'The project has no board.' };
  }
  return { ok: true, draft: { ...draft, catalogPin: catalog }, catalog };
}

/** Pretty JSON for download. */
export const projectFileText = (file: ProjectFile): string => `${JSON.stringify(file, null, 2)}\n`;

/** Reads an imported project file. Never throws. */
export function readProjectFile(text: string): ProjectReadResult {
  if (text.length > MAX_FILE_LENGTH) return { ok: false, message: 'The file is too large.' };
  try {
    return fromObject(JSON.parse(text) as unknown);
  } catch {
    return { ok: false, message: 'The file is not valid JSON.' };
  }
}

/** `#/p/<data>` payload: the project file, compressed with lz-string (URL-safe alphabet). */
export const encodeShare = (file: ProjectFile): string => compress(JSON.stringify(file));

/** Reads a share-link payload. Never throws. */
export function decodeShare(data: string): ProjectReadResult {
  if (data.length > MAX_SHARE_LENGTH) return { ok: false, message: 'The link is too long.' };
  let text: string | null;
  try {
    text = decompress(data);
  } catch {
    text = null;
  }
  if (text === null || text === '') {
    return { ok: false, message: 'The link is damaged or incomplete.' };
  }
  try {
    return fromObject(JSON.parse(text) as unknown);
  } catch {
    return { ok: false, message: 'The link is damaged or incomplete.' };
  }
}

/** Full share URL for the current page location (hash routes only). */
export function shareUrl(locationHref: string, payload: string): string {
  const base = locationHref.split('#')[0] ?? locationHref;
  return `${base}#/p/${payload}`;
}
