import React, { Suspense } from 'react';

const SimpleTabletop = React.lazy(() => import('../components/SimpleTabletop'));

const LoadingScreen = () => (
  <div className="flex items-center justify-center h-screen w-screen bg-background text-foreground">
    <div className="text-center space-y-4">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
      <p className="text-muted-foreground">Loading tabletop…</p>
    </div>
  </div>
);

const Index = React.forwardRef<HTMLDivElement>((_, ref) => {
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
