import { useRef, useCallback } from 'react';

interface TouchState {
  touchStartTime: number;
  initialTouches: { x: number; y: number; id: number }[];
  lastTouches: { x: number; y: number; id: number }[];
  initialPinchDistance: number | null;
  initialZoom: number;
  isPanning: boolean;
  isPinching: boolean;
}

interface UseTouchEventsOptions {
  onPanStart: (x: number, y: number) => void;
  onPanMove: (x: number, y: number, deltaX: number, deltaY: number) => void;
  onPanEnd: () => void;
  onZoom: (zoomDelta: number, centerX: number, centerY: number) => void;
  onTap: (x: number, y: number, rect: DOMRect) => void;
  onDoubleTap?: (x: number, y: number, rect: DOMRect) => void;
  onDragStart: (x: number, y: number, rect: DOMRect) => boolean; // Returns true if drag started on an element
  onDragMove: (x: number, y: number, rect: DOMRect) => void;
  onDragEnd: (x: number, y: number, rect: DOMRect) => void;
}

export const useTouchEvents = (options: UseTouchEventsOptions) => {
  const {
    onPanStart,
    onPanMove,
    onPanEnd,
    onZoom,
    onTap,
    onDoubleTap,
    onDragStart,
    onDragMove,
    onDragEnd,
  } = options;

  const stateRef = useRef<TouchState>({
    touchStartTime: 0,
    initialTouches: [],
    lastTouches: [],
    initialPinchDistance: null,
    initialZoom: 1,
    isPanning: false,
    isPinching: false,
  });

  const isDraggingElementRef = useRef(false);
  const lastTapTimeRef = useRef(0);
  const lastTapPosRef = useRef({ x: 0, y: 0 });

  const getTouchPoint = (touch: React.Touch) => ({
    x: touch.clientX,
    y: touch.clientY,
    id: touch.identifier,
  });

  const getDistance = (t1: { x: number; y: number }, t2: { x: number; y: number }) => {
    return Math.sqrt((t2.x - t1.x) ** 2 + (t2.y - t1.y) ** 2);
  };

  const getCenter = (t1: { x: number; y: number }, t2: { x: number; y: number }) => ({
    x: (t1.x + t2.x) / 2,
    y: (t1.y + t2.y) / 2,
  });

  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault(); // Prevent scrolling and browser gestures
    
    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const touches = Array.from(e.touches).map(getTouchPoint);
    
    stateRef.current.touchStartTime = Date.now();
    stateRef.current.initialTouches = touches;
    stateRef.current.lastTouches = touches;

    if (touches.length === 1) {
      // Single touch - check for double tap first
      const touch = touches[0];
      const now = Date.now();
      const timeSinceLastTap = now - lastTapTimeRef.current;
      const distFromLastTap = Math.sqrt(
        (touch.x - lastTapPosRef.current.x) ** 2 + 
        (touch.y - lastTapPosRef.current.y) ** 2
      );

      // Double tap detection (within 300ms and 30px)
      if (timeSinceLastTap < 300 && distFromLastTap < 30 && onDoubleTap) {
        onDoubleTap(touch.x, touch.y, rect);
        lastTapTimeRef.current = 0; // Reset to prevent triple-tap
        return;
      }

      // Try to start element drag first
      const didStartDrag = onDragStart(touch.x, touch.y, rect);
      isDraggingElementRef.current = didStartDrag;

      if (!didStartDrag) {
        // No element hit - start panning
        stateRef.current.isPanning = true;
        onPanStart(touch.x, touch.y);
      }
    } else if (touches.length === 2) {
      // Two-finger touch - start pinch zoom
      stateRef.current.isPinching = true;
      stateRef.current.isPanning = false;
      isDraggingElementRef.current = false;
      stateRef.current.initialPinchDistance = getDistance(touches[0], touches[1]);
    }
  }, [onPanStart, onDragStart, onDoubleTap]);

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    
    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const touches = Array.from(e.touches).map(getTouchPoint);
    const lastTouches = stateRef.current.lastTouches;

    if (touches.length === 1 && lastTouches.length >= 1) {
      const touch = touches[0];
      const lastTouch = lastTouches.find(t => t.id === touch.id) || lastTouches[0];
      const deltaX = touch.x - lastTouch.x;
      const deltaY = touch.y - lastTouch.y;

      if (isDraggingElementRef.current) {
        // Dragging an element (token, region, etc.)
        onDragMove(touch.x, touch.y, rect);
      } else if (stateRef.current.isPanning) {
        // Panning the canvas
        onPanMove(touch.x, touch.y, deltaX, deltaY);
      }
    } else if (touches.length === 2 && stateRef.current.isPinching) {
      // Pinch zoom
      const currentDistance = getDistance(touches[0], touches[1]);
      const initialDistance = stateRef.current.initialPinchDistance;
      
      if (initialDistance && initialDistance > 0) {
        const scale = currentDistance / initialDistance;
        const center = getCenter(touches[0], touches[1]);
        
        // Calculate zoom delta based on scale change
        // Use a reasonable sensitivity
        const zoomDelta = scale > 1 ? 1 : -1;
        const intensity = Math.abs(scale - 1) * 2;
        
        if (intensity > 0.02) { // Threshold to avoid micro-adjustments
          onZoom(zoomDelta * intensity, center.x, center.y);
          stateRef.current.initialPinchDistance = currentDistance;
        }
      }
    }

    stateRef.current.lastTouches = touches;
  }, [onPanMove, onZoom, onDragMove]);

  const handleTouchEnd = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    
    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const remainingTouches = Array.from(e.touches).map(getTouchPoint);
    const changedTouches = Array.from(e.changedTouches).map(getTouchPoint);
    
    // Get the touch that ended
    const endedTouch = changedTouches[0];
    const touchDuration = Date.now() - stateRef.current.touchStartTime;
    const initialTouch = stateRef.current.initialTouches[0];
    
    // Calculate movement from start
    const moveDistance = initialTouch && endedTouch
      ? Math.sqrt((endedTouch.x - initialTouch.x) ** 2 + (endedTouch.y - initialTouch.y) ** 2)
      : 0;

    if (remainingTouches.length === 0) {
      // All touches ended
      if (isDraggingElementRef.current && endedTouch) {
        onDragEnd(endedTouch.x, endedTouch.y, rect);
      } else if (stateRef.current.isPanning) {
        onPanEnd();
      }

      // Detect tap (short touch with minimal movement)
      if (touchDuration < 200 && moveDistance < 10 && endedTouch && !stateRef.current.isPinching) {
        // Record for double-tap detection
        lastTapTimeRef.current = Date.now();
        lastTapPosRef.current = { x: endedTouch.x, y: endedTouch.y };
        
        // Trigger tap if we weren't dragging an element
        if (!isDraggingElementRef.current) {
          onTap(endedTouch.x, endedTouch.y, rect);
        }
      }

      // Reset all state
      stateRef.current.isPanning = false;
      stateRef.current.isPinching = false;
      stateRef.current.initialPinchDistance = null;
      isDraggingElementRef.current = false;
    } else if (remainingTouches.length === 1) {
      // Went from 2 fingers to 1 - transition to pan
      stateRef.current.isPinching = false;
      stateRef.current.isPanning = true;
      stateRef.current.lastTouches = remainingTouches;
      onPanStart(remainingTouches[0].x, remainingTouches[0].y);
    }
  }, [onPanEnd, onDragEnd, onTap]);

  const handleTouchCancel = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    // Reset all state on cancel
    stateRef.current.isPanning = false;
    stateRef.current.isPinching = false;
    stateRef.current.initialPinchDistance = null;
    isDraggingElementRef.current = false;
    onPanEnd();
  }, [onPanEnd]);

  return {
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleTouchCancel,
  };
};
