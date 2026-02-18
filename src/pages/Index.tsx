import React, { Suspense } from 'react';

const SimpleTabletop = React.lazy(() => import('../components/SimpleTabletop'));

const Index = () => {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-screen w-screen bg-background text-foreground">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
          <p className="text-muted-foreground">Loading tabletop…</p>
        </div>
      </div>
    }>
      <SimpleTabletop />
    </Suspense>
  );
};

export default Index;
