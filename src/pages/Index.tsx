import React, { Suspense } from 'react';
import { LandingScreen } from '@/components/LandingScreen';
import { useSessionStore } from '@/stores/sessionStore';
import { useLaunchStore } from '@/stores/launchStore';

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
  const launched = useLaunchStore((s) => s.launched);
  const setLaunched = useLaunchStore((s) => s.setLaunched);
  const players = useSessionStore((state) => state.players);

  // A session exists if at least one player has been assigned a name
  const hasSession = players.some(p => p.name && p.name.trim().length > 0);

  if (!launched) {
    return (
      <div ref={ref}>
        <LandingScreen onLaunch={() => setLaunched(true)} hasSession={hasSession} />
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
