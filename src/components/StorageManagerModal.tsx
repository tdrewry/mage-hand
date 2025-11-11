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
import { 
  getStorageStatus, 
  getStorageBreakdown,
  type StorageInfo,
  type StorageWarning,
  type StorageBreakdown
} from '@/lib/storageManager';
import { 
  HardDrive, 
  AlertTriangle, 
  AlertCircle,
  Database,
  Clock,
  History,
  FileText,
  FolderOpen,
  Package
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
  const [loading, setLoading] = useState(true);

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
      setStorageInfo(status.info);
      setStorageWarning(status.warning);
      setBreakdown(storageBreakdown);
    } catch (error) {
      console.error('Failed to load storage data:', error);
    } finally {
      setLoading(false);
    }
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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

        {/* Storage Overview */}
        <div className="space-y-4">
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
