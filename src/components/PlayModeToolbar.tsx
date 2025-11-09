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
  Palette,
  CloudFog,
  EyeOff,
  Eye,
  Layers,
  Grid3X3,
  Swords,
  Lock,
  LockOpen,
} from 'lucide-react';
import { toast } from 'sonner';
import { LayerStackModal } from './LayerStackModal';
import { FogControlModal } from './modals/FogControlModal';
import { BackgroundGridModal } from './modals/BackgroundGridModal';
import { Canvas as FabricCanvas } from 'fabric';
import { useFogStore } from '@/stores/fogStore';
import { useInitiativeStore } from '@/stores/initiativeStore';

interface PlayModeToolbarProps {
  showNegativeSpacePanel: boolean;
  onToggleNegativeSpacePanel: () => void;
  showRegions: boolean;
  onToggleRegions: () => void;
  fabricCanvas?: FabricCanvas | null;
  gridColor: string;
  gridOpacity: number;
  onGridColorChange: (color: string) => void;
  onGridOpacityChange: (opacity: number) => void;
}

export const PlayModeToolbar: React.FC<PlayModeToolbarProps> = ({
  showNegativeSpacePanel,
  onToggleNegativeSpacePanel,
  showRegions,
  onToggleRegions,
  fabricCanvas,
  gridColor,
  gridOpacity,
  onGridColorChange,
  onGridOpacityChange,
}) => {
  const [layerModalOpen, setLayerModalOpen] = useState(false);
  const [fogModalOpen, setFogModalOpen] = useState(false);
  const [backgroundGridModalOpen, setBackgroundGridModalOpen] = useState(false);
  
  const { enabled: fogEnabled } = useFogStore();
  const { isInCombat, isTrackerVisible, restrictMovement, setTrackerVisible, setRestrictMovement } = useInitiativeStore();

  return (
    <TooltipProvider>
      <div className="absolute top-20 right-4 z-10">
        <div className="bg-card/95 backdrop-blur-sm border border-border rounded-lg shadow-lg p-2 flex flex-col gap-2">
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

          {/* Initiative / Combat */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={isInCombat ? "default" : "ghost"}
                size="icon"
                onClick={() => setTrackerVisible(!isTrackerVisible)}
                className="w-10 h-10"
              >
                <Swords className="w-5 h-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              <p>Initiative {isInCombat ? '(Active)' : ''}</p>
            </TooltipContent>
          </Tooltip>

          {/* Movement Lock */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={restrictMovement ? "default" : "ghost"}
                size="icon"
                onClick={() => setRestrictMovement(!restrictMovement)}
                className="w-10 h-10"
              >
                {restrictMovement ? <Lock className="w-5 h-5" /> : <LockOpen className="w-5 h-5" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              <p>
                {isInCombat 
                  ? (restrictMovement ? 'Active Token Only' : 'All Tokens') 
                  : (restrictMovement ? 'GM Only' : 'Free Movement')
                }
              </p>
            </TooltipContent>
          </Tooltip>

          {/* Background & Grid */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setBackgroundGridModalOpen(true)}
                className="w-10 h-10"
              >
                <Grid3X3 className="w-5 h-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              <p>Background & Grid</p>
            </TooltipContent>
          </Tooltip>

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
      <FogControlModal
        open={fogModalOpen}
        onOpenChange={setFogModalOpen}
      />

      <BackgroundGridModal
        open={backgroundGridModalOpen}
        onOpenChange={setBackgroundGridModalOpen}
        fabricCanvas={fabricCanvas}
        gridColor={gridColor}
        gridOpacity={gridOpacity}
        onGridColorChange={onGridColorChange}
        onGridOpacityChange={onGridOpacityChange}
      />

      <LayerStackModal 
        open={layerModalOpen}
        onOpenChange={setLayerModalOpen}
        fabricCanvas={fabricCanvas}
      />
    </TooltipProvider>
  );
};
