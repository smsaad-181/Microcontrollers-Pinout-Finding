// Pure decision logic for moving keyboard / screen-reader focus when the hash route changes.

/** Anything with a `focus()` method (an `HTMLElement` in the browser, a stub in tests). */
export interface Focusable {
  focus(): void;
}

/**
 * Whether focus should move to the new page heading: only when a route was already shown
 * (`previousKey` is not `null`) and it differs from the new one. The first render never steals
 * focus, and a repeated effect run for the same route (React StrictMode) does not either.
 */
export function shouldFocusHeading(previousKey: string | null, nextKey: string): boolean {
  return previousKey !== null && previousKey !== nextKey;
}

/**
 * Focuses `heading` when the route changed from `previousKey` to `nextKey`. Returns whether it
 * did; a missing heading (not rendered yet) is skipped without error.
 */
export function moveFocusOnRouteChange(
  previousKey: string | null,
  nextKey: string,
  heading: Focusable | null,
): boolean {
  if (!shouldFocusHeading(previousKey, nextKey) || heading === null) return false;
  heading.focus();
  return true;
}
