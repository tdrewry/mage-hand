import React, { Suspense, useState, useEffect } from 'react';

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

const Index = () => {
  const [launched, setLaunched] = useState(!isLovableSandbox);
  // Delay mounting SimpleTabletop to let all zustand persist stores fully hydrate
  // This prevents "Maximum update depth exceeded" from store rehydration cascades
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (launched && !ready) {
      const timer = setTimeout(() => setReady(true), 50);
      return () => clearTimeout(timer);
    }
  }, [launched, ready]);

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

  if (!ready) {
    return <LoadingScreen />;
  }

  return (
    <Suspense fallback={<LoadingScreen />}>
      <SimpleTabletop />
    </Suspense>
  );
};

export default Index;
