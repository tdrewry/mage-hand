import { useState, useMemo, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { 
  Search, 
  Plus, 
  Upload, 
  Users, 
  Skull, 
  RefreshCw, 
  Trash2,
  ExternalLink,
  UserPlus,
  FileJson,
  Eye,
  Download,
  Globe,
  Target,
  Gem,
  Package,
  Pencil,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { useCreatureStore } from '@/stores/creatureStore';
import { generateBlankTemplate } from '@/lib/characterTemplateGenerator';
import { useItemStore } from '@/stores/itemStore';
import { useSessionStore, type LabelPosition } from '@/stores/sessionStore';
import { useMapStore } from '@/stores/mapStore';
import { useCardStore } from '@/stores/cardStore';
import { CardType } from '@/types/cardTypes';
import { 
  MONSTER_SIZE_NAMES, 
  MONSTER_SIZE_GRID, 
  formatModifier, 
  getAbilityModifier,
  getCRXP,
  type Monster5eTools,
  type DndBeyondCharacter,
  type MonsterSize
} from '@/types/creatureTypes';
import type { LibraryItem, ItemCategory, ItemRarity } from '@/types/itemTypes';
import { ITEM_RARITY_LABELS, ITEM_CATEGORY_LABELS } from '@/types/itemTypes';
import type { IlluminationSource } from '@/types/illumination';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { ImportCharacterModal } from '@/components/modals/ImportCharacterModal';

interface CreatureLibraryCardContentProps {
  cardId: string;
  onSelectEntity?: (id: string, type: 'character' | 'monster' | 'item') => void;
  forcedTab?: 'characters' | 'monsters' | 'items';
}

// Monster type list for filtering
const MONSTER_TYPES = [
  'aberration', 'beast', 'celestial', 'construct', 'dragon', 
  'elemental', 'fey', 'fiend', 'giant', 'humanoid', 
  'monstrosity', 'ooze', 'plant', 'undead'
];

const SIZE_OPTIONS: MonsterSize[] = ['T', 'S', 'M', 'L', 'H', 'G'];

// Color palette for tokens without images
const TOKEN_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
  '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
  '#F8C471', '#82E0AA', '#F1948A', '#F39C12', '#E74C3C'
];

const getRandomTokenColor = () => TOKEN_COLORS[Math.floor(Math.random() * TOKEN_COLORS.length)];

const CR_OPTIONS = [
  { label: '0', value: 0 },
  { label: '1/8', value: 0.125 },
  { label: '1/4', value: 0.25 },
  { label: '1/2', value: 0.5 },
  { label: '1', value: 1 },
  { label: '2', value: 2 },
  { label: '3', value: 3 },
  { label: '4', value: 4 },
  { label: '5', value: 5 },
  { label: '6', value: 6 },
  { label: '7', value: 7 },
  { label: '8', value: 8 },
  { label: '9', value: 9 },
  { label: '10', value: 10 },
  { label: '15', value: 15 },
  { label: '20', value: 20 },
  { label: '25', value: 25 },
  { label: '30', value: 30 },
];

// 5e.tools bestiary source files
const BESTIARY_SOURCES = [
  { id: 'mm', name: 'Monster Manual', file: 'bestiary-mm.json' },
  { id: 'vgm', name: "Volo's Guide to Monsters", file: 'bestiary-vgm.json' },
  { id: 'mtf', name: "Mordenkainen's Tome of Foes", file: 'bestiary-mtf.json' },
  { id: 'mpmm', name: "Mordenkainen Presents: Monsters of the Multiverse", file: 'bestiary-mpmm.json' },
  { id: 'tce', name: "Tasha's Cauldron of Everything", file: 'bestiary-tce.json' },
  { id: 'xge', name: "Xanathar's Guide to Everything", file: 'bestiary-xge.json' },
  { id: 'ftd', name: "Fizban's Treasury of Dragons", file: 'bestiary-ftd.json' },
  { id: 'cos', name: 'Curse of Strahd', file: 'bestiary-cos.json' },
  { id: 'hotdq', name: 'Hoard of the Dragon Queen', file: 'bestiary-hotdq.json' },
  { id: 'lmop', name: 'Lost Mine of Phandelver', file: 'bestiary-lmop.json' },
  { id: 'oota', name: 'Out of the Abyss', file: 'bestiary-oota.json' },
  { id: 'pota', name: 'Princes of the Apocalypse', file: 'bestiary-pota.json' },
  { id: 'rot', name: 'Rise of Tiamat', file: 'bestiary-rot.json' },
  { id: 'skt', name: 'Storm King\'s Thunder', file: 'bestiary-skt.json' },
  { id: 'toa', name: 'Tomb of Annihilation', file: 'bestiary-toa.json' },
  { id: 'wdh', name: 'Waterdeep: Dragon Heist', file: 'bestiary-wdh.json' },
  { id: 'wdmm', name: 'Waterdeep: Dungeon of the Mad Mage', file: 'bestiary-wdmm.json' },
  { id: 'bgdia', name: "Baldur's Gate: Descent into Avernus", file: 'bestiary-bgdia.json' },
  { id: 'idrotf', name: 'Icewind Dale: Rime of the Frostmaiden', file: 'bestiary-idrotf.json' },
  { id: 'cm', name: 'Candlekeep Mysteries', file: 'bestiary-cm.json' },
  { id: 'wbtw', name: 'The Wild Beyond the Witchlight', file: 'bestiary-wbtw.json' },
  { id: 'coa', name: 'Chains of Asmodeus', file: 'bestiary-coa.json' },
  { id: 'phb', name: "Player's Handbook", file: 'bestiary-phb.json' },
  { id: 'dmg', name: "Dungeon Master's Guide", file: 'bestiary-dmg.json' },
];

export function CreatureLibraryCardContent({ cardId, onSelectEntity, forcedTab }: CreatureLibraryCardContentProps) {
  const { 
    characters, 
    monsters, 
    searchCharacters, 
    searchMonsters,
    addCharacter,
    addMonster,
    removeCharacter,
    removeMonster,
    addMonsters,
    bestiaryLoading,
    setBestiaryLoading,
  } = useCreatureStore();

  const {
    items,
    addItem,
    addItems,
    removeItem,
    searchItems,
  } = useItemStore();

  const { addToken, getViewportTransform } = useSessionStore();
  const { selectedMapId } = useMapStore();
  const { registerCard } = useCardStore();
  
  // Helper to calculate the center of the current viewport in world coordinates
  const getViewportCenter = () => {
    const transform = selectedMapId ? getViewportTransform(selectedMapId) : { x: 0, y: 0, zoom: 1 };
    // Assume a standard canvas size - the center in screen coords is approximately (width/2, height/2)
    // We need to convert screen center to world coordinates
    const screenCenterX = window.innerWidth / 2;
    const screenCenterY = window.innerHeight / 2;
    
    // World coordinates: worldX = (screenX - panX) / zoom
    const worldX = (screenCenterX - transform.x) / transform.zoom;
    const worldY = (screenCenterY - transform.y) / transform.zoom;
    
    return { x: worldX, y: worldY };
  };

  const [internalActiveTab, setInternalActiveTab] = useState<'characters' | 'monsters' | 'items'>('monsters');
  const activeTab = forcedTab || internalActiveTab;
  const setActiveTab = forcedTab ? () => {} : setInternalActiveTab;
  const [searchQuery, setSearchQuery] = useState('');
  const [sizeFilter, setSizeFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [crMinFilter, setCrMinFilter] = useState<string>('any');
  const [crMaxFilter, setCrMaxFilter] = useState<string>('any');
  const [itemCategoryFilter, setItemCategoryFilter] = useState<string>('all');
  const [itemRarityFilter, setItemRarityFilter] = useState<string>('all');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  const [pageSize, setPageSize] = useState(10);
  const [characterPage, setCharacterPage] = useState(1);
  const [monsterPage, setMonsterPage] = useState(1);
  const [itemPage, setItemPage] = useState(1);

  // Reset pages when filters change
  useEffect(() => {
    setCharacterPage(1);
    setMonsterPage(1);
    setItemPage(1);
  }, [searchQuery, pageSize]);

  useEffect(() => {
    setMonsterPage(1);
  }, [sizeFilter, typeFilter, crMinFilter, crMaxFilter]);

  useEffect(() => {
    setItemPage(1);
  }, [itemCategoryFilter, itemRarityFilter]);
  
  // 5e.tools import dialog state
  const [showSourceDialog, setShowSourceDialog] = useState(false);
  const [selectedSources, setSelectedSources] = useState<Set<string>>(new Set(['mm']));
  const [importProgress, setImportProgress] = useState<string>('');
  const [creatingToken, setCreatingToken] = useState<string | null>(null);

  // Parse vision senses from monster data to create illumination sources
  const parseMonsterSenses = (monster: Monster5eTools): IlluminationSource[] => {
    const sources: IlluminationSource[] = [];
    
    if (!monster.senses || monster.senses.length === 0) {
      return sources;
    }
    
    for (const sense of monster.senses) {
      const senseLower = sense.toLowerCase();
      
      // Parse darkvision (e.g., "darkvision 60 ft." or "darkvision 120 ft.")
      const darkvisionMatch = senseLower.match(/darkvision\s+(\d+)\s*ft/);
      if (darkvisionMatch) {
        const range = parseInt(darkvisionMatch[1], 10) / 5; // Convert feet to grid units
        sources.push({
          id: `illum-darkvision-${Date.now()}`,
          name: 'Darkvision',
          enabled: true,
          position: { x: 0, y: 0 }, // Will be updated by token position
          range,
          brightZone: 0.0, // Darkvision sees in dim light
          brightIntensity: 0.0,
          dimIntensity: 0.7,
          color: '#90EE90',
          colorEnabled: true,
          colorIntensity: 0.1,
          softEdge: true,
          softEdgeRadius: 4,
          animation: 'none',
          animationSpeed: 1.0,
          animationIntensity: 0.0,
        });
        continue;
      }
      
      // Parse blindsight (e.g., "blindsight 30 ft.")
      const blindsightMatch = senseLower.match(/blindsight\s+(\d+)\s*ft/);
      if (blindsightMatch) {
        const range = parseInt(blindsightMatch[1], 10) / 5;
        sources.push({
          id: `illum-blindsight-${Date.now()}`,
          name: 'Blindsight',
          enabled: true,
          position: { x: 0, y: 0 },
          range,
          brightZone: 1.0, // Blindsight is full "bright" perception
          brightIntensity: 1.0,
          dimIntensity: 0.0,
          color: '#ADD8E6',
          colorEnabled: true,
          colorIntensity: 0.15,
          softEdge: true,
          softEdgeRadius: 2,
          animation: 'none',
          animationSpeed: 1.0,
          animationIntensity: 0.0,
        });
        continue;
      }
      
      // Parse truesight (e.g., "truesight 120 ft.")
      const truesightMatch = senseLower.match(/truesight\s+(\d+)\s*ft/);
      if (truesightMatch) {
        const range = parseInt(truesightMatch[1], 10) / 5;
        sources.push({
          id: `illum-truesight-${Date.now()}`,
          name: 'Truesight',
          enabled: true,
          position: { x: 0, y: 0 },
          range,
          brightZone: 1.0,
          brightIntensity: 1.0,
          dimIntensity: 0.0,
          color: '#FFD700',
          colorEnabled: true,
          colorIntensity: 0.2,
          softEdge: true,
          softEdgeRadius: 6,
          animation: 'glow',
          animationSpeed: 0.5,
          animationIntensity: 0.2,
        });
        continue;
      }
      
      // Parse tremorsense (e.g., "tremorsense 60 ft.")
      const tremorsenseMatch = senseLower.match(/tremorsense\s+(\d+)\s*ft/);
      if (tremorsenseMatch) {
        const range = parseInt(tremorsenseMatch[1], 10) / 5;
        sources.push({
          id: `illum-tremorsense-${Date.now()}`,
          name: 'Tremorsense',
          enabled: true,
          position: { x: 0, y: 0 },
          range,
          brightZone: 0.8,
          brightIntensity: 0.8,
          dimIntensity: 0.4,
          color: '#8B4513',
          colorEnabled: true,
          colorIntensity: 0.15,
          softEdge: true,
          softEdgeRadius: 4,
          animation: 'pulse',
          animationSpeed: 0.3,
          animationIntensity: 0.15,
        });
        continue;
      }
    }
    
    return sources;
  };

  // Create token from monster
  const handleCreateMonsterToken = async (monster: Monster5eTools) => {
    setCreatingToken(monster.id);
    
    try {
      const gridSize = MONSTER_SIZE_GRID[monster.size] || 1;
      const tokenId = `token-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const center = getViewportCenter();
      
      // Try to fetch token art if available
      let imageUrl = '';
      const artUrl = monster.tokenIconUrl || monster.tokenUrl || monster.fluffImages?.[0]?.url;
      
      // Only attempt to load if it looks like a full URL
      if (artUrl && (artUrl.startsWith('http://') || artUrl.startsWith('https://') || artUrl.startsWith('data:'))) {
        try {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Timeout')), 5000);
            img.onload = () => { clearTimeout(timeout); resolve(); };
            img.onerror = () => { clearTimeout(timeout); reject(new Error('Failed to load image')); };
            img.src = artUrl;
          });
          imageUrl = artUrl;
        } catch {
          console.warn(`Could not load token art for ${monster.name}, using default`);
        }
      }
      
      // Parse creature senses for vision/illumination
      const illuminationSources = parseMonsterSenses(monster);
      
      // Use random color if no image is available
      const tokenColor = imageUrl ? undefined : getRandomTokenColor();
      
      const newToken = {
        id: tokenId,
        name: monster.name,
        imageUrl,
        x: center.x,
        y: center.y,
        gridWidth: gridSize,
        gridHeight: gridSize,
        label: monster.name,
        labelPosition: 'below' as LabelPosition,
        roleId: 'dungeon-master', // Monsters default to DM control
        isHidden: false,
        color: tokenColor,
        entityRef: {
          type: 'local' as const,
          entityId: monster.id,
          projectionType: 'monster',
        },
        // Only add illumination sources if the creature has special senses
        ...(illuminationSources.length > 0 ? { illuminationSources } : {}),
      };
      
      addToken(newToken);
      
      // Build success message with senses info
      const sensesInfo = illuminationSources.length > 0 
        ? ` with ${illuminationSources.map(s => s.name).join(', ')}`
        : '';
      toast.success(`Created ${monster.name} token (${MONSTER_SIZE_NAMES[monster.size]}, ${gridSize}×${gridSize})${sensesInfo}`);
    } catch (error) {
      console.error('Failed to create token:', error);
      toast.error('Failed to create token');
    } finally {
      setCreatingToken(null);
    }
  };

  // Create token from character
  const handleCreateCharacterToken = async (character: DndBeyondCharacter) => {
    setCreatingToken(character.id);
    
    try {
      const tokenId = `token-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const center = getViewportCenter();
      
      // Try to load portrait / token icon
      let imageUrl = '';
      const artUrl = character.tokenIconUrl || character.portraitUrl;
      if (artUrl) {
        try {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject(new Error('Failed to load image'));
            img.src = artUrl;
          });
          imageUrl = artUrl;
        } catch {
          console.warn(`Could not load portrait for ${character.name}`);
        }
      }
      
      // Use random color if no image is available
      const tokenColor = imageUrl ? undefined : getRandomTokenColor();
      
      const newToken = {
        id: tokenId,
        name: character.name,
        imageUrl,
        x: center.x,
        y: center.y,
        gridWidth: 1, // Characters are typically Medium
        gridHeight: 1,
        label: character.name,
        labelPosition: 'below' as LabelPosition,
        roleId: 'player', // Characters default to player control
        isHidden: false,
        color: tokenColor,
        entityRef: {
          type: 'local' as const,
          entityId: character.id,
          projectionType: 'character',
        },
      };
      
      addToken(newToken);
      toast.success(`Created ${character.name} token`);
    } catch (error) {
      console.error('Failed to create token:', error);
      toast.error('Failed to create token');
    } finally {
      setCreatingToken(null);
    }
  };

  // Filter results - include characters/monsters arrays in deps to refresh on import
  const filteredCharacters = useMemo(() => {
    return searchCharacters(searchQuery);
  }, [searchQuery, searchCharacters, characters]);

  const filteredMonsters = useMemo(() => {
    return searchMonsters(searchQuery, {
      size: sizeFilter !== 'all' ? sizeFilter : undefined,
      type: typeFilter !== 'all' ? typeFilter : undefined,
      crMin: crMinFilter !== 'any' ? parseFloat(crMinFilter) : undefined,
      crMax: crMaxFilter !== 'any' ? parseFloat(crMaxFilter) : undefined,
    });
  }, [searchQuery, sizeFilter, typeFilter, crMinFilter, crMaxFilter, searchMonsters, monsters]);

  const filteredItems = useMemo(() => {
    return searchItems(searchQuery, {
      category: itemCategoryFilter !== 'all' ? itemCategoryFilter as ItemCategory : undefined,
      rarity: itemRarityFilter !== 'all' ? itemRarityFilter as ItemRarity : undefined,
    });
  }, [searchQuery, itemCategoryFilter, itemRarityFilter, searchItems, items]);

  const pagedCharacters = useMemo(() => {
    return filteredCharacters.slice((characterPage - 1) * pageSize, characterPage * pageSize);
  }, [filteredCharacters, characterPage, pageSize]);

  const pagedMonsters = useMemo(() => {
    return filteredMonsters.slice((monsterPage - 1) * pageSize, monsterPage * pageSize);
  }, [filteredMonsters, monsterPage, pageSize]);

  const pagedItems = useMemo(() => {
    return filteredItems.slice((itemPage - 1) * pageSize, itemPage * pageSize);
  }, [filteredItems, itemPage, pageSize]);

  // Character import modal state
  const [showImportModal, setShowImportModal] = useState(false);

  const handleImportCharacter = () => {
    setShowImportModal(true);
  };

  const handleCreateBlankCharacter = useCallback(() => {
    const blank = generateBlankTemplate();
    blank.name = 'New Character';
    addCharacter(blank);
    toast.success('Blank character created — open it to edit');
  }, [addCharacter]);

  const handleCreateBlankMonster = useCallback(() => {
    const now = Date.now();
    const monster: Monster5eTools = {
      id: `monster-${now}-${Math.random().toString(36).slice(2, 6)}`,
      name: 'New Monster',
      source: 'Homebrew',
      size: 'M' as MonsterSize,
      type: { type: 'humanoid' },
      ac: [{ ac: 10 }],
      hp: { average: 10, formula: '2d8+2' },
      speed: { walk: 30 },
      str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10,
      cr: '0',
      passive: 10,
    };
    addMonster(monster);
    toast.success('Blank monster created — open it to edit');
  }, [addMonster]);

  const handleCreateItem = () => {
    const now = new Date().toISOString();
    const item: LibraryItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: 'New Item',
      category: 'other',
      createdAt: now,
      updatedAt: now,
    };
    addItem(item);
    setEditingItemId(item.id);
    toast.success('Item created — edit details below');
  };

  const handleImportItemsJson = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        const arr: LibraryItem[] = Array.isArray(data) ? data : data.items ? data.items : [data];
        const now = new Date().toISOString();
        const imported = arr.map((raw: any) => ({
          id: raw.id || `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: raw.name || 'Unnamed',
          category: raw.category || 'other',
          rarity: raw.rarity,
          description: raw.description,
          weight: raw.weight,
          value: raw.value,
          requiresAttunement: raw.requiresAttunement,
          attunementRequirement: raw.attunementRequirement,
          armorClass: raw.armorClass,
          properties: raw.properties,
          attacks: raw.attacks,
          spells: raw.spells,
          traits: raw.traits,
          maxCharges: raw.maxCharges,
          rechargeRule: raw.rechargeRule,
          customFields: raw.customFields,
          source: raw.source || file.name.replace('.json', ''),
          imageUrl: raw.imageUrl,
          createdAt: raw.createdAt || now,
          updatedAt: now,
        } as LibraryItem));
        addItems(imported);
        toast.success(`Imported ${imported.length} item(s)`);
      } catch (err) {
        toast.error('Failed to parse JSON file');
      }
    };
    input.click();
  };

  const handleImportBestiary = () => {
    // Create a file input for JSON import
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const data = JSON.parse(text);
        
        // Handle 5e.tools format (has "monster" array) or direct array
        const monsterArray = data.monster || (Array.isArray(data) ? data : []);
        
        if (monsterArray.length === 0) {
          toast.error('No monsters found in file');
          return;
        }

        // Transform to our format with IDs
        const monstersWithIds = monsterArray.map((m: Monster5eTools, index: number) => ({
          ...m,
          id: m.id || `${m.name?.toLowerCase().replace(/\s+/g, '-') || 'monster'}-${m.source || 'unknown'}-${index}`,
        }));

        addMonsters(monstersWithIds);
        toast.success(`Imported ${monstersWithIds.length} monsters`);
      } catch (error) {
        console.error('Failed to import bestiary:', error);
        toast.error('Failed to parse JSON file');
      }
    };
    input.click();
  };

  const handleFetchFromWeb = async () => {
    if (selectedSources.size === 0) {
      toast.error('Please select at least one source');
      return;
    }

    setShowSourceDialog(false);
    setBestiaryLoading(true);
    
    const sourcesToFetch = BESTIARY_SOURCES.filter(s => selectedSources.has(s.id));
    let totalImported = 0;
    let failedSources: { name: string; url: string }[] = [];

    for (const source of sourcesToFetch) {
      setImportProgress(`Fetching ${source.name}...`);
      const url = `https://5e.tools/data/bestiary/${source.file}`;
      
      try {
        // 5e.tools hosts data at this URL pattern
        const response = await fetch(url);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        const monsterArray = data.monster || [];
        
        if (monsterArray.length > 0) {
          const monstersWithIds = monsterArray.map((m: Monster5eTools, index: number) => ({
            ...m,
            id: m.id || `${m.name?.toLowerCase().replace(/\s+/g, '-') || 'monster'}-${m.source || source.id}-${index}`,
          }));
          
          addMonsters(monstersWithIds);
          totalImported += monstersWithIds.length;
        }
      } catch (error) {
        console.error(`Failed to fetch ${source.name}:`, error);
        failedSources.push({ name: source.name, url });
      }
    }

    setImportProgress('');
    setBestiaryLoading(false);

    if (totalImported > 0) {
      toast.success(`Imported ${totalImported} monsters from ${sourcesToFetch.length - failedSources.length} sources`);
    }
    
    // If fetch failed (likely CORS), offer to open URLs for manual download
    if (failedSources.length > 0) {
      toast.error(
        `CORS blocked ${failedSources.length} source(s). Opening in new tabs for manual download...`,
        { duration: 5000 }
      );
      
      // Open each failed URL in a new tab so user can save the JSON
      for (const failed of failedSources) {
        window.open(failed.url, '_blank');
      }
      
      toast.info(
        'Save the JSON files, then use "Import JSON" to load them.',
        { duration: 8000 }
      );
    }
  };

  const toggleSource = (sourceId: string) => {
    setSelectedSources(prev => {
      const next = new Set(prev);
      if (next.has(sourceId)) {
        next.delete(sourceId);
      } else {
        next.add(sourceId);
      }
      return next;
    });
  };

  const selectAllSources = () => {
    setSelectedSources(new Set(BESTIARY_SOURCES.map(s => s.id)));
  };

  const clearSourceSelection = () => {
    setSelectedSources(new Set());
  };

  const handleOpenCharacterSheet = (character: DndBeyondCharacter) => {
    if (onSelectEntity) {
      onSelectEntity(character.id, 'character');
      return;
    }
    
    registerCard({
      type: CardType.LIBRARY_EDITOR,
      title: character.name,
      defaultPosition: { x: 400, y: 100 },
      defaultSize: { width: 450, height: 650 },
      minSize: { width: 380, height: 500 },
      isResizable: true,
      isClosable: true,
      defaultVisible: true,
      metadata: { entityId: character.id, entityType: 'character' },
    });
  };

  const handleOpenMonsterStatBlock = (monster: Monster5eTools) => {
    if (onSelectEntity) {
      onSelectEntity(monster.id, 'monster');
      return;
    }
    
    registerCard({
      type: CardType.LIBRARY_EDITOR,
      title: monster.name,
      defaultPosition: { x: 400, y: 100 },
      defaultSize: { width: 450, height: 650 },
      minSize: { width: 380, height: 500 },
      isResizable: true,
      isClosable: true,
      defaultVisible: true,
      metadata: { entityId: monster.id, entityType: 'monster' },
    });
  };

  const getMonsterTypeString = (monster: Monster5eTools): string => {
    if (typeof monster.type === 'string') return monster.type;
    return monster.type?.type || 'unknown';
  };

  const formatCR = (cr: string | number): string => {
    return String(cr);
  };

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={activeTab === 'items' ? 'Search items...' : 'Search creatures...'}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Tabs */}
      <Tabs 
        value={activeTab} 
        onValueChange={(v) => setActiveTab(v as 'characters' | 'monsters' | 'items')} 
        className="flex-1 flex flex-col min-h-0"
      >
        <TabsList className={forcedTab ? "hidden" : "w-full"}>
          <TabsTrigger value="characters" className="flex-1 gap-1 text-xs">
            <Users className="h-3.5 w-3.5" />
            Characters ({characters.length})
          </TabsTrigger>
          <TabsTrigger value="monsters" className="flex-1 gap-1 text-xs">
            <Skull className="h-3.5 w-3.5" />
            Monsters ({monsters.length})
          </TabsTrigger>
          <TabsTrigger value="items" className="flex-1 gap-1 text-xs">
            <Package className="h-3.5 w-3.5" />
            Items ({items.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="characters" className="flex-1 flex flex-col gap-3 mt-3 min-h-0">
          <div className="grid grid-cols-2 gap-2 shrink-0">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleCreateBlankCharacter}
              className="w-full gap-1"
            >
              <Plus className="h-4 w-4" />
              New Character
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleImportCharacter}
              className="w-full gap-1"
            >
              <UserPlus className="h-4 w-4" />
              Import
            </Button>
          </div>

          {filteredCharacters.length > 0 && (
            <ListPaginator 
              page={characterPage} 
              totalItems={filteredCharacters.length} 
              pageSize={pageSize} 
              onPageChange={setCharacterPage} 
              onPageSizeChange={setPageSize}
            />
          )}

          <ScrollArea className="flex-1 min-h-0">
            {filteredCharacters.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No characters imported</p>
                <p className="text-xs mt-1">Import from D&D Beyond to get started</p>
              </div>
            ) : (
              <div className="pr-4 pb-2 space-y-2">
                {pagedCharacters.map((char) => (
                  <CharacterListItem
                      key={char.id}
                      character={char}
                      onEdit={() => handleOpenCharacterSheet(char)}
                      onCreateToken={() => handleCreateCharacterToken(char)}
                      isCreating={creatingToken === char.id}
                      onRemove={() => {
                        removeCharacter(char.id);
                        toast.success(`Removed ${char.name}`);
                      }}
                    />
                  ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        {/* Monsters Tab */}
        <TabsContent value="monsters" className="flex-1 flex flex-col gap-3 mt-3 min-h-0">
          {/* Import Buttons */}
          <div className="grid grid-cols-3 gap-2 shrink-0">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleCreateBlankMonster}
              className="gap-1"
            >
              <Plus className="h-4 w-4" />
              New
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setShowSourceDialog(true)}
              disabled={bestiaryLoading}
            >
              {bestiaryLoading ? (
                <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Globe className="h-4 w-4 mr-1" />
              )}
              {bestiaryLoading ? 'Loading...' : '5e.tools'}
            </Button>
            
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleImportBestiary}
              disabled={bestiaryLoading}
            >
              <FileJson className="h-4 w-4 mr-1" />
              JSON
            </Button>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-2 gap-2 shrink-0">
            <Select value={sizeFilter} onValueChange={setSizeFilter}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Size" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any Size</SelectItem>
                {SIZE_OPTIONS.map((size) => (
                  <SelectItem key={size} value={size}>
                    {MONSTER_SIZE_NAMES[size]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any Type</SelectItem>
                {MONSTER_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={crMinFilter} onValueChange={setCrMinFilter}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="CR Min" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">CR Min</SelectItem>
                {CR_OPTIONS.map((cr) => (
                  <SelectItem key={cr.label} value={String(cr.value)}>
                    CR {cr.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={crMaxFilter} onValueChange={setCrMaxFilter}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="CR Max" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">CR Max</SelectItem>
                {CR_OPTIONS.map((cr) => (
                  <SelectItem key={cr.label} value={String(cr.value)}>
                    CR {cr.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {filteredMonsters.length > 0 && (
            <ListPaginator 
              page={monsterPage} 
              totalItems={filteredMonsters.length} 
              pageSize={pageSize} 
              onPageChange={setMonsterPage}
              onPageSizeChange={setPageSize}
            />
          )}

          {/* Monster List */}
          <ScrollArea className="flex-1 min-h-0">
            {filteredMonsters.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <Skull className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No monsters found</p>
                <p className="text-xs mt-1">Import a 5e.tools bestiary JSON to get started</p>
              </div>
            ) : (
              <div className="pr-4 pb-2 space-y-2">
                {pagedMonsters.map((monster) => (
                  <MonsterListItem
                      key={monster.id}
                      monster={monster}
                      onEdit={() => handleOpenMonsterStatBlock(monster)}
                      onCreateToken={() => handleCreateMonsterToken(monster)}
                      isCreating={creatingToken === monster.id}
                      onRemove={() => {
                        removeMonster(monster.id);
                        toast.success(`Removed ${monster.name}`);
                      }}
                      getMonsterTypeString={getMonsterTypeString}
                      formatCR={formatCR}
                    />
                  ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        {/* Items Tab */}
        <TabsContent value="items" className="flex-1 flex flex-col gap-3 mt-3 min-h-0">
          <div className="grid grid-cols-2 gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={handleCreateItem} className="gap-1">
              <Plus className="h-4 w-4" />
              New Item
            </Button>
            <Button variant="outline" size="sm" onClick={handleImportItemsJson} className="gap-1">
              <FileJson className="h-4 w-4" />
              Import JSON
            </Button>
          </div>

          {/* Filters */}
          <div className="flex gap-2 shrink-0">
            <Select value={itemCategoryFilter} onValueChange={setItemCategoryFilter}>
              <SelectTrigger className="h-8 text-xs flex-1">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {(Object.keys(ITEM_CATEGORY_LABELS) as ItemCategory[]).map((cat) => (
                  <SelectItem key={cat} value={cat}>{ITEM_CATEGORY_LABELS[cat]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={itemRarityFilter} onValueChange={setItemRarityFilter}>
              <SelectTrigger className="h-8 text-xs flex-1">
                <SelectValue placeholder="Rarity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Rarities</SelectItem>
                {(Object.keys(ITEM_RARITY_LABELS) as ItemRarity[]).map((r) => (
                  <SelectItem key={r} value={r}>{ITEM_RARITY_LABELS[r]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <ScrollArea className="flex-1 min-h-0">
            {filteredItems.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No items in library</p>
                <p className="text-xs mt-1">Create or import JSON items to get started</p>
              </div>
            ) : (
              <div className="pr-4 pb-2 space-y-2">
                {pagedItems.map((item) => (
                  <ItemListEntry
                      key={item.id}
                      item={item}
                      isEditing={editingItemId === item.id}
                      onEdit={() => setEditingItemId(editingItemId === item.id ? null : item.id)}
                      onUpdate={(updates) => {
                        useItemStore.getState().updateItem(item.id, updates);
                      }}
                      onRemove={() => {
                        removeItem(item.id);
                        if (editingItemId === item.id) setEditingItemId(null);
                        toast.success(`Removed ${item.name}`);
                      }}
                    />
                  ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>
      </Tabs>

      {/* 5e.tools Source Selection Dialog */}
      <Dialog open={showSourceDialog} onOpenChange={setShowSourceDialog}>
        <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Fetch from 5e.tools
            </DialogTitle>
            <DialogDescription>
              Select which source books to import monsters from. Data is fetched directly from 5e.tools.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex gap-2 mb-2">
            <Button variant="outline" size="sm" onClick={selectAllSources}>
              Select All
            </Button>
            <Button variant="outline" size="sm" onClick={clearSourceSelection}>
              Clear All
            </Button>
            <Badge variant="secondary" className="ml-auto">
              {selectedSources.size} selected
            </Badge>
          </div>

          <ScrollArea className="flex-1 min-h-0 max-h-[300px] border rounded-md p-3">
            <div className="space-y-2">
              {BESTIARY_SOURCES.map((source) => (
                <label
                  key={source.id}
                  className="flex items-center gap-3 p-2 rounded-md hover:bg-muted cursor-pointer"
                >
                  <Checkbox
                    checked={selectedSources.has(source.id)}
                    onCheckedChange={() => toggleSource(source.id)}
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{source.name}</p>
                    <p className="text-xs text-muted-foreground uppercase">{source.id}</p>
                  </div>
                </label>
              ))}
            </div>
          </ScrollArea>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowSourceDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleFetchFromWeb} disabled={selectedSources.size === 0}>
              <Download className="h-4 w-4 mr-2" />
              Fetch {selectedSources.size} Source{selectedSources.size !== 1 ? 's' : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Character Modal */}
      <ImportCharacterModal 
        open={showImportModal} 
        onOpenChange={setShowImportModal} 
      />
    </div>
  );
}

interface ListPaginatorProps {
  page: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (p: number) => void;
  onPageSizeChange: (s: number) => void;
}

function ListPaginator({ page, totalItems, pageSize, onPageChange, onPageSizeChange }: ListPaginatorProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  
  if (totalItems === 0) return null;

  return (
    <div className="flex items-center justify-between py-1 border-b border-border shrink-0 gap-2 mb-1">
      <div className="flex items-center gap-1">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => onPageChange(page - 1)} 
          disabled={page <= 1} 
          className="h-6 w-6 p-0"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </Button>
        <span className="text-[10px] text-muted-foreground min-w-[36px] text-center">
          {page} / {totalPages}
        </span>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => onPageChange(page + 1)} 
          disabled={page >= totalPages} 
          className="h-6 w-6 p-0"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </Button>
      </div>
      
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
          {totalItems} total
        </span>
        <Select value={String(pageSize)} onValueChange={(val) => onPageSizeChange(Number(val))}>
          <SelectTrigger className="h-6 w-[70px] text-[10px] px-2 bg-transparent">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="5">5 / pg</SelectItem>
            <SelectItem value="10">10 / pg</SelectItem>
            <SelectItem value="20">20 / pg</SelectItem>
            <SelectItem value="50">50 / pg</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

// Character List Item Component
interface CharacterListItemProps {
  character: DndBeyondCharacter;
  onEdit: () => void;
  onCreateToken: () => void;
  isCreating: boolean;
  onRemove: () => void;
}

function CharacterListItem({ character, onEdit, onCreateToken, isCreating, onRemove }: CharacterListItemProps) {
  const classString = character.classes.map((c) => `${c.name} ${c.level}`).join(' / ');
  
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors group">
      {/* Portrait */}
      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden flex-shrink-0">
        {character.portraitUrl ? (
          <img 
            src={character.portraitUrl} 
            alt={character.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <Users className="h-5 w-5 text-primary" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-[120px]">
        <p className="text-sm font-medium truncate">{character.name}</p>
        <p className="text-xs text-muted-foreground truncate">
          Level {character.level} {character.race} {classString}
        </p>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Badge variant="outline" className="text-[10px] px-1.5">
          AC {character.armorClass}
        </Badge>
        <Badge variant="outline" className="text-[10px] px-1.5">
          HP {character.hitPoints.current}/{character.hitPoints.max}
        </Badge>
      </div>

      {/* Actions */}
      <div className="flex gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity ml-auto shrink-0">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-7 w-7" 
              onClick={onCreateToken}
              disabled={isCreating}
            >
              {isCreating ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Target className="h-3.5 w-3.5" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>Create Token</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">Edit Character</TooltipContent>
        </Tooltip>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={(e) => e.stopPropagation()}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent onClick={(e) => e.stopPropagation()}>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Character</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete the character "{character.name}"? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove();
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

// Monster List Item Component
interface MonsterListItemProps {
  monster: Monster5eTools;
  onEdit: () => void;
  onCreateToken: () => void;
  isCreating: boolean;
  onRemove: () => void;
  getMonsterTypeString: (m: Monster5eTools) => string;
  formatCR: (cr: string | number) => string;
}

function MonsterListItem({ monster, onEdit, onCreateToken, isCreating, onRemove, getMonsterTypeString, formatCR }: MonsterListItemProps) {
  const monsterType = getMonsterTypeString(monster);
  const sizeName = MONSTER_SIZE_NAMES[monster.size] || monster.size;
  const gridSize = MONSTER_SIZE_GRID[monster.size] || 1;
  
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors group">
      {/* Token Art */}
      <div className="w-10 h-10 rounded-full bg-destructive/20 flex items-center justify-center overflow-hidden flex-shrink-0">
        {monster.tokenUrl ? (
          <img 
            src={monster.tokenUrl} 
            alt={monster.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <Skull className="h-5 w-5 text-destructive" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-[120px]">
        <p className="text-sm font-medium truncate">{monster.name}</p>
        <p className="text-xs text-muted-foreground truncate">
          {sizeName} {monsterType}
        </p>
      </div>

      {/* Badges */}
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="text-[10px] px-1.5 flex-shrink-0">
          CR {formatCR(monster.cr)}
        </Badge>
        <span className="text-[10px] text-muted-foreground flex-shrink-0">
          {monster.source}
        </span>
      </div>

      {/* Actions */}
      <div className="flex gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity ml-auto shrink-0">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-7 w-7" 
              onClick={onCreateToken}
              disabled={isCreating}
            >
              {isCreating ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Target className="h-3.5 w-3.5" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>Create Token ({gridSize}×{gridSize})</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">Edit Monster</TooltipContent>
        </Tooltip>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={(e) => e.stopPropagation()}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent onClick={(e) => e.stopPropagation()}>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Monster</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete the monster "{monster.name}"? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove();
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

// Item List Entry Component
interface ItemListEntryProps {
  item: LibraryItem;
  isEditing: boolean;
  onEdit: () => void;
  onUpdate: (updates: Partial<LibraryItem>) => void;
  onRemove: () => void;
}

function ItemListEntry({ item, isEditing, onEdit, onUpdate, onRemove }: ItemListEntryProps) {
  const rarityLabel = item.rarity ? ITEM_RARITY_LABELS[item.rarity] : null;
  const categoryLabel = ITEM_CATEGORY_LABELS[item.category] || item.category;

  return (
    <div className="rounded-lg bg-muted/50 hover:bg-muted transition-colors group">
      {/* Summary row */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 p-2">
        <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
          <Gem className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-[120px]">
          <p className="text-sm font-medium truncate">{item.name}</p>
          <p className="text-xs text-muted-foreground truncate">
            {categoryLabel}
            {item.value ? ` · ${item.value}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {rarityLabel && (
            <Badge variant="outline" className="text-[10px] px-1.5 shrink-0">
              {rarityLabel}
            </Badge>
          )}
          {item.source && (
            <span className="text-[10px] text-muted-foreground shrink-0">{item.source}</span>
          )}
        </div>
        <div className="flex gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity ml-auto shrink-0">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={(e) => e.stopPropagation()}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent onClick={(e) => e.stopPropagation()}>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Item</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete the item "{item.name}"? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove();
                  }}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Inline editor */}
      {isEditing && (
        <div className="px-3 pb-3 space-y-2 border-t border-border pt-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px]">Name</Label>
              <Input className="h-7 text-xs" value={item.name} onChange={(e) => onUpdate({ name: e.target.value })} />
            </div>
            <div>
              <Label className="text-[10px]">Value</Label>
              <Input className="h-7 text-xs" value={item.value || ''} onChange={(e) => onUpdate({ value: e.target.value })} placeholder="e.g. 50 gp" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px]">Category</Label>
              <Select value={item.category} onValueChange={(v) => onUpdate({ category: v as ItemCategory })}>
                <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(ITEM_CATEGORY_LABELS) as ItemCategory[]).map((cat) => (
                    <SelectItem key={cat} value={cat}>{ITEM_CATEGORY_LABELS[cat]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px]">Rarity</Label>
              <Select value={item.rarity || 'common'} onValueChange={(v) => onUpdate({ rarity: v as ItemRarity })}>
                <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(ITEM_RARITY_LABELS) as ItemRarity[]).map((r) => (
                    <SelectItem key={r} value={r}>{ITEM_RARITY_LABELS[r]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px]">Weight (lbs)</Label>
              <Input type="number" className="h-7 text-xs" value={item.weight ?? ''} onChange={(e) => onUpdate({ weight: e.target.value ? parseFloat(e.target.value) : undefined })} />
            </div>
            <div>
              <Label className="text-[10px]">Source</Label>
              <Input className="h-7 text-xs" value={item.source || ''} onChange={(e) => onUpdate({ source: e.target.value })} placeholder="e.g. DMG" />
            </div>
          </div>
          <div>
            <Label className="text-[10px]">Description / Flavor Text</Label>
            <Textarea className="text-xs min-h-[60px]" value={item.description || ''} onChange={(e) => onUpdate({ description: e.target.value })} placeholder="A glowing sword humming with arcane energy..." />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox checked={item.requiresAttunement || false} onCheckedChange={(v) => onUpdate({ requiresAttunement: !!v })} />
            <Label className="text-xs">Requires Attunement</Label>
            {item.requiresAttunement && (
              <Input className="h-7 text-xs flex-1" value={item.attunementRequirement || ''} onChange={(e) => onUpdate({ attunementRequirement: e.target.value })} placeholder="by a cleric or paladin" />
            )}
          </div>

          {/* Attacks */}
          <div>
            <div className="flex items-center justify-between">
              <Label className="text-[10px]">Attacks</Label>
              <Button variant="ghost" size="sm" className="h-5 px-1 text-[10px]" onClick={() => {
                const attacks = [...(item.attacks || []), { name: 'New Attack', description: '' }];
                onUpdate({ attacks });
              }}><Plus className="h-3 w-3" /></Button>
            </div>
            {(item.attacks || []).map((atk, i) => (
              <div key={i} className="flex gap-1 mt-1">
                <Input className="h-6 text-[10px] flex-1" value={atk.name} onChange={(e) => {
                  const attacks = [...(item.attacks || [])];
                  attacks[i] = { ...attacks[i], name: e.target.value };
                  onUpdate({ attacks });
                }} placeholder="Attack name" />
                <Input className="h-6 text-[10px] w-16" value={atk.damage || ''} onChange={(e) => {
                  const attacks = [...(item.attacks || [])];
                  attacks[i] = { ...attacks[i], damage: e.target.value };
                  onUpdate({ attacks });
                }} placeholder="1d8+3" />
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive" onClick={() => {
                  const attacks = (item.attacks || []).filter((_, idx) => idx !== i);
                  onUpdate({ attacks });
                }}><Trash2 className="h-3 w-3" /></Button>
              </div>
            ))}
          </div>

          {/* Spells */}
          <div>
            <div className="flex items-center justify-between">
              <Label className="text-[10px]">Spells</Label>
              <Button variant="ghost" size="sm" className="h-5 px-1 text-[10px]" onClick={() => {
                const spells = [...(item.spells || []), { name: 'New Spell' }];
                onUpdate({ spells });
              }}><Plus className="h-3 w-3" /></Button>
            </div>
            {(item.spells || []).map((spell, i) => (
              <div key={i} className="flex gap-1 mt-1">
                <Input className="h-6 text-[10px] flex-1" value={spell.name} onChange={(e) => {
                  const spells = [...(item.spells || [])];
                  spells[i] = { ...spells[i], name: e.target.value };
                  onUpdate({ spells });
                }} placeholder="Spell name" />
                <Input type="number" className="h-6 text-[10px] w-12" value={spell.charges ?? ''} onChange={(e) => {
                  const spells = [...(item.spells || [])];
                  spells[i] = { ...spells[i], charges: e.target.value ? parseInt(e.target.value) : undefined };
                  onUpdate({ spells });
                }} placeholder="Ch." />
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive" onClick={() => {
                  const spells = (item.spells || []).filter((_, idx) => idx !== i);
                  onUpdate({ spells });
                }}><Trash2 className="h-3 w-3" /></Button>
              </div>
            ))}
          </div>

          {/* Traits */}
          <div>
            <div className="flex items-center justify-between">
              <Label className="text-[10px]">Traits</Label>
              <Button variant="ghost" size="sm" className="h-5 px-1 text-[10px]" onClick={() => {
                const traits = [...(item.traits || []), { name: 'New Trait', description: '' }];
                onUpdate({ traits });
              }}><Plus className="h-3 w-3" /></Button>
            </div>
            {(item.traits || []).map((trait, i) => (
              <div key={i} className="flex gap-1 mt-1">
                <Input className="h-6 text-[10px] w-24" value={trait.name} onChange={(e) => {
                  const traits = [...(item.traits || [])];
                  traits[i] = { ...traits[i], name: e.target.value };
                  onUpdate({ traits });
                }} placeholder="Trait name" />
                <Input className="h-6 text-[10px] flex-1" value={trait.description} onChange={(e) => {
                  const traits = [...(item.traits || [])];
                  traits[i] = { ...traits[i], description: e.target.value };
                  onUpdate({ traits });
                }} placeholder="Description" />
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive" onClick={() => {
                  const traits = (item.traits || []).filter((_, idx) => idx !== i);
                  onUpdate({ traits });
                }}><Trash2 className="h-3 w-3" /></Button>
              </div>
            ))}
          </div>

          {/* Charges */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px]">Max Charges</Label>
              <Input type="number" className="h-7 text-xs" value={item.maxCharges ?? ''} onChange={(e) => onUpdate({ maxCharges: e.target.value ? parseInt(e.target.value) : undefined })} />
            </div>
            <div>
              <Label className="text-[10px]">Recharge Rule</Label>
              <Input className="h-7 text-xs" value={item.rechargeRule || ''} onChange={(e) => onUpdate({ rechargeRule: e.target.value })} placeholder="1d6+1 at dawn" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
