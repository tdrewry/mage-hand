import React, { Suspense, useState } from 'react';

const SimpleTabletop = React.lazy(() => import('../components/SimpleTabletop'));

const isLovableSandbox = window.location.hostname.includes('lovable.app');

const LoadingScreen = () => (
  <div className="flex items-center justify-center h-screen w-screen bg-background text-foreground">
    <div className="text-center space-y-4">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
      <p className="text-muted-foreground">Loading tabletop…</p>
    </div>
  </div>
);

const Index = React.forwardRef<HTMLDivElement>((_, ref) => {
  const [launched, setLaunched] = useState(!isLovableSandbox);

  if (!launched) {
    return (
      <div ref={ref} className="flex items-center justify-center h-screen w-screen bg-background text-foreground">
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

  return (
    <div ref={ref}>
      <Suspense fallback={<LoadingScreen />}>
        <SimpleTabletop />
      </Suspense>
    </div>
  );
});

Index.displayName = 'Index';

export default Index;
