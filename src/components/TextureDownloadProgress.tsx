import { useEffect, useState } from 'react';
import { Download, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TextureDownloadState {
  total: number;
  completed: number;
  inProgress: string[];
}

// Global state for texture downloads that components can subscribe to
let downloadState: TextureDownloadState = { total: 0, completed: 0, inProgress: [] };
const listeners = new Set<(state: TextureDownloadState) => void>();

export function notifyTextureDownloadStart(hash: string): void {
  downloadState = {
    ...downloadState,
    total: downloadState.total + 1,
    inProgress: [...downloadState.inProgress, hash]
  };
  listeners.forEach(l => l(downloadState));
}

export function notifyTextureDownloadComplete(hash: string): void {
  downloadState = {
    ...downloadState,
    completed: downloadState.completed + 1,
    inProgress: downloadState.inProgress.filter(h => h !== hash)
  };
  listeners.forEach(l => l(downloadState));
  
  // Reset after all downloads complete
  if (downloadState.completed === downloadState.total && downloadState.inProgress.length === 0) {
    setTimeout(() => {
      if (downloadState.inProgress.length === 0) {
        downloadState = { total: 0, completed: 0, inProgress: [] };
        listeners.forEach(l => l(downloadState));
      }
    }, 2000); // Show completion for 2 seconds
  }
}

export function notifyTextureDownloadError(hash: string): void {
  downloadState = {
    ...downloadState,
    inProgress: downloadState.inProgress.filter(h => h !== hash)
  };
  listeners.forEach(l => l(downloadState));
}

/**
 * Component to display texture download progress
 */
export function TextureDownloadProgress() {
  const [state, setState] = useState<TextureDownloadState>(downloadState);

  useEffect(() => {
    const handler = (newState: TextureDownloadState) => setState({ ...newState });
    listeners.add(handler);
    return () => { listeners.delete(handler); };
  }, []);

  // Don't render if no downloads
  if (state.total === 0) return null;

  const isComplete = state.completed === state.total && state.inProgress.length === 0;
  const progress = state.total > 0 ? Math.round((state.completed / state.total) * 100) : 0;

  return (
    <div 
      className={cn(
        "fixed top-4 left-4 z-[60000] flex items-center gap-2 px-3 py-2 rounded-lg shadow-lg transition-all duration-300",
        "bg-background/95 backdrop-blur-sm border border-border",
        isComplete && "bg-green-500/10 border-green-500/30"
      )}
    >
      {isComplete ? (
        <>
          <CheckCircle2 className="h-4 w-4 text-green-500" />
          <span className="text-sm text-green-500 font-medium">
            Textures synced
          </span>
        </>
      ) : (
        <>
          <Download className="h-4 w-4 text-primary animate-pulse" />
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium">
              Syncing textures...
            </span>
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-24 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground">
                {state.completed}/{state.total}
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
