import React, { Suspense, useState, useEffect, useRef } from 'react';

const SimpleTabletop = React.lazy(() => import('../components/SimpleTabletop'));

const isLovableSandbox = true;

const LoadingScreen = () => (
  <div className="flex items-center justify-center h-screen w-screen bg-background text-foreground">
    <div className="text-center space-y-4">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
      <p className="text-muted-foreground">Loading tabletop…</p>
    </div>
  </div>
);

/**
 * Pre-hydrate all persisted zustand stores before mounting SimpleTabletop.
 * This prevents "Maximum update depth exceeded" caused by cascading
 * useSyncExternalStore re-renders when multiple stores hydrate during
 * the component's passive effect phase.
 */
function useStoreHydration() {
  const [hydrated, setHydrated] = useState(false);
  const attempted = useRef(false);

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;

    // Import all persisted stores to trigger their hydration.
    // Each persist store hydrates from localStorage synchronously on creation,
    // but React's useSyncExternalStore sees the change during effects.
    // By importing them here first (outside the heavy component tree),
    // the hydration completes before SimpleTabletop mounts.
    Promise.all([
      import('../stores/sessionStore'),
      import('../stores/regionStore'),
      import('../stores/dungeonStore'),
      import('../stores/fogStore'),
      import('../stores/lightStore'),
      import('../stores/mapStore'),
      import('../stores/mapObjectStore'),
      import('../stores/initiativeStore'),
      import('../stores/roleStore'),
      import('../stores/groupStore'),
      import('../stores/multiplayerStore'),
      import('../stores/illuminationStore'),
      import('../stores/hatchingStore'),
      import('../stores/visionProfileStore'),
      import('../stores/cardStore'),
      import('../stores/uiModeStore'),
    ]).then(() => {
      // Give stores a frame to settle after hydration
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setHydrated(true);
        });
      });
    });
  }, []);

  return hydrated;
}

const Index = () => {
  const [launched, setLaunched] = useState(!isLovableSandbox);
  const hydrated = useStoreHydration();

  if (!launched) {
    return (
      <div className="flex items-center justify-center h-screen w-screen bg-background text-foreground">
        <div className="text-center space-y-6">
          <h1 className="text-3xl font-bold text-foreground">Tabletop Ready</h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            The application is paused to prevent sandbox crashes. Click below to launch.
          </p>
          <button
            onClick={() => setLaunched(true)}
            className="px-8 py-3 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors"
          >
            Launch Tabletop
          </button>
        </div>
      </div>
    );
  }

  if (!hydrated) {
    return <LoadingScreen />;
  }

  return (
    <Suspense fallback={<LoadingScreen />}>
      <SimpleTabletop />
    </Suspense>
  );
};

export default Index;
