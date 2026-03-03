/**
 * Effect Context Menu
 * 
 * Right-click context menu for placed effects on the canvas.
 * Provides dismiss and pause/play animation controls for DMs.
 */

import React from 'react';
import { X, Pause, Play } from 'lucide-react';
import { useEffectStore } from '@/stores/effectStore';
import { Z_INDEX } from '@/lib/zIndex';

interface EffectContextMenuProps {
  effectId: string;
  effectName: string;
  isAnimationPaused: boolean;
  hasAnimation: boolean;
  position: { x: number; y: number };
  onClose: () => void;
  onRedraw: () => void;
}

export const EffectContextMenu: React.FC<EffectContextMenuProps> = ({
  effectId,
  effectName,
  isAnimationPaused,
  hasAnimation,
  position,
  onClose,
  onRedraw,
}) => {
  const handleDismiss = () => {
    useEffectStore.getState().dismissEffect(effectId);
    onClose();
    onRedraw();
  };

  const handleToggleAnimation = () => {
    useEffectStore.getState().toggleAnimationPaused(effectId);
    onClose();
    onRedraw();
  };

  return (
    <>
      {/* Backdrop to close menu */}
      <div
        className="fixed inset-0"
        style={{ zIndex: Z_INDEX.DROPDOWNS.MENU - 1 }}
        onClick={onClose}
        onContextMenu={(e) => { e.preventDefault(); onClose(); }}
      />
      <div
        className="fixed min-w-[160px] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95"
        style={{
          zIndex: Z_INDEX.DROPDOWNS.MENU,
          left: position.x,
          top: position.y,
        }}
      >
        {/* Header */}
        <div className="px-2 py-1.5 text-sm font-semibold text-foreground truncate max-w-[200px]">
          {effectName}
        </div>
        <div className="-mx-1 my-1 h-px bg-border" />

        {/* Pause/Play Animation */}
        {hasAnimation && (
          <button
            className="relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
            onClick={handleToggleAnimation}
          >
            {isAnimationPaused ? (
              <>
                <Play className="mr-2 h-4 w-4" />
                Resume Animation
              </>
            ) : (
              <>
                <Pause className="mr-2 h-4 w-4" />
                Pause Animation
              </>
            )}
          </button>
        )}

        {/* Dismiss */}
        <button
          className="relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-destructive hover:text-destructive-foreground"
          onClick={handleDismiss}
        >
          <X className="mr-2 h-4 w-4" />
          Dismiss Effect
        </button>
      </div>
    </>
  );
};
