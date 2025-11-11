import { create } from 'zustand';
import { CardState, CardType, CardPosition, CardSize, CardConfig } from '@/types/cardTypes';

interface CardStore {
  cards: CardState[];
  nextZIndex: number;
  
  // Card registration
  registerCard: (config: CardConfig) => string;
  unregisterCard: (id: string) => void;
  
  // Card visibility
  toggleVisibility: (id: string) => void;
  setVisibility: (id: string, isVisible: boolean) => void;
  
  // Card minimize
  toggleMinimize: (id: string) => void;
  setMinimize: (id: string, isMinimized: boolean) => void;
  
  // Card position and size
  updateCardPosition: (id: string, position: CardPosition) => void;
  updateCardSize: (id: string, size: CardSize) => void;
  
  // Z-index management
  bringToFront: (id: string) => void;
  
  // Layout persistence
  saveLayout: () => void;
  loadLayout: () => void;
  resetLayout: () => void;
  removeCardsByType: (types: CardType[]) => void;
  
  // Utilities
  getCard: (id: string) => CardState | undefined;
  getCardByType: (type: CardType) => CardState | undefined;
}

const STORAGE_KEY = 'vtt-card-layout';

const defaultCardConfigs: Record<CardType, Omit<CardConfig, 'type'>> = {
  [CardType.MAP]: {
    title: 'Player View',
    defaultPosition: { x: 320, y: 20 },
    defaultSize: { width: 800, height: 600 },
    minSize: { width: 400, height: 300 },
    isResizable: true,
    isClosable: true,
    defaultVisible: true,
  },
  [CardType.MENU]: {
    title: 'Menu',
    defaultPosition: { x: 20, y: 20 },
    defaultSize: { width: 280, height: 400 },
    minSize: { width: 200, height: 300 },
    isResizable: true,
    isClosable: false,
    defaultVisible: true,
  },
  [CardType.ROSTER]: {
    title: 'Roster',
    defaultPosition: { x: window.innerWidth - 320, y: 80 },
    defaultSize: { width: 300, height: 500 },
    minSize: { width: 250, height: 300 },
    isResizable: true,
    isClosable: true,
  },
  [CardType.TOOLS]: {
    title: 'Tools',
    defaultPosition: { x: window.innerWidth - 70, y: 80 },
    defaultSize: { width: 54, height: 600 },
    minSize: { width: 54, height: 400 },
    maxSize: { width: 200, height: 800 },
    isResizable: true,
    isClosable: true,
    defaultVisible: true,
    hideHeader: true,
    fullCardDraggable: true,
  },
  [CardType.FOG]: {
    title: 'Fog Control',
    defaultPosition: { x: 320, y: 80 },
    defaultSize: { width: 350, height: 400 },
    minSize: { width: 300, height: 350 },
    isResizable: true,
    isClosable: true,
  },
  [CardType.LAYERS]: {
    title: 'Layer Stack',
    defaultPosition: { x: 20, y: 80 },
    defaultSize: { width: 280, height: 450 },
    minSize: { width: 250, height: 400 },
    isResizable: true,
    isClosable: true,
  },
  [CardType.TOKENS]: {
    title: 'Token Panel',
    defaultPosition: { x: 320, y: 80 },
    defaultSize: { width: 400, height: 500 },
    minSize: { width: 300, height: 400 },
    isResizable: true,
    isClosable: true,
  },
  [CardType.MAP_CONTROLS]: {
    title: 'Map Controls',
    defaultPosition: { x: window.innerWidth / 2 - 200, y: 80 },
    defaultSize: { width: 400, height: 450 },
    minSize: { width: 350, height: 400 },
    isResizable: true,
    isClosable: true,
  },
  [CardType.MAP_MANAGER]: {
    title: 'Map Manager',
    defaultPosition: { x: window.innerWidth / 2 - 300, y: 80 },
    defaultSize: { width: 600, height: 600 },
    minSize: { width: 500, height: 500 },
    isResizable: true,
    isClosable: true,
  },
  [CardType.GROUP_MANAGER]: {
    title: 'Group Manager',
    defaultPosition: { x: 320, y: 80 },
    defaultSize: { width: 400, height: 500 },
    minSize: { width: 350, height: 400 },
    isResizable: true,
    isClosable: true,
  },
  [CardType.PROJECT_MANAGER]: {
    title: 'Project Manager',
    defaultPosition: { x: window.innerWidth / 2 - 250, y: 80 },
    defaultSize: { width: 500, height: 600 },
    minSize: { width: 400, height: 500 },
    isResizable: true,
    isClosable: true,
  },
  [CardType.REGION_CONTROL]: {
    title: 'Region Control',
    defaultPosition: { x: 320, y: 80 },
    defaultSize: { width: 350, height: 400 },
    minSize: { width: 300, height: 350 },
    isResizable: true,
    isClosable: true,
  },
  [CardType.WATABOU_IMPORT]: {
    title: 'Watabou Import',
    defaultPosition: { x: window.innerWidth / 2 - 250, y: 80 },
    defaultSize: { width: 500, height: 550 },
    minSize: { width: 400, height: 500 },
    isResizable: true,
    isClosable: true,
  },
  [CardType.BACKGROUND_GRID]: {
    title: 'Background Grid',
    defaultPosition: { x: 320, y: 80 },
    defaultSize: { width: 400, height: 450 },
    minSize: { width: 350, height: 400 },
    isResizable: true,
    isClosable: true,
  },
  [CardType.INITIATIVE_TRACKER]: {
    title: 'Initiative Tracker',
    defaultPosition: { x: window.innerWidth / 2 - 400, y: 80 },
    defaultSize: { width: 800, height: 140 },
    minSize: { width: 400, height: 120 },
    isResizable: true,
    isClosable: true,
    defaultVisible: false, // Only show when combat starts
    hideHeader: true,
    fullCardDraggable: true,
  },
  [CardType.STYLES]: {
    title: 'Styles',
    defaultPosition: { x: 320, y: 80 },
    defaultSize: { width: 400, height: 600 },
    minSize: { width: 350, height: 500 },
    isResizable: true,
    isClosable: true,
    defaultVisible: false,
  },
  [CardType.VISION_PROFILE_MANAGER]: {
    title: 'Vision Profile Manager',
    defaultPosition: { x: 320, y: 80 },
    defaultSize: { width: 450, height: 650 },
    minSize: { width: 400, height: 550 },
    isResizable: true,
    isClosable: true,
    defaultVisible: false,
  },
  [CardType.ROLE_MANAGER]: {
    title: 'Role Manager',
    defaultPosition: { x: 320, y: 80 },
    defaultSize: { width: 600, height: 700 },
    minSize: { width: 500, height: 600 },
    isResizable: true,
    isClosable: true,
    defaultVisible: false,
  },
};

