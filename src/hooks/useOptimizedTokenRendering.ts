import { useMemo } from 'react';
import type { Token } from '@/stores/sessionStore';

/**
 * Hook to optimize token rendering by batching tokens into groups
 * based on their properties for more efficient canvas drawing
 */
export const useOptimizedTokenRendering = (tokens: Token[]) => {
  return useMemo(() => {
    // Group tokens by similar properties to reduce context switches
    const groups = {
      normal: [] as Token[],
      selected: [] as Token[],
      hostile: [] as Token[],
      hidden: [] as Token[],
    };
    
    tokens.forEach(token => {
      if (token.isHidden) {
        groups.hidden.push(token);
      } else {
        groups.normal.push(token);
      }
    });
    
    return groups;
  }, [tokens]);
};

/**
 * Hook to batch state updates for better performance
 */
export const useBatchedUpdates = () => {
  let updateQueue: Array<() => void> = [];
  let rafId: number | null = null;
  
  const scheduleUpdate = (update: () => void) => {
    updateQueue.push(update);
    
    if (rafId === null) {
      rafId = requestAnimationFrame(() => {
        const updates = updateQueue;
        updateQueue = [];
        rafId = null;
        
        // Execute all batched updates
        updates.forEach(fn => fn());
      });
    }
  };
  
  return { scheduleUpdate };
};

/**
 * Debounce helper for expensive operations
 */
export const useDebounce = <T extends (...args: any[]) => any>(
  func: T,
  delay: number
): T => {
  let timeoutId: NodeJS.Timeout;
  
  return ((...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  }) as T;
};
