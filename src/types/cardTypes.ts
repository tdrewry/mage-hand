export enum CardType {
  MENU = 'menu',
  ROSTER = 'roster',
  TOOLS = 'tools',
  FOG = 'fog',
  LAYERS = 'layers',
  TOKENS = 'tokens',
  MAP_CONTROLS = 'map_controls',
  MAP_MANAGER = 'map_manager',
  GROUP_MANAGER = 'group_manager',
  PROJECT_MANAGER = 'project_manager',
  REGION_CONTROL = 'region_control',
  WATABOU_IMPORT = 'watabou_import',
  BACKGROUND_GRID = 'background_grid',
  INITIATIVE_TRACKER = 'initiative_tracker',
  STYLES = 'styles',
  VISION_PROFILE_MANAGER = 'vision_profile_manager',
  ROLE_MANAGER = 'role_manager',
  HISTORY = 'history',
  MAP_OBJECTS = 'map_objects',
}

export interface ToolsCardProps {
  mode: 'edit' | 'play';
  fabricCanvas?: any;
  onOpenMapManager?: () => void;
  onAddRegion?: () => void;
  onStartPolygonDraw?: () => void;
  onStartFreehandDraw?: () => void;
  onFinishPolygonDraw?: () => void;
  isDrawingPolygon?: boolean;
  isDrawingFreehand?: boolean;
  isGridSnappingEnabled?: boolean;
  onToggleGridSnapping?: () => void;
  showNegativeSpacePanel: boolean;
  onToggleNegativeSpacePanel: () => void;
  showRegions: boolean;
  onToggleRegions: () => void;
}

export interface CardPosition {
  x: number;
  y: number;
}

export interface CardSize {
  width: number;
  height: number;
}

export interface CardConfig {
  type: CardType;
  title: string;
  defaultPosition: CardPosition;
  defaultSize: CardSize;
  minSize?: CardSize;
  maxSize?: CardSize;
  isResizable?: boolean;
  isClosable?: boolean;
  defaultMinimized?: boolean;
  defaultVisible?: boolean;
  hideHeader?: boolean;
  fullCardDraggable?: boolean;
}

export interface CardState {
  id: string;
  type: CardType;
  position: CardPosition;
  size: CardSize;
  isMinimized: boolean;
  isVisible: boolean;
  zIndex: number;
  hideHeader?: boolean;
  fullCardDraggable?: boolean;
}
