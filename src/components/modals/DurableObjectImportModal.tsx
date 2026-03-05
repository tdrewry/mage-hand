/**
 * Durable Object Import Modal
 * 
 * Allows selective import of DOs from a .mhdo archive file.
 * Shows manifest with checkboxes, sizes, and timestamps.
 */

import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertTriangle, CheckCircle2, Package, XCircle } from 'lucide-react';
import {
  DurableObjectArchive,
  DurableObjectManifestEntry,
  DurableObjectRegistry,
  formatBytes,
} from '@/lib/durableObjects';
import { toast } from 'sonner';

/** Build a map of kind -> current summary string from registered summarizers */
function getCurrentSummaries(): Record<string, string> {
  const result: Record<string, string> = {};
  for (const reg of DurableObjectRegistry.getAll()) {
    result[reg.kind] = reg.summarizer ? reg.summarizer() : '';
  }
  return result;
}

interface DurableObjectImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  archive: DurableObjectArchive | null;
}

export const DurableObjectImportModal: React.FC<DurableObjectImportModalProps> = ({
  open,
  onOpenChange,
  archive,
}) => {
  const [selectedKinds, setSelectedKinds] = useState<Set<string>>(new Set());
  const [importResult, setImportResult] = useState<{ imported: string[]; errors: string[] } | null>(null);

  const [currentSummaries, setCurrentSummaries] = useState<Record<string, string>>({});

  // Reset selection and snapshot current state when archive changes
  React.useEffect(() => {
    if (archive) {
      setSelectedKinds(new Set(archive.manifest.map(e => e.kind)));
      setImportResult(null);
      setCurrentSummaries(getCurrentSummaries());
    }
  }, [archive]);

  const totalSize = useMemo(() => {
    if (!archive) return 0;
    return archive.manifest
      .filter(e => selectedKinds.has(e.kind))
      .reduce((sum, e) => sum + e.byteSize, 0);
  }, [archive, selectedKinds]);

  const toggleKind = (kind: string) => {
    setSelectedKinds(prev => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  };

  const toggleAll = () => {
    if (!archive) return;
    if (selectedKinds.size === archive.manifest.length) {
      setSelectedKinds(new Set());
    } else {
      setSelectedKinds(new Set(archive.manifest.map(e => e.kind)));
    }
  };

  const handleImport = () => {
    if (!archive || selectedKinds.size === 0) return;

    const result = DurableObjectRegistry.importSelected(archive, Array.from(selectedKinds));
    setImportResult({ imported: result.imported, errors: result.errors });

    if (result.errors.length === 0) {
      toast.success(`Imported ${result.imported.length} durable object(s)`);
      setTimeout(() => onOpenChange(false), 1500);
    } else {
      toast.error(`Import completed with ${result.errors.length} error(s)`);
    }
  };

  if (!archive) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            Import Durable Objects
          </DialogTitle>
          <DialogDescription>
            Select which objects to import from{' '}
            <span className="font-medium text-foreground">{archive.sourceSession.name || 'Unknown Session'}</span>
            <span className="text-xs block mt-1">
              Exported {new Date(archive.exportedAt).toLocaleString()}
            </span>
          </DialogDescription>
        </DialogHeader>

        {importResult ? (
          <div className="space-y-3 py-2">
            {importResult.imported.length > 0 && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/10 border border-primary/20">
                <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium">Successfully imported:</p>
                  <p className="text-xs text-muted-foreground">
                    {importResult.imported.join(', ')}
                  </p>
                </div>
              </div>
            )}
            {importResult.errors.length > 0 && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <XCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium">Errors:</p>
                  {importResult.errors.map((err, i) => (
                    <p key={i} className="text-xs text-muted-foreground">{err}</p>
                  ))}
                </div>
              </div>
            )}
            <Button variant="outline" className="w-full" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-2">
              <Button variant="ghost" size="sm" onClick={toggleAll} className="text-xs h-7">
                {selectedKinds.size === archive.manifest.length ? 'Deselect All' : 'Select All'}
              </Button>
              <Badge variant="secondary" className="text-xs">
                {formatBytes(totalSize)} selected
              </Badge>
            </div>

            <ScrollArea className="h-[320px] w-full pr-2">
              <div className="space-y-1">
                {archive.manifest.map((entry: DurableObjectManifestEntry) => {
                  const reg = DurableObjectRegistry.get(entry.kind);
                  const isRegistered = !!reg;
                  const currentSummary = currentSummaries[entry.kind];
                  // Extract incoming summary from the label (format: "Label (summary)")
                  const incomingMatch = entry.label.match(/\((.+)\)$/);
                  const incomingSummary = incomingMatch ? incomingMatch[1] : '';

                  return (
                    <label
                      key={entry.kind}
                      className={`flex items-center gap-3 p-2.5 rounded-md cursor-pointer transition-colors
                        ${selectedKinds.has(entry.kind)
                          ? 'bg-accent/50 border border-accent'
                          : 'border border-transparent hover:bg-muted/50'
                        }
                        ${!isRegistered ? 'opacity-50 cursor-not-allowed' : ''}
                      `}
                    >
                      <Checkbox
                        checked={selectedKinds.has(entry.kind)}
                        onCheckedChange={() => isRegistered && toggleKind(entry.kind)}
                        disabled={!isRegistered}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate">{reg?.label || entry.kind}</span>
                          {!isRegistered && (
                            <Badge variant="outline" className="text-xs shrink-0">
                              <AlertTriangle className="w-3 h-3 mr-1" />
                              Unknown
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                          <span>{formatBytes(entry.byteSize)}</span>
                          <span>v{entry.version}</span>
                        </div>
                        {isRegistered && selectedKinds.has(entry.kind) && (incomingSummary || currentSummary) && (
                          <div className="text-xs mt-1 flex items-center gap-1 text-destructive/80">
                            <AlertTriangle className="w-3 h-3 shrink-0" />
                            <span>
                              {incomingSummary || 'incoming'} → replaces {currentSummary || 'existing'}
                            </span>
                          </div>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            </ScrollArea>

            <div className="flex items-center gap-2 pt-2 border-t border-border">
              <div className="flex-1 text-xs text-muted-foreground">
                <AlertTriangle className="w-3 h-3 inline mr-1" />
                Importing will <span className="font-medium">replace</span> existing data for selected objects
              </div>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleImport}
                disabled={selectedKinds.size === 0}
              >
                Import ({selectedKinds.size})
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
