import { StepNav, type StepProgress } from './components/common';
import { LogoMark } from './components/icons';
import { StepFooter } from './components/StepFooter';
import { StorageStatus } from './components/StorageStatus';
import { UpdatePrompt } from './pwa/UpdatePrompt';
import { hrefFor, routeKey, stepOf, type Route } from './route';
import { BoardScreen } from './screens/BoardScreen';
import { ConstraintsScreen } from './screens/ConstraintsScreen';
import { HomeScreen } from './screens/HomeScreen';
import { ModulesScreen } from './screens/ModulesScreen';
import { ResultsScreen } from './screens/ResultsScreen';
import { SharedScreen } from './screens/SharedScreen';
import { PageHeading, type HeadingRef } from './screens/shared';
import { AppStateProvider, useAppState, type AppServices } from './state/AppState';
import { useFocusOnRouteChange } from './useFocusOnRouteChange';
import { useHashRoute } from './useHashRoute';

export { CatalogStatus } from './components/CatalogStatus';

function NotFoundPage({ path, headingRef }: { path: string; headingRef: HeadingRef }) {
  return (
    <>
      <PageHeading headingRef={headingRef}>Page not found</PageHeading>
      <p>
        There is no page at <code>{path}</code>.
      </p>
      <p>
        <a href={hrefFor('/')}>Go to the Pinout Finder home page</a>
      </p>
    </>
  );
}

function Page({ route, headingRef }: { route: Route; headingRef: HeadingRef }) {
  switch (route.name) {
    case 'home':
      return <HomeScreen headingRef={headingRef} />;
    case 'board':
      return <BoardScreen headingRef={headingRef} />;
    case 'modules':
      return <ModulesScreen headingRef={headingRef} />;
    case 'constraints':
      return <ConstraintsScreen headingRef={headingRef} />;
    case 'results':
      return <ResultsScreen headingRef={headingRef} />;
    case 'shared':
      return <SharedScreen data={route.data} headingRef={headingRef} />;
    case 'not-found':
      return <NotFoundPage path={route.path} headingRef={headingRef} />;
  }
}

function Shell({ route, headingRef }: { route: Route; headingRef: HeadingRef }) {
  const { draft } = useAppState();
  const current = stepOf(route);
  const progress: StepProgress = {
    board: draft.board !== null,
    modules: draft.modules.length,
    rules:
      draft.locked.length > 0 ||
      draft.reserved.length > 0 ||
      draft.connections.length > 0 ||
      draft.wifi ||
      draft.wiringLengthM !== null ||
      draft.framework !== null,
  };
  return (
    <>
      <header className="site-header">
        <div className="site-header-inner">
          <a className="brand" href={hrefFor('/')}>
            <LogoMark />
            <span>Pinout Finder</span>
          </a>
          <StepNav current={current} progress={progress} onHome={route.name === 'home'} />
        </div>
      </header>
      <UpdatePrompt />
      <main id="main" tabIndex={-1}>
        <Page route={route} headingRef={headingRef} />
      </main>
      {current !== null && current !== 'results' ? <StepFooter step={current} /> : null}
      <footer className="site-footer">
        <StorageStatus />
      </footer>
    </>
  );
}

/** The app: header, step navigation, hash-routed page, focus management on route changes. */
export function App({ services }: { services?: AppServices }) {
  const route = useHashRoute();
  const headingRef = useFocusOnRouteChange(routeKey(route));

  return (
    <AppStateProvider {...(services ? { services } : {})}>
      <a
        className="skip-link"
        href="#main"
        onClick={(e) => {
          // Focus <main> without changing the hash (the hash is the route).
          e.preventDefault();
          document.getElementById('main')?.focus();
        }}
      >
        Skip to content
      </a>
      <Shell route={route} headingRef={headingRef} />
    </AppStateProvider>
  );
}
