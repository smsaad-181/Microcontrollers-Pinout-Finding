import type { ReactNode, RefObject } from 'react';
import { useAppState, type LoadedCatalog } from '../state/AppState';

export type HeadingRef = RefObject<HTMLHeadingElement | null>;

/** Page heading that receives focus on route change. */
export function PageHeading({
  headingRef,
  children,
}: {
  headingRef: HeadingRef;
  children: ReactNode;
}) {
  return (
    <h1 ref={headingRef} tabIndex={-1}>
      {children}
    </h1>
  );
}

/** Renders `children` once the catalog is loaded; otherwise a status message. */
export function WithCatalog({ children }: { children: (data: LoadedCatalog) => ReactNode }) {
  const { manifest, catalog } = useAppState();
  if (catalog.status === 'ready') return <>{children(catalog.data)}</>;
  let message: string;
  if (catalog.status === 'error') message = catalog.message;
  else if (manifest.status === 'missing') message = 'The catalog has not been built yet.';
  else if (manifest.status === 'invalid')
    message = `The catalog manifest could not be read. ${manifest.reason}`;
  else if (manifest.status === 'error') message = manifest.message;
  else message = 'Loading the catalog…';
  return (
    <p role="status" className="notice">
      {message}
    </p>
  );
}