export const useCardStore = create<CardStore>((set, get) => ({
  cards: [],
  nextZIndex: 1000,

  registerCard: (config: CardConfig) => {
    const id = `${config.type}-${Date.now()}`;
    const defaultConfig = defaultCardConfigs[config.type];
    
    set((state) => ({
      cards: [
        ...state.cards,
        {
          id,
          type: config.type,
          position: config.defaultPosition || defaultConfig.defaultPosition,
          size: config.defaultSize || defaultConfig.defaultSize,
          isMinimized: config.defaultMinimized || false,
          isVisible: config.defaultVisible ?? false,
          zIndex: state.nextZIndex,
          hideHeader: config.hideHeader ?? defaultConfig.hideHeader,
          fullCardDraggable: config.fullCardDraggable ?? defaultConfig.fullCardDraggable,
        },
      ],
      nextZIndex: state.nextZIndex + 1,
    }));
    
    return id;
  },

  unregisterCard: (id: string) => {
    set((state) => ({
      cards: state.cards.filter((card) => card.id !== id),
    }));
  },

  toggleVisibility: (id: string) => {
    set((state) => ({
      cards: state.cards.map((card) =>
        card.id === id ? { ...card, isVisible: !card.isVisible } : card
      ),
    }));
  },

  setVisibility: (id: string, isVisible: boolean) => {
    set((state) => ({
      cards: state.cards.map((card) =>
        card.id === id ? { ...card, isVisible } : card
      ),
    }));
  },

  toggleMinimize: (id: string) => {
    set((state) => ({
      cards: state.cards.map((card) =>
        card.id === id ? { ...card, isMinimized: !card.isMinimized } : card
      ),
    }));
  },

  setMinimize: (id: string, isMinimized: boolean) => {
    set((state) => ({
      cards: state.cards.map((card) =>
        card.id === id ? { ...card, isMinimized } : card
      ),
    }));
  },

  updateCardPosition: (id: string, position: CardPosition) => {
    set((state) => ({
      cards: state.cards.map((card) =>
        card.id === id ? { ...card, position } : card
      ),
    }));
  },

  updateCardSize: (id: string, size: CardSize) => {
    set((state) => ({
      cards: state.cards.map((card) =>
        card.id === id ? { ...card, size } : card
      ),
    }));
  },

  bringToFront: (id: string) => {
    set((state) => {
      const card = state.cards.find((c) => c.id === id);
      if (!card) return state;

      const maxZ = Math.max(...state.cards.map((c) => c.zIndex), state.nextZIndex - 1);
      
      return {
        cards: state.cards.map((c) =>
          c.id === id ? { ...c, zIndex: maxZ + 1 } : c
        ),
        nextZIndex: maxZ + 2,
      };
    });
  },

  saveLayout: () => {
    const { cards } = get();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
  },

  loadLayout: () => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const cards = JSON.parse(stored);
        // Filter out deprecated card types (replaced by new toolbar components)
        const deprecatedTypes = [CardType.TOOLS, CardType.INITIATIVE_TRACKER];
        // Filter out any duplicate cards by type (keep only the first of each type)
        const uniqueCards = cards.reduce((acc: CardState[], card: CardState) => {
          const isDeprecated = deprecatedTypes.includes(card.type);
          const exists = acc.some(c => c.type === card.type);
          if (!isDeprecated && !exists) {
            acc.push(card);
          }
          return acc;
        }, []);
        set({ cards: uniqueCards });
      } catch (e) {
        console.error('Failed to load card layout:', e);
      }
    }
  },

  resetLayout: () => {
    localStorage.removeItem(STORAGE_KEY);
    set({ cards: [], nextZIndex: 1000 });
  },

  removeCardsByType: (types: CardType[]) => {
    set((state) => {
      const filteredCards = state.cards.filter(card => !types.includes(card.type));
      
      // Also update localStorage
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        try {
          const storedCards = JSON.parse(stored);
          const cleanedCards = storedCards.filter((card: CardState) => !types.includes(card.type));
          localStorage.setItem(STORAGE_KEY, JSON.stringify(cleanedCards));
        } catch (e) {
          console.error('Failed to clean card storage:', e);
        }
      }
      
      return { cards: filteredCards };
    });
  },

  getCard: (id: string) => {
    return get().cards.find((card) => card.id === id);
  },

  getCardByType: (type: CardType) => {
    return get().cards.find((card) => card.type === type);
  },
}));
