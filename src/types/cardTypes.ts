export enum CardType {
  MENU = 'menu',
  ROSTER = 'roster',
  TOOLS = 'tools',
  FOG = 'fog',
  /** @deprecated Replaced by MAP_TREE */
  LAYERS = 'layers',
  TOKENS = 'tokens',
  MAP_CONTROLS = 'map_controls',
  MAP_MANAGER = 'map_manager',
  GROUP_MANAGER = 'group_manager',
  PROJECT_MANAGER = 'project_manager',
  REGION_CONTROL = 'region_control',
  WATABOU_IMPORT = 'watabou_import',
  /** @deprecated Removed in multi-map architecture */
  BACKGROUND_GRID = 'background_grid',
  INITIATIVE_TRACKER = 'initiative_tracker',
  STYLES = 'styles',
  VISION_PROFILE_MANAGER = 'vision_profile_manager',
  ROLE_MANAGER = 'role_manager',
  HISTORY = 'history',
  MAP_OBJECTS = 'map_objects',
  CHARACTER_SHEET = 'character_sheet',
  MONSTER_STAT_BLOCK = 'monster_stat_block',
  CREATURE_LIBRARY = 'creature_library',
  MAP_TREE = 'map_tree',
  DICE_BOX = 'dice_box',
  ACTION_CARD = 'action_card',
  NETWORK_DEMO = 'network_demo',
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
  metadata?: Record<string, unknown>;
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
  metadata?: Record<string, unknown>;
}
