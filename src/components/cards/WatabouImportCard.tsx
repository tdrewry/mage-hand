import { useState } from 'react';
import { Upload, FileJson, AlertCircle, Map } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { parseWatabouFile, importWatabouDungeon } from '@/lib/watabouImporter';
import { parseDD2VTTFile, importDD2VTTMap } from '@/lib/dd2vttImporter';
import { useRegionStore } from '@/stores/regionStore';
import { useDungeonStore } from '@/stores/dungeonStore';
import { useMapObjectStore } from '@/stores/mapObjectStore';
import { useLightStore } from '@/stores/lightStore';
import { saveRegionTexture } from '@/lib/textureStorage';
import { toast } from 'sonner';

export const WatabouImportCardContent = () => {
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const addRegion = useRegionStore((state) => state.addRegion);
  const updateRegion = useRegionStore((state) => state.updateRegion);
  const clearRegions = useRegionStore((state) => state.clearRegions);
  
  const setAnnotations = useDungeonStore((state) => state.setAnnotations);
  const setTerrainFeatures = useDungeonStore((state) => state.setTerrainFeatures);
  const setImportedWallSegments = useDungeonStore((state) => state.setImportedWallSegments);
  const clearAll = useDungeonStore((state) => state.clearAll);
  
  const convertTerrainFeatureToMapObjects = useMapObjectStore((state) => state.convertTerrainFeatureToMapObjects);
  const convertDoorsToMapObjects = useMapObjectStore((state) => state.convertDoorsToMapObjects);
  const clearMapObjects = useMapObjectStore((state) => state.clearMapObjects);

  const addLight = useLightStore((state) => state.addLight);
  const clearAllLights = useLightStore((state) => state.clearAllLights);
  const setGlobalAmbientLight = useLightStore((state) => state.setGlobalAmbientLight);

  const handleFileSelect = async (file: File) => {
    const isDD2VTT = file.name.toLowerCase().endsWith('.dd2vtt');
    const isJSON = file.name.toLowerCase().endsWith('.json');

    if (!isDD2VTT && !isJSON) {
      setError('Please select a .json (Watabou) or .dd2vtt (Dungeondraft) file');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (isDD2VTT) {
        await handleDD2VTTImport(file);
      } else {
        await handleWatabouImport(file);
      }
    } catch (err) {
      console.error('Import error:', err);
      setError(err instanceof Error ? err.message : 'Failed to import map');
    } finally {
      setLoading(false);
    }
  };

  const handleWatabouImport = async (file: File) => {
    const watabouData = await parseWatabouFile(file);
    const imported = importWatabouDungeon(watabouData);
    
    // Clear existing data
    clearRegions();
    clearAll();
    clearMapObjects();
    
    // Import regions
    imported.regions.forEach((region) => {
      addRegion(region);
    });
    
    // Convert doors to interactive MapObjects
    const doorsWithIds = imported.doors.map((door) => ({
      ...door,
      id: `door-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    }));
    const doorIds = convertDoorsToMapObjects(doorsWithIds);
    
    // Import annotations
    const annotationsWithIds = imported.annotations.map((annotation) => ({
      ...annotation,
      id: `annotation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    }));
    setAnnotations(annotationsWithIds);
    
    // Convert column tiles to interactive MapObjects
    let mapObjectCount = doorIds.length;
    if (imported.columnTiles.length > 0) {
      const terrainId = `terrain-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const ids = convertTerrainFeatureToMapObjects('column', imported.columnTiles, terrainId);
      mapObjectCount += ids.length;
    }
    
    // Import terrain features (water only)
    const featuresWithIds = imported.terrainFeatures.map((feature) => ({
      ...feature,
      id: `terrain-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    }));
    setTerrainFeatures(featuresWithIds);
    
    toast.success(`Imported dungeon: ${imported.metadata.title || 'Untitled'}`, {
      description: `Loaded ${imported.regions.length} rooms, ${mapObjectCount} objects (${doorIds.length} doors), ${imported.annotations.length} notes`,
    });
  };

  const handleDD2VTTImport = async (file: File) => {
    const dd2vttData = await parseDD2VTTFile(file);
    const imported = importDD2VTTMap(dd2vttData);
    
    // Clear existing data
    clearRegions();
    clearAll();
    clearMapObjects();
    clearAllLights();
    
    // Create region with unique ID
    const regionId = `region-dd2vtt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    addRegion({ ...imported.region, id: regionId });
    
    // Store the map image as a texture in IndexedDB
    try {
      const textureHash = await saveRegionTexture(regionId, imported.imageDataUrl);
      // Update region with texture hash and in-memory image
      updateRegion(regionId, {
        textureHash,
        backgroundImage: imported.imageDataUrl,
      });
    } catch (err) {
      console.warn('Failed to store map texture in IndexedDB:', err);
      // Still set the in-memory image so it displays
      updateRegion(regionId, {
        backgroundImage: imported.imageDataUrl,
      });
    }
    
    // Import wall segments for vision/fog system
    setImportedWallSegments(imported.wallSegments);
    
    // Convert doors to interactive MapObjects
    const doorIds = convertDoorsToMapObjects(imported.doors);
    
    // Import lights
    imported.lights.forEach((light) => {
      addLight(light);
    });
    
    // Set ambient light level
    setGlobalAmbientLight(imported.ambientLight);
    
    const mapName = file.name.replace(/\.dd2vtt$/i, '');
    toast.success(`Imported dd2vtt map: ${mapName}`, {
      description: `${imported.metadata.mapWidthPx}×${imported.metadata.mapHeightPx}px, ${imported.wallSegments.length} wall segments, ${doorIds.length} doors, ${imported.lights.length} lights`,
    });
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
    <div className="p-4 space-y-4">
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
        <Map className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <div className="space-y-2">
          <p className="text-sm font-medium">
            Drop your map file here
          </p>
          <p className="text-xs text-muted-foreground">
            Supports Watabou JSON and Dungeondraft dd2vtt
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
          accept=".json,.dd2vtt"
          className="hidden"
          onChange={handleFileInput}
          disabled={loading}
        />
      </div>

      <div className="text-xs text-muted-foreground space-y-2">
        <p className="font-medium">Supported formats:</p>
        <ul className="list-disc list-inside space-y-1 ml-2">
          <li><strong>.json</strong> — Watabou One-Page Dungeon</li>
          <li><strong>.dd2vtt</strong> — Dungeondraft Universal VTT</li>
        </ul>
      </div>

      <div className="text-xs text-muted-foreground space-y-2">
        <p className="font-medium">dd2vtt imports include:</p>
        <ul className="list-disc list-inside space-y-1 ml-2">
          <li>Map image → Region background</li>
          <li>Walls → Vision/fog blocking</li>
          <li>Portals → Interactive doors</li>
          <li>Lights → Light sources</li>
        </ul>
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
  );
};
