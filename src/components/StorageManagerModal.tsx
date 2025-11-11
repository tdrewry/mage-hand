import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { 
  getStorageStatus, 
  getStorageBreakdown,
  getAllStorageItems,
  type StorageInfo,
  type StorageWarning,
  type StorageBreakdown,
  type StorageItem
} from '@/lib/storageManager';
import { autoSaveManager } from '@/lib/autoSaveManager';
import { 
  clearOldHistoryVersions, 
  clearAllHistory, 
  getAllProjectHistories 
} from '@/lib/sessionHistory';
import { 
  clearAllCustomTemplates, 
  getCustomTemplates 
} from '@/lib/sessionTemplates';
import { toast } from '@/hooks/use-toast';
import { 
  HardDrive, 
  AlertTriangle, 
  AlertCircle,
  Database,
  Clock,
  History,
  FileText,
  FolderOpen,
  Package,
  Trash2,
  RefreshCw
} from 'lucide-react';

interface StorageManagerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const categoryIcons = {
  projects: Database,
  'auto-saves': Clock,
  history: History,
  templates: FileText,
  session: FolderOpen,
  other: Package,
};

const categoryLabels = {
  projects: 'Projects',
  'auto-saves': 'Auto-Saves',
  history: 'History',
  templates: 'Templates',
  session: 'Session Data',
  other: 'Other',
};

