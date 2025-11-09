export enum CardType {
  MAP = 'map',
  MENU = 'menu',
  ROSTER = 'roster',
  TOOLS = 'tools',
  FOG = 'fog',
  LAYERS = 'layers',
  TOKENS = 'tokens',
  MAP_CONTROLS = 'map_controls',
  GROUP_MANAGER = 'group_manager',
  PROJECT_MANAGER = 'project_manager',
  REGION_CONTROL = 'region_control',
  WATABOU_IMPORT = 'watabou_import',
  BACKGROUND_GRID = 'background_grid',
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
}

export interface CardState {
  id: string;
  type: CardType;
  position: CardPosition;
  size: CardSize;
  isMinimized: boolean;
  isVisible: boolean;
  zIndex: number;
}
