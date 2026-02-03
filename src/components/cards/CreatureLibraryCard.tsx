import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
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
  Target
} from 'lucide-react';
import { useCreatureStore } from '@/stores/creatureStore';
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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface CreatureLibraryCardContentProps {
  cardId: string;
}

// Monster type list for filtering
const MONSTER_TYPES = [
  'aberration', 'beast', 'celestial', 'construct', 'dragon', 
  'elemental', 'fey', 'fiend', 'giant', 'humanoid', 
  'monstrosity', 'ooze', 'plant', 'undead'
];

const SIZE_OPTIONS: MonsterSize[] = ['T', 'S', 'M', 'L', 'H', 'G'];

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

export function CreatureLibraryCardContent({ cardId }: CreatureLibraryCardContentProps) {
  const { 
    characters, 
    monsters, 
    searchCharacters, 
    searchMonsters,
    removeCharacter,
    removeMonster,
    addMonsters,
    bestiaryLoading,
    setBestiaryLoading,
  } = useCreatureStore();

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

  const [activeTab, setActiveTab] = useState<'characters' | 'monsters'>('monsters');
  const [searchQuery, setSearchQuery] = useState('');
  const [sizeFilter, setSizeFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [crMinFilter, setCrMinFilter] = useState<string>('any');
  const [crMaxFilter, setCrMaxFilter] = useState<string>('any');
  
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
      
      // Try to fetch token art if available - only use if it's a valid loadable URL
      let imageUrl = '';
      const artUrl = monster.tokenUrl || monster.fluffImages?.[0]?.url;
      
      // Only attempt to load if it looks like a full URL (not a 5e.tools reference)
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
      
      // Try to load portrait
      let imageUrl = '';
      if (character.portraitUrl) {
        try {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject(new Error('Failed to load image'));
            img.src = character.portraitUrl!;
          });
          imageUrl = character.portraitUrl;
        } catch {
          console.warn(`Could not load portrait for ${character.name}`);
        }
      }
      
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

  // Filter results
  const filteredCharacters = useMemo(() => {
    return searchCharacters(searchQuery);
  }, [searchQuery, searchCharacters]);

  const filteredMonsters = useMemo(() => {
    return searchMonsters(searchQuery, {
      size: sizeFilter !== 'all' ? sizeFilter : undefined,
      type: typeFilter !== 'all' ? typeFilter : undefined,
      crMin: crMinFilter !== 'any' ? parseFloat(crMinFilter) : undefined,
      crMax: crMaxFilter !== 'any' ? parseFloat(crMaxFilter) : undefined,
    });
  }, [searchQuery, sizeFilter, typeFilter, crMinFilter, crMaxFilter, searchMonsters]);

  const handleImportCharacter = () => {
    // TODO: Open ImportCharacterModal
    toast.info('Character import coming soon! Will use D&D Beyond URL scraping.');
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
    registerCard({
      type: CardType.CHARACTER_SHEET,
      title: character.name,
      defaultPosition: { x: 400, y: 100 },
      defaultSize: { width: 450, height: 650 },
      minSize: { width: 380, height: 500 },
      isResizable: true,
      isClosable: true,
      defaultVisible: true,
      metadata: { characterId: character.id },
    });
  };

  const handleOpenMonsterStatBlock = (monster: Monster5eTools) => {
    registerCard({
      type: CardType.MONSTER_STAT_BLOCK,
      title: monster.name,
      defaultPosition: { x: 400, y: 100 },
      defaultSize: { width: 400, height: 600 },
      minSize: { width: 350, height: 450 },
      isResizable: true,
      isClosable: true,
      defaultVisible: true,
      metadata: { monsterId: monster.id },
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
          placeholder="Search creatures..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'characters' | 'monsters')}>
        <TabsList className="w-full">
          <TabsTrigger value="characters" className="flex-1 gap-1">
            <Users className="h-4 w-4" />
            Characters ({characters.length})
          </TabsTrigger>
          <TabsTrigger value="monsters" className="flex-1 gap-1">
            <Skull className="h-4 w-4" />
            Monsters ({monsters.length})
          </TabsTrigger>
        </TabsList>

        {/* Characters Tab */}
        <TabsContent value="characters" className="flex-1 flex flex-col gap-3 mt-3">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleImportCharacter}
            className="w-full"
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Import from D&D Beyond
          </Button>

          <ScrollArea className="flex-1 min-h-0">
            {filteredCharacters.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No characters imported</p>
                <p className="text-xs mt-1">Import from D&D Beyond to get started</p>
              </div>
            ) : (
              <div className="space-y-2 pr-4">
                {filteredCharacters.map((char) => (
                  <CharacterListItem
                    key={char.id}
                    character={char}
                    onView={() => handleOpenCharacterSheet(char)}
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
        <TabsContent value="monsters" className="flex-1 flex flex-col gap-3 mt-3">
          {/* Import Buttons */}
          <div className="grid grid-cols-2 gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setShowSourceDialog(true)}
              disabled={bestiaryLoading}
            >
              {bestiaryLoading ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Globe className="h-4 w-4 mr-2" />
              )}
              {bestiaryLoading ? (importProgress || 'Loading...') : 'Fetch from 5e.tools'}
            </Button>
            
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleImportBestiary}
              disabled={bestiaryLoading}
            >
              <FileJson className="h-4 w-4 mr-2" />
              Import JSON
            </Button>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-2 gap-2">
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

          {/* Monster List */}
          <ScrollArea className="flex-1 min-h-0">
            {filteredMonsters.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <Skull className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No monsters found</p>
                <p className="text-xs mt-1">Import a 5e.tools bestiary JSON to get started</p>
              </div>
            ) : (
              <div className="space-y-2 pr-4">
                {filteredMonsters.slice(0, 100).map((monster) => (
                  <MonsterListItem
                    key={monster.id}
                    monster={monster}
                    onView={() => handleOpenMonsterStatBlock(monster)}
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
                {filteredMonsters.length > 100 && (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    Showing 100 of {filteredMonsters.length} results. Refine your search.
                  </p>
                )}
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
    </div>
  );
}

// Character List Item Component
interface CharacterListItemProps {
  character: DndBeyondCharacter;
  onView: () => void;
  onCreateToken: () => void;
  isCreating: boolean;
  onRemove: () => void;
}

function CharacterListItem({ character, onView, onCreateToken, isCreating, onRemove }: CharacterListItemProps) {
  const classString = character.classes.map((c) => `${c.name} ${c.level}`).join(' / ');
  
  return (
    <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors group">
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
      <div className="flex-1 min-w-0">
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
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onView}>
          <Eye className="h-3.5 w-3.5" />
        </Button>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-7 w-7 text-destructive hover:text-destructive"
          onClick={onRemove}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

// Monster List Item Component
interface MonsterListItemProps {
  monster: Monster5eTools;
  onView: () => void;
  onCreateToken: () => void;
  isCreating: boolean;
  onRemove: () => void;
  getMonsterTypeString: (m: Monster5eTools) => string;
  formatCR: (cr: string | number) => string;
}

function MonsterListItem({ monster, onView, onCreateToken, isCreating, onRemove, getMonsterTypeString, formatCR }: MonsterListItemProps) {
  const monsterType = getMonsterTypeString(monster);
  const sizeName = MONSTER_SIZE_NAMES[monster.size] || monster.size;
  const gridSize = MONSTER_SIZE_GRID[monster.size] || 1;
  
  return (
    <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors group">
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
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{monster.name}</p>
        <p className="text-xs text-muted-foreground truncate">
          {sizeName} {monsterType}
        </p>
      </div>

      {/* CR Badge */}
      <Badge variant="secondary" className="text-[10px] px-1.5 flex-shrink-0">
        CR {formatCR(monster.cr)}
      </Badge>

      {/* Source */}
      <span className="text-[10px] text-muted-foreground flex-shrink-0">
        {monster.source}
      </span>

      {/* Actions */}
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onView}>
          <Eye className="h-3.5 w-3.5" />
        </Button>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-7 w-7 text-destructive hover:text-destructive"
          onClick={onRemove}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
