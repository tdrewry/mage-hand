import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Upload, Link2 } from 'lucide-react';
import { toast } from 'sonner';

interface TokenPanelProps {
  onAddToken: (imageUrl: string, x?: number, y?: number) => void;
}

export const TokenPanel = ({ onAddToken }: TokenPanelProps) => {
  const [urlInput, setUrlInput] = useState('');

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const result = e.target?.result as string;
          onAddToken(result);
        };
        reader.readAsDataURL(file);
      } else {
        toast.error('Please select an image file');
      }
    }
  };

  const handleUrlSubmit = () => {
    if (urlInput.trim()) {
      onAddToken(urlInput.trim());
      setUrlInput('');
    } else {
      toast.error('Please enter a valid URL');
    }
  };

  const addDefaultToken = () => {
    // Create a simple colored circle as default token
    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 100;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = 'hsl(var(--primary))';
      ctx.beginPath();
      ctx.arc(50, 50, 40, 0, 2 * Math.PI);
      ctx.fill();
      ctx.strokeStyle = 'hsl(var(--primary-foreground))';
      ctx.lineWidth = 4;
      ctx.stroke();
      
      const dataUrl = canvas.toDataURL();
      onAddToken(dataUrl);
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
              Add Default Token
            </Button>
          </TabsContent>
          
          <TabsContent value="url" className="space-y-3 mt-3">
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
              Add from URL
            </Button>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};