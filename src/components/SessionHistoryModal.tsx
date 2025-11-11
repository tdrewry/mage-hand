import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { Separator } from './ui/separator';
import { toast } from 'sonner';
import { Clock, Download, Trash2, GitCompare, RotateCcw } from 'lucide-react';
import { ProjectVersion, VersionDifference } from '@/lib/sessionHistory';
import { ProjectData } from '@/lib/projectSerializer';

interface SessionHistoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  versions: ProjectVersion[];
  onRestore: (versionId: string) => void;
  onDelete: (versionId: string) => void;
  onCompare: (versionId1: string, versionId2: string) => VersionDifference[];
}

export const SessionHistoryModal: React.FC<SessionHistoryModalProps> = ({
  open,
  onOpenChange,
  versions,
  onRestore,
  onDelete,
  onCompare,
}) => {
  const [selectedVersion1, setSelectedVersion1] = useState<string | null>(null);
  const [selectedVersion2, setSelectedVersion2] = useState<string | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [differences, setDifferences] = useState<VersionDifference[]>([]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleCompare = () => {
    if (!selectedVersion1 || !selectedVersion2) {
      toast.error('Please select two versions to compare');
      return;
    }

    const diffs = onCompare(selectedVersion1, selectedVersion2);
    setDifferences(diffs);
  };

  const handleRestore = (versionId: string) => {
    if (confirm('Are you sure you want to restore this version? Your current session will be replaced.')) {
      onRestore(versionId);
      onOpenChange(false);
    }
  };

  const handleDelete = (versionId: string) => {
    if (confirm('Are you sure you want to delete this version? This action cannot be undone.')) {
      onDelete(versionId);
    }
  };

  const toggleCompareMode = () => {
    setCompareMode(!compareMode);
    setSelectedVersion1(null);
    setSelectedVersion2(null);
    setDifferences([]);
  };

  const handleVersionSelect = (versionId: string) => {
    if (!compareMode) return;

    if (!selectedVersion1) {
      setSelectedVersion1(versionId);
    } else if (!selectedVersion2 && versionId !== selectedVersion1) {
      setSelectedVersion2(versionId);
    } else {
      setSelectedVersion1(versionId);
      setSelectedVersion2(null);
      setDifferences([]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Session History
          </DialogTitle>
          <DialogDescription>
            View and restore previous versions of your session (up to 5 recent versions)
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2 mb-4">
          <Button
            variant={compareMode ? 'default' : 'outline'}
            size="sm"
            onClick={toggleCompareMode}
            className="text-xs"
          >
            <GitCompare className="w-3 h-3 mr-2" />
            {compareMode ? 'Exit Compare Mode' : 'Compare Versions'}
          </Button>
          
          {compareMode && selectedVersion1 && selectedVersion2 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleCompare}
              className="text-xs"
            >
              Show Differences
            </Button>
          )}
        </div>

        <ScrollArea className="h-[400px]">
          {versions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-sm">No version history available yet</p>
              <p className="text-xs mt-2">Versions are saved automatically when you save your project</p>
            </div>
          ) : (
            <div className="space-y-3">
              {versions.map((version, index) => {
                const isSelected = compareMode && (
                  version.versionId === selectedVersion1 ||
                  version.versionId === selectedVersion2
                );

                return (
                  <div
                    key={version.versionId}
                    className={`p-4 border rounded-lg ${
                      isSelected ? 'border-primary bg-primary/5' : 'border-border'
                    } ${compareMode ? 'cursor-pointer hover:border-primary/50' : ''}`}
                    onClick={() => handleVersionSelect(version.versionId)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant={index === 0 ? 'default' : 'secondary'} className="text-xs">
                            {index === 0 ? 'Latest' : `Version ${versions.length - index}`}
                          </Badge>
                          {compareMode && isSelected && (
                            <Badge variant="outline" className="text-xs">
                              Selected {version.versionId === selectedVersion1 ? '1' : '2'}
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                          <Clock className="w-3 h-3" />
                          {formatDate(version.timestamp)}
                        </div>

                        {version.changeDescription && (
                          <p className="text-sm text-foreground mb-2">
                            {version.changeDescription}
                          </p>
                        )}

                        <div className="grid grid-cols-4 gap-2 text-xs mt-3">
                          <div>
                            <span className="text-muted-foreground">Tokens:</span>{' '}
                            <span className="font-medium">{version.projectData.tokens.length}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Maps:</span>{' '}
                            <span className="font-medium">{version.projectData.maps.length}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Regions:</span>{' '}
                            <span className="font-medium">{version.projectData.regions.length}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Groups:</span>{' '}
                            <span className="font-medium">{version.projectData.groups.length}</span>
                          </div>
                        </div>
                      </div>

                      {!compareMode && (
                        <div className="flex gap-2 ml-4">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRestore(version.versionId)}
                            className="text-xs"
                          >
                            <RotateCcw className="w-3 h-3 mr-1" />
                            Restore
                          </Button>
                          {index !== 0 && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDelete(version.versionId)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* Comparison Results */}
        {differences.length > 0 && (
          <>
            <Separator className="my-4" />
            <div>
              <h3 className="font-semibold text-sm mb-3">Version Differences</h3>
              <ScrollArea className="h-[200px]">
                <div className="space-y-2">
                  {differences.map((diff, index) => (
                    <div
                      key={index}
                      className="p-3 bg-muted rounded-lg flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            diff.type === 'added'
                              ? 'default'
                              : diff.type === 'removed'
                              ? 'destructive'
                              : 'secondary'
                          }
                          className="text-xs"
                        >
                          {diff.type}
                        </Badge>
                        <span className="font-medium">{diff.field}</span>
                      </div>
                      <div className="text-muted-foreground">
                        {diff.oldValue} → {diff.newValue}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
