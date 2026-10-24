// Single-file build only (replaces `virtual:pwa-register`): a page opened from file:// cannot and
// must not register a service worker, so this never does. Offline already works: everything is inline.
export function registerSW(_options?: unknown): (reload?: boolean) => Promise<void> {
  return () => Promise.resolve();
}
