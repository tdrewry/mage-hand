import { useState } from 'react';
import { Upload, Map, AlertCircle, Layers, FolderPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
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
  const [additive, setAdditive] = useState(false);
  const [groupOnImport, setGroupOnImport] = useState(false);
  const [groupName, setGroupName] = useState('');

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

  /** Derive a default group name from the file name (strip extension). */
  const deriveGroupName = (file: File) =>
    file.name.replace(/\.[^.]+$/, '');

  const handleFileSelect = async (file: File) => {
    const name = file.name.toLowerCase();
    const isDD2VTT = name.endsWith('.dd2vtt');
    const isPrefab = name.endsWith('.d20prefab');
    const isJSON = name.endsWith('.json');

    if (!isDD2VTT && !isJSON && !isPrefab) {
      setError('Please select a .json (Watabou), .dd2vtt (Dungeondraft), or .d20prefab (Prefab) file');
      return;
    }

    // Auto-fill group name from file name if empty
    if (groupOnImport && !groupName.trim()) {
      setGroupName(deriveGroupName(file));
    }

    setLoading(true);
    setError(null);

    try {
      if (isPrefab) {
        await handlePrefabImport(file);
      } else if (isDD2VTT) {
        await handleDD2VTTImport(file, groupOnImport ? (groupName.trim() || deriveGroupName(file)) : null);
      } else {
        await handleWatabouImport(file, groupOnImport ? (groupName.trim() || deriveGroupName(file)) : null);
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

    const placementX = window.innerWidth / 2;
    const placementY = window.innerHeight / 2;

    const result = await importPrefabToMap(prefab, placementX, placementY);

    const addToken = useSessionStore.getState().addToken;
    result.tokens.forEach(t => addToken(t));
    result.regions.forEach(r => addRegion(r));
    result.mapObjects.forEach(o => addMapObject(o));
    result.lights.forEach(l => addLight(l));

    // Prefabs always recreate their group
    const { restoreGroup } = useGroupStore.getState();
    restoreGroup({
      id: result.group.id,
      name: groupName.trim() || prefab.name,
      members: result.group.members,
      pivot: result.group.pivot ?? { x: 0, y: 0 },
      bounds: result.group.bounds ?? { x: 0, y: 0, width: 0, height: 0 },
      locked: false,
      visible: true,
    });

    const total = result.tokens.length + result.regions.length + result.mapObjects.length + result.lights.length;
    toast.success(`Imported prefab "${prefab.name}"`, {
      description: `${total} entities placed as a group`,
    });
  };

  const makeId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const handleWatabouImport = async (file: File, resolvedGroupName: string | null) => {
    const watabouData = await parseWatabouFile(file);
    const imported = importWatabouDungeon(watabouData);

    if (!additive) {
      clearRegions();
      clearAll();
      clearMapObjects();
    }

    const addedEntityIds: { id: string; type: 'token' | 'region' | 'mapObject' | 'light' }[] = [];

    // Pre-assign IDs so we can track them for grouping
    imported.regions.forEach((region) => {
      const id = makeId('region');
      addRegion({ ...region, id });
      addedEntityIds.push({ id, type: 'region' });
    });

    const doorsWithIds = imported.doors.map((door) => ({ ...door, id: makeId('door') }));
    const doorIds = convertDoorsToMapObjects(doorsWithIds);
    doorIds.forEach(id => addedEntityIds.push({ id, type: 'mapObject' }));

    const annotationsWithIds = imported.annotations.map((annotation) => ({ ...annotation, id: makeId('annotation') }));
    setAnnotations(annotationsWithIds);

    let mapObjectCount = doorIds.length;
    if (imported.columnTiles.length > 0) {
      const terrainId = makeId('terrain');
      const ids = convertTerrainFeatureToMapObjects('column', imported.columnTiles, terrainId);
      ids.forEach(id => addedEntityIds.push({ id, type: 'mapObject' }));
      mapObjectCount += ids.length;
    }

    const featuresWithIds = imported.terrainFeatures.map((feature) => ({ ...feature, id: makeId('terrain') }));
    setTerrainFeatures(featuresWithIds);

    if (resolvedGroupName && addedEntityIds.length > 0) {
      const { addGroup } = useGroupStore.getState();
      const geometries = addedEntityIds.map(e => ({ id: e.id, x: 0, y: 0, width: 50, height: 50 }));
      addGroup(resolvedGroupName, addedEntityIds, geometries);
    }

    toast.success(`Imported dungeon: ${imported.metadata.title || 'Untitled'}`, {
      description: `Loaded ${imported.regions.length} rooms, ${mapObjectCount} objects (${doorIds.length} doors), ${imported.annotations.length} notes${resolvedGroupName ? ` → group "${resolvedGroupName}"` : ''}`,
    });
  };

  const handleDD2VTTImport = async (file: File, resolvedGroupName: string | null) => {
    const dd2vttData = await parseDD2VTTFile(file);
    const imported = importDD2VTTMap(dd2vttData);

    if (!additive) {
      clearRegions();
      clearAll();
      clearMapObjects();
      clearAllLights();
    }

    const addedEntityIds: { id: string; type: 'token' | 'region' | 'mapObject' | 'light' }[] = [];

    const regionId = `region-dd2vtt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    addRegion({ ...imported.region, id: regionId });
    addedEntityIds.push({ id: regionId, type: 'region' });

    try {
      const textureHash = await saveRegionTexture(regionId, imported.imageDataUrl);
      updateRegion(regionId, { textureHash, backgroundImage: imported.imageDataUrl });
    } catch (err) {
      console.warn('Failed to store map texture in IndexedDB:', err);
      updateRegion(regionId, { backgroundImage: imported.imageDataUrl });
    }

    setImportedWallSegments([]);

    imported.doorMapObjects.forEach((doorObj) => {
      const id = makeId('door');
      addMapObject({ ...doorObj, id });
      addedEntityIds.push({ id, type: 'mapObject' });
    });

    imported.wallMapObjects.forEach((wallObj) => {
      const id = makeId('wall');
      addMapObject({ ...wallObj, id });
      addedEntityIds.push({ id, type: 'mapObject' });
    });

    imported.obstacleMapObjects.forEach((obstObj) => {
      const id = makeId('obstacle');
      addMapObject({ ...obstObj, id });
      addedEntityIds.push({ id, type: 'mapObject' });
    });

    imported.lightMapObjects.forEach((lightObj) => {
      const id = makeId('light-obj');
      addMapObject({ ...lightObj, id });
      addedEntityIds.push({ id, type: 'mapObject' });
    });

    setGlobalAmbientLight(imported.ambientLight);

    if (resolvedGroupName && addedEntityIds.length > 0) {
      const { addGroup } = useGroupStore.getState();
      const geometries = addedEntityIds.map(e => ({ id: e.id, x: 0, y: 0, width: 50, height: 50 }));
      addGroup(resolvedGroupName, addedEntityIds, geometries);
    }

    const mapName = file.name.replace(/\.dd2vtt$/i, '');
    toast.success(`Imported dd2vtt map: ${mapName}`, {
      description: `${imported.metadata.mapWidthPx}×${imported.metadata.mapHeightPx}px, ${imported.wallMapObjects.length} walls, ${imported.obstacleMapObjects.length} obstacles, ${imported.doorMapObjects.length} doors, ${imported.lightMapObjects.length} lights${resolvedGroupName ? ` → group "${resolvedGroupName}"` : ''}`,
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  };

  return (
    <div className="p-4 space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Import options */}
      <div className="space-y-3 rounded-md border border-border p-3 bg-muted/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="h-3.5 w-3.5 text-muted-foreground" />
            <Label htmlFor="additive-toggle" className="text-xs font-medium cursor-pointer">
              Additive import
            </Label>
          </div>
          <Switch
            id="additive-toggle"
            checked={additive}
            onCheckedChange={setAdditive}
          />
        </div>
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          {additive ? 'Existing canvas content will be kept.' : 'Canvas will be cleared before import.'}
        </p>

        <div className="border-t border-border/50 pt-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FolderPlus className="h-3.5 w-3.5 text-muted-foreground" />
              <Label htmlFor="group-toggle" className="text-xs font-medium cursor-pointer">
                Group on import
              </Label>
            </div>
            <Switch
              id="group-toggle"
              checked={groupOnImport}
              onCheckedChange={setGroupOnImport}
            />
          </div>
          {groupOnImport && (
            <Input
              placeholder="Group name (auto-filled from file)"
              value={groupName}
              onChange={e => setGroupName(e.target.value)}
              className="h-7 text-xs"
            />
          )}
        </div>
      </div>

      {/* Drop zone */}
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <Map className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <div className="space-y-2">
          <p className="text-sm font-medium">Drop your file here</p>
          <p className="text-xs text-muted-foreground">
            Supports Watabou JSON, Dungeondraft dd2vtt, and d20prefab
          </p>
        </div>

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
