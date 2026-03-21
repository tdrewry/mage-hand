// src/components/WaitingRoomOverlay.tsx
// Shown to clients (non-DM) when the DM has activated Pause Broadcasts.
// Jazz continues syncing in the background; this overlay simply hides the canvas
// until the DM is ready to reveal, then clears and the canvas redraws with
// the fully-synced final state.

import React, { useEffect, useRef } from 'react';
import { useBroadcastPauseStore } from '@/stores/useBroadcastPauseStore';
import { useMultiplayerStore } from '@/stores/multiplayerStore';

export const WaitingRoomOverlay: React.FC = () => {
  const isPaused = useBroadcastPauseStore(s => s.isPaused);
  const roles    = useMultiplayerStore(s => s.roles);

  // DMs always see the canvas (the pausing DM sees their own badge in the top bar;
  // other DMs are aware of the pause context through that same badge).
  const isDM = roles.includes('dm');
  const showOverlay = isPaused && !isDM;

  // Track dots for animation
  const dotsRef = useRef(0);
  const [dots, setDots] = React.useState('');

  useEffect(() => {
    if (!showOverlay) { setDots(''); return; }
    const id = setInterval(() => {
      dotsRef.current = (dotsRef.current + 1) % 4;
      setDots('.'.repeat(dotsRef.current));
    }, 600);
    return () => clearInterval(id);
  }, [showOverlay]);

  if (!showOverlay) return null;

  return (
    <div
      className="flex flex-col items-center justify-center select-none"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(8, 8, 16, 0.82)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        pointerEvents: 'all',
        cursor: 'not-allowed',
      }}
    >
      {/* Pulsing orb */}
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: '50%',
          background: 'radial-gradient(circle at 40% 40%, #f59e0b 0%, #b45309 60%, transparent 100%)',
          boxShadow: '0 0 32px 8px rgba(245,158,11,0.25)',
          marginBottom: 28,
          animation: 'waitingRoomPulse 2s ease-in-out infinite',
        }}
      />

      <style>{`
        @keyframes waitingRoomPulse {
          0%, 100% { opacity: 0.8; transform: scale(1); }
          50%       { opacity: 1;   transform: scale(1.08); }
        }
      `}</style>

      <p
        style={{
          color: '#fbbf24',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          marginBottom: 12,
          opacity: 0.8,
        }}
      >
        Waiting Room
      </p>

      <h2
        style={{
          color: '#ffffff',
          fontSize: 22,
          fontWeight: 600,
          marginBottom: 10,
          textAlign: 'center',
        }}
      >
        DM is preparing the scene{dots}
      </h2>

      <p
        style={{
          color: 'rgba(255,255,255,0.45)',
          fontSize: 14,
          textAlign: 'center',
          maxWidth: 320,
          lineHeight: 1.5,
        }}
      >
        The map will be revealed when the Dungeon Master is ready.
      </p>
    </div>
  );
};
