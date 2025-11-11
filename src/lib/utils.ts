import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Process an array in chunks with delays between chunks to keep UI responsive
 * @param items - Array of items to process
 * @param chunkSize - Number of items to process per chunk
 * @param processor - Function to process each item
 * @param progressCallback - Optional callback for progress updates (processed, total)
 * @returns Promise that resolves when all items are processed
 */
export async function processInChunks<T>(
  items: T[],
  chunkSize: number,
  processor: (item: T) => void,
  progressCallback?: (processed: number, total: number) => void
): Promise<void> {
  if (items.length === 0) return;
  
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    chunk.forEach(processor);
    
    const processed = Math.min(i + chunkSize, items.length);
    if (progressCallback) {
      progressCallback(processed, items.length);
    }
    
    // Yield to UI thread between chunks
    await new Promise(resolve => setTimeout(resolve, 0));
  }
}
