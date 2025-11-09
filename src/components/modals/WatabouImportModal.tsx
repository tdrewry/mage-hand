import { useState } from 'react';
import { Upload, FileJson, AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { parseWatabouFile, importWatabouDungeon } from '@/lib/watabouImporter';
import { useRegionStore } from '@/stores/regionStore';
import { useDungeonStore } from '@/stores/dungeonStore';
import { toast } from 'sonner';

interface WatabouImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const WatabouImportModal = ({ open, onOpenChange }: WatabouImportModalProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const addRegion = useRegionStore((state) => state.addRegion);
  const clearRegions = useRegionStore((state) => state.clearRegions);
  
  const setDoors = useDungeonStore((state) => state.setDoors);
  const setAnnotations = useDungeonStore((state) => state.setAnnotations);
  const setTerrainFeatures = useDungeonStore((state) => state.setTerrainFeatures);
  const clearAll = useDungeonStore((state) => state.clearAll);

  const handleFileSelect = async (file: File) => {
    if (!file.name.endsWith('.json')) {
      setError('Please select a JSON file');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Parse the Watabou JSON
      const watabouData = await parseWatabouFile(file);
      
      // Convert to our format
      const imported = importWatabouDungeon(watabouData);
      
      // Clear existing data
      clearRegions();
      clearAll();
      
      // Import regions
      imported.regions.forEach((region) => {
        addRegion(region);
      });
      
      // Import doors
      const doorsWithIds = imported.doors.map((door) => ({
        ...door,
        id: `door-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      }));
      setDoors(doorsWithIds);
      
      // Import annotations
      const annotationsWithIds = imported.annotations.map((annotation) => ({
        ...annotation,
        id: `annotation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      }));
      setAnnotations(annotationsWithIds);
      
      // Import terrain features
      const featuresWithIds = imported.terrainFeatures.map((feature) => ({
        ...feature,
        id: `terrain-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      }));
      setTerrainFeatures(featuresWithIds);
      
      toast.success(`Imported dungeon: ${imported.metadata.title || 'Untitled'}`, {
        description: `Loaded ${imported.regions.length} rooms, ${imported.doors.length} doors, ${imported.annotations.length} notes`,
      });
      
      onOpenChange(false);
    } catch (err) {
      console.error('Import error:', err);
      setError(err instanceof Error ? err.message : 'Failed to import dungeon');
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Import Watabou Dungeon</DialogTitle>
          <DialogDescription>
            Import a dungeon from Watabou's One Page Dungeon generator
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragging
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/50'
            }`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <FileJson className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <div className="space-y-2">
              <p className="text-sm font-medium">
                Drop your Watabou JSON file here
              </p>
              <p className="text-xs text-muted-foreground">
                or click to browse files
              </p>
            </div>

            <Label htmlFor="file-upload" className="cursor-pointer">
              <Button
                type="button"
                variant="outline"
                className="mt-4"
                disabled={loading}
                onClick={() => document.getElementById('file-upload')?.click()}
              >
                <Upload className="h-4 w-4 mr-2" />
                {loading ? 'Importing...' : 'Select File'}
              </Button>
            </Label>

            <input
              id="file-upload"
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleFileInput}
              disabled={loading}
            />
          </div>

          <div className="text-xs text-muted-foreground space-y-1">
            <p>Generate dungeons at:</p>
            <a
              href="https://watabou.github.io/one-page-dungeon"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              watabou.github.io/one-page-dungeon
            </a>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
