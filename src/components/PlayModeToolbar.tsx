import React, { useState } from 'react';
import { Button } from './ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip';
import {
  Settings,
  Plus,
  Eye,
  Palette,
  CloudFog,
  EyeOff,
  Layers,
} from 'lucide-react';
import { toast } from 'sonner';
import { LayerStackModal } from './LayerStackModal';
import { TokenPanelModal } from './modals/TokenPanelModal';
import { VisibilityModal } from './modals/VisibilityModal';
import { FogControlModal } from './modals/FogControlModal';
import { Canvas as FabricCanvas } from 'fabric';
import { useFogStore } from '@/stores/fogStore';

interface PlayModeToolbarProps {
  showNegativeSpacePanel: boolean;
  onToggleNegativeSpacePanel: () => void;
  showRegions: boolean;
  onToggleRegions: () => void;
  fabricCanvas?: FabricCanvas | null;
  onAddToken: (imageUrl: string, x?: number, y?: number, gridWidth?: number, gridHeight?: number, color?: string) => void;
}

export const PlayModeToolbar: React.FC<PlayModeToolbarProps> = ({
  showNegativeSpacePanel,
  onToggleNegativeSpacePanel,
  showRegions,
  onToggleRegions,
  fabricCanvas,
  onAddToken,
}) => {
  const [layerModalOpen, setLayerModalOpen] = useState(false);
  const [tokensModalOpen, setTokensModalOpen] = useState(false);
  const [visibilityModalOpen, setVisibilityModalOpen] = useState(false);
  const [fogModalOpen, setFogModalOpen] = useState(false);
  
  const { enabled: fogEnabled } = useFogStore();

  return (
    <TooltipProvider>
      <div className="absolute top-20 right-4 z-10">
        <div className="bg-card/95 backdrop-blur-sm border border-border rounded-lg shadow-lg p-2 flex flex-col gap-2">
          {/* Settings - placeholder for now */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => toast.info('Settings coming soon')}
                className="w-10 h-10"
              >
                <Settings className="w-5 h-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              <p>Settings</p>
            </TooltipContent>
          </Tooltip>

          {/* Tokens */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setTokensModalOpen(true)}
                className="w-10 h-10"
              >
                <Plus className="w-5 h-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              <p>Tokens</p>
            </TooltipContent>
          </Tooltip>

          {/* Visibility */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setVisibilityModalOpen(true)}
                className="w-10 h-10"
              >
                <Eye className="w-5 h-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              <p>Visibility</p>
            </TooltipContent>
          </Tooltip>

          <div className="h-px bg-border" />

          {/* Styles */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={showNegativeSpacePanel ? "default" : "ghost"}
                size="icon"
                onClick={onToggleNegativeSpacePanel}
                className="w-10 h-10"
              >
                <Palette className="w-5 h-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              <p>Styles</p>
            </TooltipContent>
          </Tooltip>

          {/* Fog of War Toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={fogEnabled ? "default" : "ghost"}
                size="icon"
                onClick={() => setFogModalOpen(true)}
                className="w-10 h-10"
              >
                <CloudFog className="w-5 h-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              <p>Fog of War {fogEnabled ? 'On' : 'Off'}</p>
            </TooltipContent>
          </Tooltip>

          {/* Show Regions Toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={showRegions ? "default" : "ghost"}
                size="icon"
                onClick={onToggleRegions}
                className="w-10 h-10"
              >
                {showRegions ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              <p>Regions {showRegions ? 'On' : 'Off'}</p>
            </TooltipContent>
          </Tooltip>

          <div className="h-px bg-border" />

          {/* Layers */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setLayerModalOpen(true)}
                className="w-10 h-10"
              >
                <Layers className="w-5 h-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              <p>Manage Layers</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Modals */}
      <TokenPanelModal
        open={tokensModalOpen}
        onOpenChange={setTokensModalOpen}
        onAddToken={onAddToken}
      />

      <VisibilityModal
        open={visibilityModalOpen}
        onOpenChange={setVisibilityModalOpen}
      />

      <FogControlModal
        open={fogModalOpen}
        onOpenChange={setFogModalOpen}
      />

      <LayerStackModal 
        open={layerModalOpen}
        onOpenChange={setLayerModalOpen}
        fabricCanvas={fabricCanvas}
      />
    </TooltipProvider>
  );
};
