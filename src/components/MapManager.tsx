import React, { useState } from 'react';
import { useMapStore, GameMap, GridRegion } from '../stores/mapStore';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Slider } from './ui/slider';
import { Switch } from './ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import { 
  Settings, 
  Plus, 
  Trash2, 
  Eye, 
  EyeOff, 
  GripVertical,
  Map as MapIcon,
  Grid,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';

interface MapManagerProps {
  onClose: () => void;
}

export const MapManager: React.FC<MapManagerProps> = ({ onClose }) => {
  const {
    maps,
    selectedMapId,
    addMap,
    updateMap,
    removeMap,
    setSelectedMap,
    reorderMaps,
    addRegion,
    updateRegion,
    removeRegion,
  } = useMapStore();

  const [expandedMaps, setExpandedMaps] = useState<Set<string>>(new Set([selectedMapId || '']));
  const [newMapName, setNewMapName] = useState('New Map');
  const [newRegionName, setNewRegionName] = useState('New Region');

  const selectedMap = maps.find(m => m.id === selectedMapId);

  const toggleMapExpanded = (mapId: string) => {
    setExpandedMaps(prev => {
      const newSet = new Set(prev);
      if (newSet.has(mapId)) {
        newSet.delete(mapId);
      } else {
        newSet.add(mapId);
      }
      return newSet;
    });
  };

  const handleAddMap = () => {
    addMap({
      name: newMapName,
      bounds: { x: 0, y: 0, width: 1600, height: 1200 },
      backgroundColor: '#2a2a2a',
      visible: true,
      zIndex: maps.length,
      regions: [{
        name: 'Main Region',
        bounds: { x: 0, y: 0, width: 1600, height: 1200 },
        gridType: 'square' as const,
        gridSize: 40,
        gridColor: '#ffffff',
        gridOpacity: 80,
        visible: true,
      }],
    });
    setNewMapName('New Map');
    toast.success('Map created successfully');
  };

  const handleAddRegion = (mapId: string) => {
    const map = maps.find(m => m.id === mapId);
    if (!map) return;

    addRegion(mapId, {
      name: newRegionName,
      bounds: { 
        x: map.bounds.x + 100, 
        y: map.bounds.y + 100, 
        width: 400, 
        height: 400 
      },
      gridType: 'square',
      gridSize: 40,
      gridColor: '#ffffff',
      gridOpacity: 80,
      visible: true,
    });
    setNewRegionName('New Region');
    toast.success('Region added successfully');
  };

  const handleRemoveMap = (mapId: string) => {
    if (maps.length <= 1) {
      toast.error('Cannot remove the last map');
      return;
    }
    removeMap(mapId);
    toast.success('Map removed');
  };

  return (
    <div className="fixed top-4 right-4 w-96 max-h-[calc(100vh-2rem)] z-50">
      <Card className="bg-background/95 backdrop-blur-sm border shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <MapIcon className="h-5 w-5" />
              Map Manager
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={onClose}>
              ×
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="max-h-[60vh] overflow-y-auto">
          <Tabs defaultValue="maps" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="maps">Maps</TabsTrigger>
              <TabsTrigger value="regions">Regions</TabsTrigger>
            </TabsList>
            
            <TabsContent value="maps" className="space-y-4 mt-4">
              {/* Add New Map */}
              <div className="space-y-2">
                <Label htmlFor="new-map-name">Add New Map</Label>
                <div className="flex gap-2">
                  <Input
                    id="new-map-name"
                    value={newMapName}
                    onChange={(e) => setNewMapName(e.target.value)}
                    placeholder="Map name"
                  />
                  <Button onClick={handleAddMap} size="sm">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Maps List */}
              <div className="space-y-2">
                {maps.map((map) => (
                  <div key={map.id} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleMapExpanded(map.id)}
                          className="p-0 h-auto"
                        >
                          {expandedMaps.has(map.id) ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </Button>
                        <Input
                          value={map.name}
                          onChange={(e) => updateMap(map.id, { name: e.target.value })}
                          className="h-8 text-sm font-medium"
                        />
                      </div>
                      
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => updateMap(map.id, { visible: !map.visible })}
                          className="p-1"
                        >
                          {map.visible ? (
                            <Eye className="h-4 w-4" />
                          ) : (
                            <EyeOff className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedMap(map.id)}
                          disabled={selectedMapId === map.id}
                          className="p-1"
                        >
                          <Settings className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveMap(map.id)}
                          disabled={maps.length <= 1}
                          className="p-1 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <Collapsible open={expandedMaps.has(map.id)}>
                      <CollapsibleContent className="space-y-3">
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <Label>Width</Label>
                            <Input
                              type="number"
                              value={map.bounds.width}
                              onChange={(e) => updateMap(map.id, {
                                bounds: { ...map.bounds, width: parseInt(e.target.value) || 0 }
                              })}
                              className="h-7"
                            />
                          </div>
                          <div>
                            <Label>Height</Label>
                            <Input
                              type="number"
                              value={map.bounds.height}
                              onChange={(e) => updateMap(map.id, {
                                bounds: { ...map.bounds, height: parseInt(e.target.value) || 0 }
                              })}
                              className="h-7"
                            />
                          </div>
                        </div>
                        
                        <div>
                          <Label>Background Color</Label>
                          <Input
                            type="color"
                            value={map.backgroundColor}
                            onChange={(e) => updateMap(map.id, { backgroundColor: e.target.value })}
                            className="h-8"
                          />
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </div>
                ))}
              </div>
            </TabsContent>
            
            <TabsContent value="regions" className="space-y-4 mt-4">
              {selectedMap && (
                <>
                  <div className="space-y-2">
                    <Label>Add Region to: {selectedMap.name}</Label>
                    <div className="flex gap-2">
                      <Input
                        value={newRegionName}
                        onChange={(e) => setNewRegionName(e.target.value)}
                        placeholder="Region name"
                      />
                      <Button onClick={() => handleAddRegion(selectedMap.id)} size="sm">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {selectedMap.regions.map((region) => (
                      <div key={region.id} className="border rounded-lg p-3 space-y-3">
                        <div className="flex items-center justify-between">
                          <Input
                            value={region.name}
                            onChange={(e) => updateRegion(selectedMap.id, region.id, { name: e.target.value })}
                            className="h-7 font-medium"
                          />
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => updateRegion(selectedMap.id, region.id, { visible: !region.visible })}
                              className="p-1"
                            >
                              {region.visible ? (
                                <Eye className="h-4 w-4" />
                              ) : (
                                <EyeOff className="h-4 w-4 text-muted-foreground" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeRegion(selectedMap.id, region.id)}
                              disabled={selectedMap.regions.length <= 1}
                              className="p-1 text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div>
                            <Label className="text-xs">Grid Type</Label>
                            <Select
                              value={region.gridType}
                              onValueChange={(value: 'square' | 'hex' | 'none') =>
                                updateRegion(selectedMap.id, region.id, { gridType: value })
                              }
                            >
                              <SelectTrigger className="h-7">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="square">Square</SelectItem>
                                <SelectItem value="hex">Hexagon</SelectItem>
                                <SelectItem value="none">None</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {region.gridType !== 'none' && (
                            <>
                              <div>
                                <Label className="text-xs">Grid Size: {region.gridSize}px</Label>
                                <Slider
                                  value={[region.gridSize]}
                                  onValueChange={([value]) =>
                                    updateRegion(selectedMap.id, region.id, { gridSize: value })
                                  }
                                  min={20}
                                  max={100}
                                  step={5}
                                  className="mt-1"
                                />
                              </div>

                              <div>
                                <Label className="text-xs">Opacity: {region.gridOpacity}%</Label>
                                <Slider
                                  value={[region.gridOpacity]}
                                  onValueChange={([value]) =>
                                    updateRegion(selectedMap.id, region.id, { gridOpacity: value })
                                  }
                                  min={10}
                                  max={100}
                                  step={5}
                                  className="mt-1"
                                />
                              </div>

                              <div>
                                <Label className="text-xs">Color</Label>
                                <Input
                                  type="color"
                                  value={region.gridColor}
                                  onChange={(e) =>
                                    updateRegion(selectedMap.id, region.id, { gridColor: e.target.value })
                                  }
                                  className="h-7"
                                />
                              </div>
                            </>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <Label>X</Label>
                            <Input
                              type="number"
                              value={region.bounds.x}
                              onChange={(e) => updateRegion(selectedMap.id, region.id, {
                                bounds: { ...region.bounds, x: parseInt(e.target.value) || 0 }
                              })}
                              className="h-6"
                            />
                          </div>
                          <div>
                            <Label>Y</Label>
                            <Input
                              type="number"
                              value={region.bounds.y}
                              onChange={(e) => updateRegion(selectedMap.id, region.id, {
                                bounds: { ...region.bounds, y: parseInt(e.target.value) || 0 }
                              })}
                              className="h-6"
                            />
                          </div>
                          <div>
                            <Label>Width</Label>
                            <Input
                              type="number"
                              value={region.bounds.width}
                              onChange={(e) => updateRegion(selectedMap.id, region.id, {
                                bounds: { ...region.bounds, width: parseInt(e.target.value) || 0 }
                              })}
                              className="h-6"
                            />
                          </div>
                          <div>
                            <Label>Height</Label>
                            <Input
                              type="number"
                              value={region.bounds.height}
                              onChange={(e) => updateRegion(selectedMap.id, region.id, {
                                bounds: { ...region.bounds, height: parseInt(e.target.value) || 0 }
                              })}
                              className="h-6"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
              
              {!selectedMap && (
                <div className="text-center text-muted-foreground">
                  Select a map to manage its regions
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};