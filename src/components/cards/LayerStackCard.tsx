import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { GripVertical, Eye, EyeOff } from 'lucide-react';
import { Canvas as FabricCanvas } from 'fabric';

interface Layer {
  id: string;
  name: string;
  type: 'background' | 'grid' | 'map' | 'token';
  visible: boolean;
  objects: any[];
}

interface LayerStackCardContentProps {
  fabricCanvas?: FabricCanvas | null;
}

export function LayerStackCardContent({ fabricCanvas }: LayerStackCardContentProps) {
  const [layers, setLayers] = useState<Layer[]>([
    { id: 'background', name: 'Background', type: 'background', visible: true, objects: [] },
    { id: 'grid', name: 'Grid', type: 'grid', visible: true, objects: [] },
    { id: 'map', name: 'Map', type: 'map', visible: true, objects: [] },
    { id: 'token', name: 'Tokens', type: 'token', visible: true, objects: [] },
  ]);

  const [draggedLayer, setDraggedLayer] = useState<string | null>(null);

  const handleDragStart = (layerId: string) => {
    setDraggedLayer(layerId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetLayerId: string) => {
    e.preventDefault();
    if (!draggedLayer || draggedLayer === targetLayerId) return;

    const newLayers = [...layers];
    const draggedIndex = newLayers.findIndex(l => l.id === draggedLayer);
    const targetIndex = newLayers.findIndex(l => l.id === targetLayerId);
    
    const [draggedLayerObj] = newLayers.splice(draggedIndex, 1);
    newLayers.splice(targetIndex, 0, draggedLayerObj);
    
    setLayers(newLayers);
    setDraggedLayer(null);
    
    applyLayerOrdering(newLayers);
  };

  const toggleLayerVisibility = (layerId: string) => {
    setLayers(prev => prev.map(layer => 
      layer.id === layerId 
        ? { ...layer, visible: !layer.visible }
        : layer
    ));
    
    applyLayerVisibility(layerId);
  };

  const applyLayerOrdering = (orderedLayers: Layer[]) => {
    if (!fabricCanvas) return;
    
    const objects = fabricCanvas.getObjects();
    
    const layerObjects = {
      grid: objects.filter((obj: any) => obj.isGrid),
      map: objects.filter((obj: any) => obj.isMap),
      token: objects.filter((obj: any) => obj.tokenId),
    };
    
    fabricCanvas.clear();
    
    orderedLayers.forEach(layer => {
      if (layer.type in layerObjects && layer.visible) {
        layerObjects[layer.type as keyof typeof layerObjects].forEach(obj => {
          fabricCanvas.add(obj);
        });
      }
    });
    
    fabricCanvas.renderAll();
  };

  const applyLayerVisibility = (layerId: string) => {
    if (!fabricCanvas) return;
    
    const layer = layers.find(l => l.id === layerId);
    if (!layer) return;
    
    const objects = fabricCanvas.getObjects();
    
    objects.forEach((obj: any) => {
      if (layer.type === 'grid' && obj.isGrid) {
        obj.set('visible', layer.visible);
      } else if (layer.type === 'map' && obj.isMap) {
        obj.set('visible', layer.visible);
      } else if (layer.type === 'token' && obj.tokenId) {
        obj.set('visible', layer.visible);
      }
    });
    
    fabricCanvas.renderAll();
  };

  const getLayerIcon = (type: Layer['type']) => {
    switch (type) {
      case 'background': return '🎨';
      case 'grid': return '⚏';
      case 'map': return '🗺️';
      case 'token': return '⚹';
      default: return '📄';
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Drag layers to reorder them. Top layers render above bottom layers.
      </p>
      
      <div className="space-y-2">
        {layers.map((layer) => (
          <div
            key={layer.id}
            draggable
            onDragStart={() => handleDragStart(layer.id)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, layer.id)}
            className={`
              flex items-center gap-3 p-3 bg-card border border-border rounded-lg cursor-move
              hover:bg-accent/50 transition-colors
              ${draggedLayer === layer.id ? 'opacity-50' : ''}
            `}
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
            
            <span className="text-lg">{getLayerIcon(layer.type)}</span>
            
            <div className="flex-1">
              <div className="font-medium text-sm text-foreground">{layer.name}</div>
              <Badge variant="outline" className="text-xs">
                {layer.type}
              </Badge>
            </div>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => toggleLayerVisibility(layer.id)}
              className="h-8 w-8 p-0"
            >
              {layer.visible ? (
                <Eye className="h-4 w-4" />
              ) : (
                <EyeOff className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
