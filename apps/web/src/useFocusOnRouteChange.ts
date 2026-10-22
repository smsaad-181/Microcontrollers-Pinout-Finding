import { useEffect, useRef, type RefObject } from 'react';
import { moveFocusOnRouteChange } from './focus';

/**
 * Returns the ref to put on the page `<h1>` and moves focus to it whenever `routeKey` changes
 * (not on first load), so screen-reader users hear the new page.
 */
export function useFocusOnRouteChange(routeKey: string): RefObject<HTMLHeadingElement | null> {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const previousKey = useRef<string | null>(null);
  useEffect(() => {
    moveFocusOnRouteChange(previousKey.current, routeKey, headingRef.current);
    previousKey.current = routeKey;
  }, [routeKey]);
  return headingRef;
}
