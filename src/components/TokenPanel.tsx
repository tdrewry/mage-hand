import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Upload, Link2 } from 'lucide-react';
import { toast } from 'sonner';

interface TokenPanelProps {
  onAddToken: (imageUrl: string, x?: number, y?: number, gridWidth?: number, gridHeight?: number, color?: string) => void;
}

export const TokenPanel = ({ onAddToken }: TokenPanelProps) => {
  const [urlInput, setUrlInput] = useState('');
  const [gridWidth, setGridWidth] = useState(1);
  const [gridHeight, setGridHeight] = useState(1);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const result = e.target?.result as string;
          onAddToken(result, 100, 100, gridWidth, gridHeight);
          setGridWidth(1);
          setGridHeight(1);
        };
        reader.readAsDataURL(file);
      } else {
        toast.error('Please select an image file');
      }
    }
  };

  const handleUrlSubmit = () => {
    if (urlInput.trim()) {
      onAddToken(urlInput.trim(), 100, 100, gridWidth, gridHeight);
      setUrlInput('');
      setGridWidth(1);
      setGridHeight(1);
    } else {
      toast.error('Please enter a valid URL');
    }
  };

  const addDefaultToken = () => {
    // Generate random bright color (avoiding black)
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
      '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
      '#F8C471', '#82E0AA', '#F1948A', '#85C1E9', '#D7BDE2'
    ];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    
    // Create a simple colored circle as default token
    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 100;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Draw main circle
      ctx.fillStyle = randomColor;
      ctx.beginPath();
      ctx.arc(50, 50, 40, 0, 2 * Math.PI);
      ctx.fill();
      
      // Draw border
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 3;
      ctx.stroke();
      
      // Draw inner highlight
      ctx.strokeStyle = randomColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(50, 50, 37, 0, 2 * Math.PI);
      ctx.stroke();
      
      const dataUrl = canvas.toDataURL();
      onAddToken(dataUrl, 100, 100, gridWidth, gridHeight, randomColor);
      setGridWidth(1);
      setGridHeight(1);
    }
  };

  return (
    <Card className="m-4 bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-card-foreground">Tokens</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="upload" className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-muted">
            <TabsTrigger value="upload" className="text-xs">Upload</TabsTrigger>
            <TabsTrigger value="url" className="text-xs">URL</TabsTrigger>
          </TabsList>
          
          <TabsContent value="upload" className="space-y-3 mt-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="grid-width" className="text-xs text-muted-foreground">
                  Width (grid units)
                </Label>
                <Input
                  id="grid-width"
                  type="number"
                  min="0.5"
                  max="10"
                  step="0.5"
                  value={gridWidth}
                  onChange={(e) => setGridWidth(parseFloat(e.target.value) || 1)}
                  className="mt-1 text-xs"
                />
              </div>
              <div>
                <Label htmlFor="grid-height" className="text-xs text-muted-foreground">
                  Height (grid units)
                </Label>
                <Input
                  id="grid-height"
                  type="number"
                  min="0.5"
                  max="10"
                  step="0.5"
                  value={gridHeight}
                  onChange={(e) => setGridHeight(parseFloat(e.target.value) || 1)}
                  className="mt-1 text-xs"
                />
              </div>
            </div>
            
            <div>
              <Label htmlFor="file-upload" className="text-xs text-muted-foreground">
                Select Image File
              </Label>
              <Input
                id="file-upload"
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="mt-1 text-xs"
              />
            </div>
            
            <Button 
              onClick={addDefaultToken}
              size="sm" 
              variant="outline"
              className="w-full text-xs"
            >
              <Plus className="h-3 w-3 mr-1" />
              Add Default Token ({gridWidth} × {gridHeight})
            </Button>
          </TabsContent>
          
          <TabsContent value="url" className="space-y-3 mt-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="grid-width-url" className="text-xs text-muted-foreground">
                  Width (grid units)
                </Label>
                <Input
                  id="grid-width-url"
                  type="number"
                  min="0.5"
                  max="10"
                  step="0.5"
                  value={gridWidth}
                  onChange={(e) => setGridWidth(parseFloat(e.target.value) || 1)}
                  className="mt-1 text-xs"
                />
              </div>
              <div>
                <Label htmlFor="grid-height-url" className="text-xs text-muted-foreground">
                  Height (grid units)
                </Label>
                <Input
                  id="grid-height-url"
                  type="number"
                  min="0.5"
                  max="10"
                  step="0.5"
                  value={gridHeight}
                  onChange={(e) => setGridHeight(parseFloat(e.target.value) || 1)}
                  className="mt-1 text-xs"
                />
              </div>
            </div>
            
            <div>
              <Label htmlFor="url-input" className="text-xs text-muted-foreground">
                Image URL
              </Label>
              <Input
                id="url-input"
                type="url"
                placeholder="https://example.com/image.png"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                className="mt-1 text-xs"
              />
            </div>
            
            <Button 
              onClick={handleUrlSubmit}
              size="sm"
              className="w-full text-xs"
            >
              <Link2 className="h-3 w-3 mr-1" />
              Add from URL ({gridWidth} × {gridHeight})
            </Button>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};