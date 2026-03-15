// src/components/CursorOverlay.tsx
// Renders remote user cursors as colored dots on the canvas.
// Positioned in world-space, transformed to screen-space via the current pan/zoom.

import React from "react";
import { useCursorStore } from "@/stores/cursorStore";
import { useMultiplayerStore } from "@/stores/multiplayerStore";
import { Z_INDEX } from "@/lib/zIndex";

interface CursorOverlayProps {
  transform: { x: number; y: number; zoom: number };
}

export const CursorOverlay: React.FC<CursorOverlayProps> = React.memo(({ transform }) => {
  const cursors = useCursorStore((s) => s.cursors);
  const cursorSharingEnabled = useCursorStore((s) => s.cursorSharingEnabled);
  const connectedUsers = useMultiplayerStore((s) => s.connectedUsers);
  const currentUserId = useMultiplayerStore((s) => s.currentUserId);

  if (!cursorSharingEnabled) return null;

  const cursorEntries = Object.values(cursors).filter(c => c.userId !== currentUserId);
  if (cursorEntries.length === 0) return null;

  return (
    <div
      className="absolute inset-0 pointer-events-none overflow-hidden"
      style={{ zIndex: Z_INDEX.CANVAS_ELEMENTS.CANVAS_UI_OVERLAY + 10 }}
    >
      {cursorEntries.map((cursor) => {
        const screenX = cursor.x * transform.zoom + transform.x;
        const screenY = cursor.y * transform.zoom + transform.y;

        // Find username for label
        const user = connectedUsers.find((u) => u.userId === cursor.userId);
        const label = user?.username ?? cursor.userId.slice(0, 6);

        return (
          <div
            key={cursor.userId}
            className="absolute flex flex-col items-center"
            style={{
              left: `${screenX}px`,
              top: `${screenY}px`,
              transform: "translate(-50%, -50%)",
              transition: "left 60ms linear, top 60ms linear",
            }}
          >
            {/* Cursor dot */}
            <div
              className="rounded-full border border-background shadow-sm"
              style={{
                width: 12,
                height: 12,
                backgroundColor: cursor.color,
              }}
            />
            {/* Username label */}
            <span
              className="text-[10px] font-medium mt-0.5 px-1 rounded whitespace-nowrap"
              style={{
                backgroundColor: cursor.color,
                color: "#fff",
                textShadow: "0 1px 2px rgba(0,0,0,0.3)",
              }}
            >
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
});

CursorOverlay.displayName = "CursorOverlay";
