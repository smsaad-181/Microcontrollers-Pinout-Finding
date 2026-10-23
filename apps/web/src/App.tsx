import { StepNav } from './components/common';
import { hrefFor, routeKey, stepOf, type Route } from './route';
import { BoardScreen } from './screens/BoardScreen';
import { ConstraintsScreen } from './screens/ConstraintsScreen';
import { HomeScreen } from './screens/HomeScreen';
import { ModulesScreen } from './screens/ModulesScreen';
import { ResultsScreen } from './screens/ResultsScreen';
import { PageHeading, type HeadingRef } from './screens/shared';
import { AppStateProvider } from './state/AppState';
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

function SharedPage({ headingRef }: { headingRef: HeadingRef }) {
  return (
    <>
      <PageHeading headingRef={headingRef}>Shared project</PageHeading>
      <p>Opening shared project links is not available yet in this version.</p>
      <p>
        <a href={hrefFor('/board')}>Start a new project</a>
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
      return <SharedPage headingRef={headingRef} />;
    case 'not-found':
      return <NotFoundPage path={route.path} headingRef={headingRef} />;
  }
}

/** The app: header, step navigation, hash-routed page, focus management on route changes. */
export function App() {
  const route = useHashRoute();
  const headingRef = useFocusOnRouteChange(routeKey(route));

  return (
    <AppStateProvider>
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
      <header className="site-header">
        <a className="brand" href={hrefFor('/')}>
          Pinout Finder
        </a>
        <StepNav current={stepOf(route)} />
      </header>
      <main id="main" tabIndex={-1}>
        <Page route={route} headingRef={headingRef} />
      </main>
    </AppStateProvider>
  );
}
