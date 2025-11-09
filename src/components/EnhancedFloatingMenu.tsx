/**
 * Enhanced Floating Menu
 * 
 * Extended version of FloatingMenu that includes access to the new
 * enhanced canvas system features like project management and group operations
 */

import React, { useState } from 'react';
import { Button } from './ui/button';
import { 
  FolderOpen, 
  Users, 
  Settings, 
  Grid3X3, 
  Eye, 
  MapPin,
  Save,
  Upload
} from 'lucide-react';

import { FloatingMenu } from './FloatingMenu';
import { ProjectManagerModal } from './modals/ProjectManagerModal';
import { GroupManagerModal } from './GroupManagerModal';

interface EnhancedFloatingMenuProps {
  fabricCanvas: any;
  gridType: 'square' | 'hex' | 'none';
  gridSize: number;
  gridVisible: boolean;
  gridColor: string;
  gridOpacity: number;
  onAddToken: () => void;
  onGridTypeChange: (type: 'square' | 'hex' | 'none') => void;
  onGridSizeChange: (size: number) => void;
  onGridVisibilityChange: (visible: boolean) => void;
  onGridColorChange: (color: string) => void;
  onGridOpacityChange: (opacity: number) => void;
  onBackgroundColorChange: (color: string) => void;
  viewport: { x: number; y: number; zoom: number };
}

export const EnhancedFloatingMenu: React.FC<EnhancedFloatingMenuProps> = ({
  viewport,
  ...floatingMenuProps
}) => {
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [groupModalOpen, setGroupModalOpen] = useState(false);

  return (
    <>
      {/* Original floating menu */}
      <FloatingMenu {...floatingMenuProps} />
      
      {/* Enhanced features menu */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setProjectModalOpen(true)}
          className="bg-background/80 backdrop-blur-sm hover:bg-background/90"
          title="Project Manager"
        >
          <FolderOpen className="w-4 h-4" />
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => setGroupModalOpen(true)}
          className="bg-background/80 backdrop-blur-sm hover:bg-background/90"
          title="Group Manager"
        >
          <Users className="w-4 h-4" />
        </Button>
      </div>

      {/* Enhanced modals */}
      <ProjectManagerModal
        open={projectModalOpen}
        onOpenChange={setProjectModalOpen}
        viewport={viewport}
      />

      <GroupManagerModal
        open={groupModalOpen}
        onOpenChange={setGroupModalOpen}
      />
    </>
  );
};