export function StorageManagerModal({ open, onOpenChange }: StorageManagerModalProps) {
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null);
  const [storageWarning, setStorageWarning] = useState<StorageWarning | null>(null);
  const [breakdown, setBreakdown] = useState<StorageBreakdown | null>(null);
  const [storageItems, setStorageItems] = useState<StorageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteAction, setDeleteAction] = useState<(() => void) | null>(null);
  const [deleteMessage, setDeleteMessage] = useState('');

  useEffect(() => {
    if (open) {
      loadStorageData();
    }
  }, [open]);

  const loadStorageData = async () => {
    setLoading(true);
    try {
      const status = await getStorageStatus();
      const storageBreakdown = await getStorageBreakdown();
      const items = getAllStorageItems();
      setStorageInfo(status.info);
      setStorageWarning(status.warning);
      setBreakdown(storageBreakdown);
      setStorageItems(items);
    } catch (error) {
      console.error('Failed to load storage data:', error);
    } finally {
      setLoading(false);
    }
  };

  const confirmDelete = (message: string, action: () => void) => {
    setDeleteMessage(message);
    setDeleteAction(() => action);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (deleteAction) {
      deleteAction();
      setDeleteDialogOpen(false);
      setDeleteAction(null);
      loadStorageData();
    }
  };

  const handleClearOldAutoSaves = () => {
    confirmDelete(
      'Clear old auto-save data (older than 7 days)?',
      () => {
        autoSaveManager.clearOldAutoSaves();
        toast({
          title: 'Auto-saves cleared',
          description: 'Old auto-save data has been removed.',
        });
      }
    );
  };

  const handleClearAllAutoSaves = () => {
    confirmDelete(
      'Clear all auto-save data? This cannot be undone.',
      () => {
        autoSaveManager.clearAutoSave();
        toast({
          title: 'Auto-saves cleared',
          description: 'All auto-save data has been removed.',
        });
      }
    );
  };

  const handleClearOldHistory = () => {
    confirmDelete(
      'Clear old history versions (older than 30 days)?',
      () => {
        const count = clearOldHistoryVersions();
        toast({
          title: 'History cleared',
          description: `Removed ${count} old version(s).`,
        });
      }
    );
  };

  const handleClearAllHistory = () => {
    confirmDelete(
      'Clear ALL project history? This cannot be undone.',
      () => {
        const count = clearAllHistory();
        toast({
          title: 'History cleared',
          description: `Removed ${count} version(s).`,
        });
      }
    );
  };

  const handleClearAllTemplates = () => {
    confirmDelete(
      'Clear all custom templates? Built-in templates will not be affected.',
      () => {
        const count = clearAllCustomTemplates();
        toast({
          title: 'Templates cleared',
          description: `Removed ${count} custom template(s).`,
        });
      }
    );
  };

  const handleDeleteItem = (key: string) => {
    confirmDelete(
      `Delete "${key}"? This cannot be undone.`,
      () => {
        try {
          localStorage.removeItem(key);
          toast({
            title: 'Item deleted',
            description: `Removed "${key}".`,
          });
        } catch (error) {
          toast({
            title: 'Error',
            description: 'Failed to delete item.',
            variant: 'destructive',
          });
        }
      }
    );
  };

  const formatSize = (kb: number): string => {
    if (kb < 1024) {
      return `${kb.toFixed(2)} KB`;
    }
    return `${(kb / 1024).toFixed(2)} MB`;
  };

  const getWarningConfig = (level: 'safe' | 'warning' | 'critical') => {
    switch (level) {
      case 'critical':
        return {
          icon: AlertCircle,
          color: 'text-destructive',
          bgColor: 'bg-destructive/10',
          borderColor: 'border-destructive',
          progressColor: 'bg-destructive',
          title: 'Critical Storage Level',
          description: 'Storage is nearly full. Please clear some data to avoid issues.',
        };
      case 'warning':
        return {
          icon: AlertTriangle,
          color: 'text-yellow-600 dark:text-yellow-500',
          bgColor: 'bg-yellow-100 dark:bg-yellow-900/20',
          borderColor: 'border-yellow-600 dark:border-yellow-500',
          progressColor: 'bg-yellow-500',
          title: 'Storage Warning',
          description: 'Storage usage is high. Consider cleaning up old data.',
        };
      default:
        return {
          icon: HardDrive,
          color: 'text-primary',
          bgColor: 'bg-primary/10',
          borderColor: 'border-primary',
          progressColor: 'bg-primary',
          title: 'Storage Healthy',
          description: 'Storage usage is at a safe level.',
        };
    }
  };

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Storage Manager</DialogTitle>
            <DialogDescription>Loading storage information...</DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!storageInfo || !storageWarning || !breakdown) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Storage Manager</DialogTitle>
            <DialogDescription>Failed to load storage information.</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }

  const warningConfig = getWarningConfig(storageWarning.level);
  const WarningIcon = warningConfig.icon;
  const usagePercentage = storageInfo.usedPercentage;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HardDrive className="h-5 w-5" />
              Storage Manager
            </DialogTitle>
            <DialogDescription>
              Manage your localStorage usage and cleanup old data
            </DialogDescription>
          </DialogHeader>

          {/* Warning Alert */}
          {storageWarning.level !== 'safe' && (
            <Alert className={`${warningConfig.bgColor} ${warningConfig.borderColor}`}>
              <WarningIcon className={`h-4 w-4 ${warningConfig.color}`} />
              <AlertDescription>
                <div className={`font-semibold ${warningConfig.color}`}>
                  {warningConfig.title}
                </div>
                <div className="text-sm mt-1">{warningConfig.description}</div>
              </AlertDescription>
            </Alert>
          )}

          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="management">Management</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-4 mt-4">
              <div>
                <div className="flex justify-between items-baseline mb-2">
                  <h3 className="text-sm font-medium">Total Storage Usage</h3>
                  <span className="text-sm text-muted-foreground">
                    {formatSize(storageInfo.totalKB)} of{' '}
                    {formatSize(storageInfo.quotaMB * 1024)}
                  </span>
                </div>
                <div className="relative">
                  <Progress 
                    value={usagePercentage} 
                    className={`h-3 ${warningConfig.progressColor === 'bg-destructive' ? '[&>div]:bg-destructive' : warningConfig.progressColor === 'bg-yellow-500' ? '[&>div]:bg-yellow-500' : ''}`}
                  />
                </div>
                <div className="flex justify-between items-center mt-1">
                  <span className={`text-xs font-medium ${warningConfig.color}`}>
                    {usagePercentage.toFixed(1)}% used
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatSize(storageInfo.remainingMB * 1024)} remaining
                  </span>
                </div>
              </div>

              <Separator />

              {/* Category Breakdown */}
              <div>
                <h3 className="text-sm font-medium mb-3">Storage by Category</h3>
                <div className="space-y-3">
                  {breakdown.categories.map((category) => {
                    const Icon = categoryIcons[category.name as keyof typeof categoryIcons] || Package;
                    const label = categoryLabels[category.name as keyof typeof categoryLabels] || category.name;
                    const categoryPercentage = category.percentage;

                    return (
                      <div key={category.name} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">{label}</span>
                            <span className="text-xs text-muted-foreground">
                              ({category.itemCount} {category.itemCount === 1 ? 'item' : 'items'})
                            </span>
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {formatSize(category.kb)}
                          </span>
                        </div>
                        {category.kb > 0 && (
                          <Progress 
                            value={categoryPercentage} 
                            className="h-1.5"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <Separator />

              {/* Storage Stats */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="space-y-1">
                  <div className="text-muted-foreground">Total Items</div>
                  <div className="text-lg font-semibold">
                    {breakdown.items.length}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-muted-foreground">Largest Category</div>
                  <div className="text-lg font-semibold">
                    {(() => {
                      const largest = breakdown.categories[0];
                      return largest ? (categoryLabels[largest.name as keyof typeof categoryLabels] || largest.name) : 'None';
                    })()}
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Management Tab */}
            <TabsContent value="management" className="space-y-4 mt-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">Cleanup Tools</h3>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={loadStorageData}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>

              {/* Auto-Saves Management */}
              {breakdown.categories.some(c => c.name === 'auto-saves' && c.kb > 0) && (
                <div className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <h4 className="text-sm font-medium">Auto-Saves</h4>
                        <p className="text-xs text-muted-foreground">
                          {formatSize(breakdown.categories.find(c => c.name === 'auto-saves')?.kb || 0)}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleClearOldAutoSaves}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Clear Old
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={handleClearAllAutoSaves}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Clear All
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* History Management */}
              {breakdown.categories.some(c => c.name === 'history' && c.kb > 0) && (
                <div className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <History className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <h4 className="text-sm font-medium">Project History</h4>
                        <p className="text-xs text-muted-foreground">
                          {formatSize(breakdown.categories.find(c => c.name === 'history')?.kb || 0)} • {getAllProjectHistories().reduce((sum, h) => sum + h.versions.length, 0)} versions
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleClearOldHistory}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Clear Old
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={handleClearAllHistory}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Clear All
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Templates Management */}
              {getCustomTemplates().length > 0 && (
                <div className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <h4 className="text-sm font-medium">Custom Templates</h4>
                        <p className="text-xs text-muted-foreground">
                          {formatSize(breakdown.categories.find(c => c.name === 'templates')?.kb || 0)} • {getCustomTemplates().length} templates
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={handleClearAllTemplates}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Clear All
                    </Button>
                  </div>
                </div>
              )}

              <Separator />

              {/* Individual Items List */}
              <div>
                <h3 className="text-sm font-medium mb-3">All Storage Items</h3>
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {storageItems.map((item) => {
                    const Icon = categoryIcons[item.category as keyof typeof categoryIcons] || Package;
                    const categoryLabel = categoryLabels[item.category as keyof typeof categoryLabels] || item.category;

                    return (
                      <div
                        key={item.key}
                        className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium truncate" title={item.key}>
                              {item.key}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {categoryLabel} • {formatSize(item.kb)}
                            </div>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteItem(item.key)}
                          className="flex-shrink-0"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>{deleteMessage}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
