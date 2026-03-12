import { create } from 'zustand';
import { CardState, CardType, CardPosition, CardSize, CardConfig } from '@/types/cardTypes';
import { Z_INDEX } from '@/lib/zIndex';

interface CardStore {
  cards: CardState[];
  nextZIndex: number;
  
  /**
   * Registers a new UI card with the specified configuration.
   * @param config The configuration for the new card.
   * @returns The unique ID of the registered card.
   */
  registerCard: (config: CardConfig) => string;

  /**
   * Unregisters a card by its ID.
   * @param id The ID of the card to unregister.
   */
  unregisterCard: (id: string) => void;
  
  /**
   * Toggles the visibility of a card.
   * @param id The ID of the card.
   */
  toggleVisibility: (id: string) => void;

  /**
   * Sets the visibility of a card.
   * @param id The ID of the card.
   * @param isVisible True to show, false to hide.
   */
  setVisibility: (id: string, isVisible: boolean) => void;
  
  /**
   * Toggles the minimized state of a card.
   * @param id The ID of the card.
   */
  toggleMinimize: (id: string) => void;

  /**
   * Sets the minimized state of a card.
   * @param id The ID of the card.
   * @param isMinimized True to minimize, false to restore.
   */
  setMinimize: (id: string, isMinimized: boolean) => void;
  
  /**
   * Updates the position of a card.
   * @param id The ID of the card.
   * @param position The new position.
   */
  updateCardPosition: (id: string, position: CardPosition) => void;

  /**
   * Updates the size of a card.
   * @param id The ID of the card.
   * @param size The new size.
   */
  updateCardSize: (id: string, size: CardSize) => void;
  
  /**
   * Brings a card to the front by increasing its Z-index.
   * @param id The ID of the card.
   */
  bringToFront: (id: string) => void;
  
  /**
   * Saves the current card layout to local storage.
   */
  saveLayout: () => void;

  /**
   * Loads the card layout from local storage.
   */
  loadLayout: () => void;

  /**
   * Resets the card layout to default values.
   */
  resetLayout: () => void;

  /**
   * Removes all cards of the specified types.
   * @param types The types of cards to remove.
   */
  removeCardsByType: (types: CardType[]) => void;

  /**
   * Clamps all visible card positions so they remain within the current viewport.
   */
  clampCardsToViewport: () => void;
  
  /**
   * Retrieves a card state by its ID.
   * @param id The ID of the card.
   * @returns The card state, or undefined if not found.
   */
  getCard: (id: string) => CardState | undefined;

  /**
   * Retrieves the first card state of the specified type.
   * @param type The type of the card.
   * @returns The card state, or undefined if not found.
   */
  getCardByType: (type: CardType) => CardState | undefined;
}

const STORAGE_KEY = 'vtt-card-layout';

