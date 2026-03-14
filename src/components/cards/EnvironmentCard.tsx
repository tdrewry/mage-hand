import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCardStore } from '@/stores/cardStore';
import { MapManagerCardContent } from './MapManagerCard';
import { MapTreeCardContent } from './MapTreeCard';
import { StylesCardContent } from './StylesCard';
import { FogControlCardContent } from './FogControlCard';
import { MapObjectPanelCardContent } from './MapObjectPanelCard';
import { VisionProfileManagerCardContent } from './VisionProfileManagerCard';
import { Layers, Map as MapIcon, Paintbrush, CloudFog, Box, Eye } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface EnvironmentCardContentProps {
  cardId: string;
}

export function EnvironmentCardContent({ cardId }: EnvironmentCardContentProps) {
  const card = useCardStore((state) => state.getCard(cardId));
  const isDocked = card?.dockPosition !== 'floating';
  const { metadata } = card || {};

  const [activeTab, setActiveTab] = useState<'manager' | 'tree' | 'objects' | 'styles' | 'fog' | 'vision'>('manager');

  return (
    <div className="flex flex-col h-full w-full">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex-1 flex flex-col min-h-0">
        <TabsList className="grid w-full grid-cols-6 mb-2 h-auto py-1">
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex w-full">
                  <TabsTrigger value="manager" className="w-full p-1 px-2 gap-2">
                    <MapIcon className="w-4 h-4" />
                    {!isDocked && <span className="truncate">Manager</span>}
                  </TabsTrigger>
                </div>
              </TooltipTrigger>
              {isDocked && <TooltipContent side="top" sideOffset={8}>Map Manager</TooltipContent>}
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex w-full">
                  <TabsTrigger value="tree" className="w-full p-1 px-2 gap-2">
                    <Layers className="w-4 h-4" />
                    {!isDocked && <span className="truncate">Elements</span>}
                  </TabsTrigger>
                </div>
              </TooltipTrigger>
              {isDocked && <TooltipContent side="top" sideOffset={8}>Map Elements</TooltipContent>}
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex w-full">
                  <TabsTrigger value="objects" className="w-full p-1 px-2 gap-2">
                    <Box className="w-4 h-4" />
                    {!isDocked && <span className="truncate">Objects</span>}
                  </TabsTrigger>
                </div>
              </TooltipTrigger>
              {isDocked && <TooltipContent side="top" sideOffset={8}>Map Objects</TooltipContent>}
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex w-full">
                  <TabsTrigger value="styles" className="w-full p-1 px-2 gap-2">
                    <Paintbrush className="w-4 h-4" />
                    {!isDocked && <span className="truncate">Styles</span>}
                  </TabsTrigger>
                </div>
              </TooltipTrigger>
              {isDocked && <TooltipContent side="top" sideOffset={8}>Visual Styles</TooltipContent>}
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex w-full">
                  <TabsTrigger value="fog" className="w-full p-1 px-2 gap-2">
                    <CloudFog className="w-4 h-4" />
                    {!isDocked && <span className="truncate">Fog</span>}
                  </TabsTrigger>
                </div>
              </TooltipTrigger>
              {isDocked && <TooltipContent side="top" sideOffset={8}>Fog of War</TooltipContent>}
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex w-full">
                  <TabsTrigger value="vision" className="w-full p-1 px-2 gap-2">
                    <Eye className="w-4 h-4" />
                    {!isDocked && <span className="truncate">Vision</span>}
                  </TabsTrigger>
                </div>
              </TooltipTrigger>
              {isDocked && <TooltipContent side="top" sideOffset={8}>Vision Profiles</TooltipContent>}
            </Tooltip>
          </TooltipProvider>
        </TabsList>
        
        <TabsContent value="manager" className="flex-1 min-h-0 flex flex-col m-0 p-0">
          <MapManagerCardContent />
        </TabsContent>
        <TabsContent value="tree" className="flex-1 min-h-0 flex flex-col m-0 p-0">
          <MapTreeCardContent />
        </TabsContent>
        <TabsContent value="objects" className="flex-1 min-h-0 flex flex-col m-0 p-0">
          <MapObjectPanelCardContent />
        </TabsContent>
        <TabsContent value="styles" className="flex-1 min-h-0 flex flex-col m-0 p-0">
          <StylesCardContent />
        </TabsContent>
        <TabsContent value="fog" className="flex-1 min-h-0 flex flex-col m-0 p-0">
          <FogControlCardContent
            targetMapId={metadata?.targetMapId as string}
            targetLabel={metadata?.targetLabel as string}
            isStructureMode={metadata?.isStructureMode as boolean}
            structureId={metadata?.structureId as string}
          />
        </TabsContent>
        <TabsContent value="vision" className="flex-1 min-h-0 flex flex-col m-0 p-0">
          <VisionProfileManagerCardContent />
        </TabsContent>
      </Tabs>
    </div>
  );
}
