// Home -> Board hand-off: the Board step can open pre-filtered through the hash query,
// e.g. `#/board?platform=Arduino` or `#/board?q=DevKitC`. The router ignores the query.
import { hrefFor } from './route';

export interface BoardIntent {
  q?: string;
  platform?: string;
}

export function boardHref(intent: BoardIntent = {}): string {
  const params = new URLSearchParams();
  if (intent.q) params.set('q', intent.q);
  if (intent.platform) params.set('platform', intent.platform);
  const qs = params.toString();
  return `${hrefFor('/board')}${qs ? `?${qs}` : ''}`;
}

export function readBoardIntent(hash: string = window.location.hash): BoardIntent {
  const at = hash.indexOf('?');
  if (at === -1) return {};
  const params = new URLSearchParams(hash.slice(at + 1));
  const q = params.get('q');
  const platform = params.get('platform');
  return { ...(q ? { q } : {}), ...(platform ? { platform } : {}) };
}
