import React from 'react';
import { useUndoRedoStore } from '@/stores/undoRedoStore';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Clock, Undo2, Redo2, Trash2 } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export const HistoryCard: React.FC = () => {
  const { 
    undoHistory, 
    redoHistory, 
    undoToIndex, 
    redoToIndex, 
    clear,
    canUndo,
    canRedo
  } = useUndoRedoStore();

  const handleUndoToIndex = (index: number) => {
    undoToIndex(index);
    const action = undoHistory[index];
    toast.success(`Restored to: ${action?.description || 'Previous state'}`);
  };

  const handleRedoToIndex = (index: number) => {
    redoToIndex(index);
    toast.success('Restored to future state');
  };

  const handleClearHistory = () => {
    clear();
    toast.info('History cleared');
  };

  // Get last 10 undo actions (most recent first)
  const recentUndoActions = [...undoHistory].reverse().slice(0, 10);
  
  // Get last 10 redo actions (reversed for display)
  const recentRedoActions = [...redoHistory].reverse().slice(0, 10);

  return (
    <div className="flex flex-col h-full gap-3 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-muted-foreground" />
          <h3 className="font-semibold text-foreground">History</h3>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearHistory}
              disabled={!canUndo && !canRedo}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">Clear all history</TooltipContent>
        </Tooltip>
      </div>

        <Separator />

        <ScrollArea className="flex-1 -mx-4 px-4">
          <div className="space-y-4">
            {/* Redo Actions (Future) */}
            {recentRedoActions.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  <Redo2 className="w-3 h-3" />
                  <span>Future Actions</span>
                </div>
                {recentRedoActions.map((action, idx) => {
                  const actualIndex = redoHistory.length - 1 - idx;
                  return (
                    <button
                      key={`redo-${actualIndex}-${action.timestamp}`}
                      onClick={() => handleRedoToIndex(actualIndex)}
                      className={cn(
                        "w-full text-left p-3 rounded-lg border transition-all",
                        "border-border/50 bg-muted/30 hover:bg-accent hover:border-accent-foreground/20",
                        "opacity-60 hover:opacity-100"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-foreground truncate">
                            {action.description || action.type}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {action.timestamp && formatDistanceToNow(action.timestamp, { addSuffix: true })}
                          </div>
                        </div>
                        <Redo2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Current State Indicator */}
            {(recentUndoActions.length > 0 || recentRedoActions.length > 0) && (
              <div className="flex items-center gap-2 py-2">
                <div className="flex-1 h-px bg-primary" />
                <span className="text-xs font-semibold text-primary uppercase tracking-wide">
                  Current State
                </span>
                <div className="flex-1 h-px bg-primary" />
              </div>
            )}

            {/* Undo Actions (Past) */}
            {recentUndoActions.length > 0 ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  <Undo2 className="w-3 h-3" />
                  <span>Past Actions</span>
                </div>
                {recentUndoActions.map((action, idx) => {
                  const actualIndex = undoHistory.length - 1 - idx;
                  return (
                    <button
                      key={`undo-${actualIndex}-${action.timestamp}`}
                      onClick={() => handleUndoToIndex(actualIndex)}
                      className={cn(
                        "w-full text-left p-3 rounded-lg border transition-all",
                        "border-border bg-card hover:bg-accent hover:border-accent-foreground/20"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-foreground truncate">
                            {action.description || action.type}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {action.timestamp && formatDistanceToNow(action.timestamp, { addSuffix: true })}
                          </div>
                        </div>
                        <Undo2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              !recentRedoActions.length && (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">No history yet</p>
                  <p className="text-xs mt-1">Actions will appear here as you work</p>
                </div>
              )
            )}
          </div>
        </ScrollArea>

      {/* Stats Footer */}
      <Separator />
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{undoHistory.length} total actions</span>
        <span>Last {Math.min(10, undoHistory.length + redoHistory.length)} shown</span>
      </div>
    </div>
  );
};
