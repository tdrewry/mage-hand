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

  // If floating, split into 2 panes: Left (Structure) & Right (Visuals)
  if (!isDocked) {
    return (
      <div className="flex h-full w-full gap-4">
        {/* Left Column: Map Structure */}
        <div className="w-1/2 flex flex-col min-h-0 border-r border-border pr-4 shrink-0">
          <Tabs value={['manager', 'tree', 'objects'].includes(activeTab) ? activeTab : 'manager'} onValueChange={(v) => setActiveTab(v as any)} className="flex-1 flex flex-col min-h-0">
            <TabsList className="grid w-full grid-cols-3 mb-4 bg-muted/50">
              <TabsTrigger value="manager" className="gap-2"><MapIcon className="w-4 h-4" /> Manager</TabsTrigger>
              <TabsTrigger value="tree" className="gap-2"><Layers className="w-4 h-4" /> Elements</TabsTrigger>
              <TabsTrigger value="objects" className="gap-2"><Box className="w-4 h-4" /> Objects</TabsTrigger>
            </TabsList>
            <TabsContent value="manager" className="flex-1 min-h-0 overflow-y-auto m-0 p-0">
              <MapManagerCardContent />
            </TabsContent>
            <TabsContent value="tree" className="flex-1 min-h-0 flex flex-col overflow-hidden m-0 p-0">
              <MapTreeCardContent />
            </TabsContent>
            <TabsContent value="objects" className="flex-1 min-h-0 flex flex-col overflow-y-auto m-0 p-0">
              <MapObjectPanelCardContent />
            </TabsContent>
          </Tabs>
        </div>

        {/* Right Column: Visualization */}
        <div className="flex-1 flex flex-col min-h-0">
          <Tabs value={['styles', 'fog', 'vision'].includes(activeTab) ? activeTab : 'styles'} onValueChange={(v) => setActiveTab(v as any)} className="flex-1 flex flex-col min-h-0">
            <TabsList className="grid w-full grid-cols-3 mb-4 bg-muted/50">
              <TabsTrigger value="styles" className="gap-2"><Paintbrush className="w-4 h-4" /> Styles</TabsTrigger>
              <TabsTrigger value="fog" className="gap-2"><CloudFog className="w-4 h-4" /> Fog</TabsTrigger>
              <TabsTrigger value="vision" className="gap-2"><Eye className="w-4 h-4" /> Vision</TabsTrigger>
            </TabsList>
            <TabsContent value="styles" className="flex-1 min-h-0 overflow-y-auto m-0 p-0">
              <StylesCardContent />
            </TabsContent>
            <TabsContent value="fog" className="flex-1 min-h-0 overflow-y-auto m-0 p-0">
              <FogControlCardContent
                targetMapId={metadata?.targetMapId as string}
                targetLabel={metadata?.targetLabel as string}
                isStructureMode={metadata?.isStructureMode as boolean}
                structureId={metadata?.structureId as string}
              />
            </TabsContent>
            <TabsContent value="vision" className="flex-1 min-h-0 overflow-y-auto m-0 p-0">
              <VisionProfileManagerCardContent />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    );
  }

  // If Docked, single column stack of tabs
  return (
    <div className="flex flex-col h-full w-full">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex-1 flex flex-col min-h-0">
        <TabsList className="grid w-full grid-cols-6 mb-2 h-auto py-1">
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex w-full">
                  <TabsTrigger value="manager" className="w-full p-1 px-2"><MapIcon className="w-4 h-4" /></TabsTrigger>
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={8}>Map Manager</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex w-full">
                  <TabsTrigger value="tree" className="w-full p-1 px-2"><Layers className="w-4 h-4" /></TabsTrigger>
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={8}>Map Elements</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex w-full">
                  <TabsTrigger value="objects" className="w-full p-1 px-2"><Box className="w-4 h-4" /></TabsTrigger>
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={8}>Map Objects</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex w-full">
                  <TabsTrigger value="styles" className="w-full p-1 px-2"><Paintbrush className="w-4 h-4" /></TabsTrigger>
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={8}>Visual Styles</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex w-full">
                  <TabsTrigger value="fog" className="w-full p-1 px-2"><CloudFog className="w-4 h-4" /></TabsTrigger>
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={8}>Fog of War</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex w-full">
                  <TabsTrigger value="vision" className="w-full p-1 px-2"><Eye className="w-4 h-4" /></TabsTrigger>
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={8}>Vision Profiles</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </TabsList>
        
        <TabsContent value="manager" className="flex-1 min-h-0 overflow-y-auto m-0 p-0">
          <MapManagerCardContent />
        </TabsContent>
        <TabsContent value="tree" className="flex-1 min-h-0 flex flex-col m-0 p-0">
          <MapTreeCardContent />
        </TabsContent>
        <TabsContent value="objects" className="flex-1 min-h-0 flex flex-col m-0 p-0">
          <MapObjectPanelCardContent />
        </TabsContent>
        <TabsContent value="styles" className="flex-1 min-h-0 overflow-y-auto m-0 p-0">
          <StylesCardContent />
        </TabsContent>
        <TabsContent value="fog" className="flex-1 min-h-0 overflow-y-auto m-0 p-0">
          <FogControlCardContent
            targetMapId={metadata?.targetMapId as string}
            targetLabel={metadata?.targetLabel as string}
            isStructureMode={metadata?.isStructureMode as boolean}
            structureId={metadata?.structureId as string}
          />
        </TabsContent>
        <TabsContent value="vision" className="flex-1 min-h-0 overflow-y-auto m-0 p-0">
          <VisionProfileManagerCardContent />
        </TabsContent>
      </Tabs>
    </div>
  );
}