const defaultCardConfigs: Record<CardType, Omit<CardConfig, 'type'>> = {
  [CardType.MENU]: {
    title: 'Menu',
    defaultPosition: { x: 70, y: 20 }, // Offset to clear the left vertical toolbar
    defaultSize: { width: 340, height: 520 },
    minSize: { width: 280, height: 300 },
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
    title: 'Import',
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
    title: 'Map',
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
  [CardType.HISTORY]: {
    title: 'History',
    defaultPosition: { x: window.innerWidth - 380, y: 80 },
    defaultSize: { width: 360, height: 500 },
    minSize: { width: 320, height: 400 },
    isResizable: true,
    isClosable: true,
    defaultVisible: false,
  },
  [CardType.MAP_OBJECTS]: {
    title: 'Map Objects',
    defaultPosition: { x: 320, y: 80 },
    defaultSize: { width: 350, height: 550 },
    minSize: { width: 300, height: 400 },
    isResizable: true,
    isClosable: true,
    defaultVisible: false,
  },
  [CardType.CHARACTER_SHEET]: {
    title: 'Character Sheet',
    defaultPosition: { x: 320, y: 80 },
    defaultSize: { width: 400, height: 600 },
    minSize: { width: 350, height: 500 },
    isResizable: true,
    isClosable: true,
    defaultVisible: false,
  },
  [CardType.MONSTER_STAT_BLOCK]: {
    title: 'Monster Stat Block',
    defaultPosition: { x: 360, y: 80 },
    defaultSize: { width: 420, height: 650 },
    minSize: { width: 380, height: 500 },
    isResizable: true,
    isClosable: true,
    defaultVisible: false,
  },
  [CardType.CREATURE_LIBRARY]: {
    title: 'Library',
    defaultPosition: { x: window.innerWidth / 2 - 300, y: 80 },
    defaultSize: { width: 600, height: 700 },
    minSize: { width: 500, height: 550 },
    isResizable: true,
    isClosable: true,
    defaultVisible: false,
  },
  [CardType.MAP_TREE]: {
    title: 'Map Tree',
    defaultPosition: { x: 320, y: 80 },
    defaultSize: { width: 460, height: 500 },
    minSize: { width: 260, height: 300 },
    isResizable: true,
    isClosable: true,
    defaultVisible: false,
  },
  [CardType.DICE_BOX]: {
    title: 'Dice Box',
    defaultPosition: { x: 320, y: 80 },
    defaultSize: { width: 350, height: 500 },
    minSize: { width: 280, height: 350 },
    isResizable: true,
    isClosable: true,
    defaultVisible: false,
  },
  [CardType.ACTION_CARD]: {
    title: 'Action',
    defaultPosition: { x: 360, y: 80 },
    defaultSize: { width: 380, height: 550 },
    minSize: { width: 320, height: 400 },
    isResizable: true,
    isClosable: true,
    defaultVisible: false,
  },
  [CardType.NETWORK_DEMO]: {
    title: 'Network Demo',
    defaultPosition: { x: 320, y: 80 },
    defaultSize: { width: 380, height: 550 },
    minSize: { width: 320, height: 400 },
    isResizable: true,
    isClosable: true,
    defaultVisible: false,
  },
  [CardType.EFFECTS]: {
    title: 'Effects',
    defaultPosition: { x: 320, y: 80 },
    defaultSize: { width: 320, height: 500 },
    minSize: { width: 280, height: 350 },
    isResizable: true,
    isClosable: true,
    defaultVisible: false,
  },
  [CardType.CHAT]: {
    title: 'Chat',
    defaultPosition: { x: 320, y: 80 },
    defaultSize: { width: 360, height: 500 },
    minSize: { width: 300, height: 350 },
    isResizable: true,
    isClosable: true,
    defaultVisible: false,
  },
  [CardType.ART_APPROVAL]: {
    title: 'Art Approval',
    defaultPosition: { x: 360, y: 120 },
    defaultSize: { width: 340, height: 420 },
    minSize: { width: 280, height: 300 },
    isResizable: true,
    isClosable: true,
    defaultVisible: false,
  },
  [CardType.SOUND_SETTINGS]: {
    title: 'Sound Settings',
    defaultPosition: { x: 360, y: 80 },
    defaultSize: { width: 380, height: 600 },
    minSize: { width: 320, height: 400 },
    isResizable: true,
    isClosable: true,
    defaultVisible: false,
  },
  [CardType.HANDOUT_CATALOG]: {
    title: 'Handouts',
    defaultPosition: { x: 320, y: 80 },
    defaultSize: { width: 340, height: 400 },
    minSize: { width: 280, height: 300 },
    isResizable: true,
    isClosable: true,
    defaultVisible: false,
  },
  [CardType.HANDOUT_VIEWER]: {
    title: 'Handout',
    defaultPosition: { x: 380, y: 60 },
    defaultSize: { width: 500, height: 650 },
    minSize: { width: 360, height: 400 },
    isResizable: true,
    isClosable: true,
    defaultVisible: false,
  },
  [CardType.CAMPAIGN_EDITOR]: {
    title: 'Campaign Editor',
    defaultPosition: { x: window.innerWidth / 2 - 400, y: 80 },
    defaultSize: { width: 800, height: 600 },
    minSize: { width: 600, height: 450 },
    isResizable: true,
    isClosable: true,
    defaultVisible: false,
  },
  [CardType.TOKEN_GROUP_MANAGER]: {
    title: 'Token Groups',
    defaultPosition: { x: window.innerWidth / 2 - 200, y: 100 },
    defaultSize: { width: 380, height: 500 },
    minSize: { width: 320, height: 350 },
    isResizable: true,
    isClosable: true,
    defaultVisible: false,
  },
};

export const useCardStore = create<CardStore>((set, get) => ({
  cards: [],
  nextZIndex: Z_INDEX.CARDS.BASE,

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
          isMinimized: config.defaultMinimized ?? defaultConfig.defaultMinimized ?? false,
          isVisible: config.defaultVisible ?? defaultConfig.defaultVisible ?? false,
          zIndex: state.nextZIndex,
          hideHeader: config.hideHeader ?? defaultConfig.hideHeader,
          fullCardDraggable: config.fullCardDraggable ?? defaultConfig.fullCardDraggable,
          metadata: config.metadata,
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

      const maxZ = Math.max(
        ...state.cards.map((c) => c.zIndex),
        Z_INDEX.CARDS.BASE - 1
      );
      
      // Clamp to cards max (32999)
      const newZ = Math.min(maxZ + 1, Z_INDEX.CARDS.MAX);
      
      return {
        cards: state.cards.map((c) =>
          c.id === id ? { ...c, zIndex: newZ } : c
        ),
        nextZIndex: Math.min(newZ + 1, Z_INDEX.CARDS.MAX),
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
        // Filter out deprecated card types (replaced by new toolbar components or removed)
        const deprecatedTypes = [CardType.TOOLS, CardType.INITIATIVE_TRACKER, CardType.LAYERS, CardType.BACKGROUND_GRID];
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
    set({ cards: [], nextZIndex: Z_INDEX.CARDS.BASE });
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

  clampCardsToViewport: () => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const MARGIN = 40; // minimum pixels that must stay on-screen

    set((state) => ({
      cards: state.cards.map((card) => {
        const maxX = vw - MARGIN;
        const maxY = vh - MARGIN;
        const clampedX = Math.min(Math.max(card.position.x, 0), maxX);
        const clampedY = Math.min(Math.max(card.position.y, 0), maxY);
        if (clampedX === card.position.x && clampedY === card.position.y) return card;
        return { ...card, position: { x: clampedX, y: clampedY } };
      }),
    }));
  },
}));
