import { useState } from 'react';
import { Upload, FileJson, AlertCircle, Map, PackagePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { parseWatabouFile, importWatabouDungeon } from '@/lib/watabouImporter';
import { parseDD2VTTFile, importDD2VTTMap } from '@/lib/dd2vttImporter';
import { parsePrefabFile, importPrefabToMap } from '@/lib/groupSerializer';
import { useRegionStore } from '@/stores/regionStore';
import { useDungeonStore } from '@/stores/dungeonStore';
import { useMapObjectStore } from '@/stores/mapObjectStore';
import { useLightStore } from '@/stores/lightStore';
import { useSessionStore } from '@/stores/sessionStore';
import { useGroupStore } from '@/stores/groupStore';
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
  const addMapObject = useMapObjectStore((state) => state.addMapObject);
  const clearMapObjects = useMapObjectStore((state) => state.clearMapObjects);

  const addLight = useLightStore((state) => state.addLight);
  const clearAllLights = useLightStore((state) => state.clearAllLights);
  const setGlobalAmbientLight = useLightStore((state) => state.setGlobalAmbientLight);

  const handleFileSelect = async (file: File) => {
    const name = file.name.toLowerCase();
    const isDD2VTT = name.endsWith('.dd2vtt');
    const isPrefab = name.endsWith('.d20prefab');
    const isJSON = name.endsWith('.json');

    if (!isDD2VTT && !isJSON && !isPrefab) {
      setError('Please select a .json (Watabou), .dd2vtt (Dungeondraft), or .d20prefab (Prefab) file');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (isPrefab) {
        await handlePrefabImport(file);
      } else if (isDD2VTT) {
        await handleDD2VTTImport(file);
      } else {
        await handleWatabouImport(file);
      }
    } catch (err) {
      console.error('Import error:', err);
      setError(err instanceof Error ? err.message : 'Failed to import');
    } finally {
      setLoading(false);
    }
  };

  const handlePrefabImport = async (file: File) => {
    const text = await file.text();
    const prefab = parsePrefabFile(text);
    
    // Place at center of current viewport
    const placementX = window.innerWidth / 2;
    const placementY = window.innerHeight / 2;
    
    const result = await importPrefabToMap(prefab, placementX, placementY);
    
    // Add entities to stores
    const addToken = useSessionStore.getState().addToken;
    result.tokens.forEach(t => addToken(t));
    result.regions.forEach(r => addRegion(r));
    result.mapObjects.forEach(o => addMapObject(o));
    result.lights.forEach(l => addLight(l));
    
    // Add the reconstituted group
    const addGroup = useGroupStore.getState().addGroup;
    const geometries = [
      ...result.tokens.map(t => ({ id: t.id, x: t.x, y: t.y, width: (t.gridWidth || 1) * 40, height: (t.gridHeight || 1) * 40 })),
      ...result.regions.map(r => ({ id: r.id, x: r.x, y: r.y, width: r.width, height: r.height })),
      ...result.mapObjects.map(o => ({ id: o.id, x: o.position.x, y: o.position.y, width: o.width || 40, height: o.height || 40 })),
      ...result.lights.map(l => ({ id: l.id, x: l.position.x, y: l.position.y, width: 30, height: 30 })),
    ];
    addGroup(prefab.name, result.group.members, geometries);

    const total = result.tokens.length + result.regions.length + result.mapObjects.length + result.lights.length;
    toast.success(`Imported prefab "${prefab.name}"`, {
      description: `${total} entities placed as a group`,
    });
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
    
    // Wall segments are now handled via MapObjects (wallMapObjects below),
    // so we clear importedWallSegments to avoid duplicate/stale segments
    setImportedWallSegments([]);
    
    // Add door MapObjects with proper rotation from dd2vtt data
    imported.doorMapObjects.forEach((doorObj) => {
      addMapObject(doorObj);
    });
    const doorCount = imported.doorMapObjects.length;
    
    // Add wall polylines as MapObjects
    imported.wallMapObjects.forEach((wallObj) => {
      addMapObject(wallObj);
    });
    
    // Add obstacle polylines as separate MapObjects
    imported.obstacleMapObjects.forEach((obstObj) => {
      addMapObject(obstObj);
    });
    
    // Import lights as MapObjects with embedded light data
    // Light MapObjects are the single source of truth - they drive both
    // the visual indicator (DM view) and the illumination/fog engine
    imported.lightMapObjects.forEach((lightObj) => {
      addMapObject(lightObj);
    });
    
    // Set ambient light level
    setGlobalAmbientLight(imported.ambientLight);
    
    const mapName = file.name.replace(/\.dd2vtt$/i, '');
    toast.success(`Imported dd2vtt map: ${mapName}`, {
      description: `${imported.metadata.mapWidthPx}×${imported.metadata.mapHeightPx}px, ${imported.wallMapObjects.length} walls, ${imported.obstacleMapObjects.length} obstacles, ${doorCount} doors, ${imported.lightMapObjects.length} lights`,
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
            Drop your file here
          </p>
          <p className="text-xs text-muted-foreground">
            Supports Watabou JSON, Dungeondraft dd2vtt, and d20prefab
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
          accept=".json,.dd2vtt,.d20prefab"
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
          <li><strong>.d20prefab</strong> — Group Prefab (rooms, encounters)</li>
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
