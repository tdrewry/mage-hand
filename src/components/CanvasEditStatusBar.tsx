// src/components/CanvasEditStatusBar.tsx
// Floating status indicator shown to observer clients during host canvas transforms.
//
// States:
//   pending  — subscription paused, waiting for host to commit (canvas.edit.begin received)
//   loading  — subscription resuming, hydrating from final Jazz CRDT state
//   partial  — WebRTC fallback triggered (canvas.edit.end never arrived), auto-resumed
//   idle     — hidden

import { useCanvasEditStatusStore } from '@/stores/useCanvasEditStatusStore';
import { Loader2, Clock, AlertTriangle } from 'lucide-react';
import { useEffect, useState } from 'react';

export function CanvasEditStatusBar() {
  const status = useCanvasEditStatusStore((s) => s.status);
  const [visible, setVisible] = useState(false);
  const [showPartialFor, setShowPartialFor] = useState(0);

  // Keep partial visible for 4s before fading
  useEffect(() => {
    if (status === 'partial') {
      setShowPartialFor(Date.now());
    }
  }, [status]);

  useEffect(() => {
    setVisible(status !== 'idle');
    // Keep partial on screen for 4s
    if (status === 'idle' && showPartialFor > 0 && Date.now() - showPartialFor < 4000) {
      const t = setTimeout(() => {
        setVisible(false);
        setShowPartialFor(0);
      }, 4000 - (Date.now() - showPartialFor));
      return () => clearTimeout(t);
    }
  }, [status, showPartialFor]);

  if (!visible && status === 'idle') return null;

  const configs = {
    pending: {
      icon: <Clock className="h-3 w-3 animate-pulse" />,
      label: 'Pending...',
      bar: false,
      classes: 'bg-amber-950/90 border-amber-700/60 text-amber-300',
    },
    loading: {
      icon: <Loader2 className="h-3 w-3 animate-spin" />,
      label: 'Loading...',
      bar: true,
      classes: 'bg-blue-950/90 border-blue-700/60 text-blue-300',
    },
    partial: {
      icon: <AlertTriangle className="h-3 w-3" />,
      label: 'Partial',
      bar: false,
      classes: 'bg-rose-950/90 border-rose-700/60 text-rose-300',
    },
    idle: {
      icon: null,
      label: '',
      bar: false,
      classes: '',
    },
  } as const;

  const config = configs[status] ?? configs.idle;
  if (!config.label) return null;

  return (
    <div
      id="canvas-edit-status-bar"
      className={`
        fixed top-16 left-4 z-[9900] flex items-center gap-2
        px-3 py-1.5 rounded-md border shadow-lg backdrop-blur-sm
        text-xs font-medium pointer-events-none select-none
        animate-in fade-in slide-in-from-left-2 duration-200
        ${config.classes}
      `}
    >
      {config.icon}
      <span>{config.label}</span>
      {config.bar && (
        <div className="w-20 h-1 bg-blue-900/60 rounded-full overflow-hidden ml-1">
          <div className="h-full bg-blue-400 rounded-full animate-[progress_1.5s_ease-in-out_infinite]" />
        </div>
      )}
    </div>
  );
}
