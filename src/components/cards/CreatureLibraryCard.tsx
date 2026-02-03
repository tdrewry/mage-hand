import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
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
  Eye
} from 'lucide-react';
import { useCreatureStore } from '@/stores/creatureStore';
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
import { toast } from 'sonner';

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
  } = useCreatureStore();

  const { registerCard } = useCardStore();

  const [activeTab, setActiveTab] = useState<'characters' | 'monsters'>('monsters');
  const [searchQuery, setSearchQuery] = useState('');
  const [sizeFilter, setSizeFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [crMinFilter, setCrMinFilter] = useState<string>('any');
  const [crMaxFilter, setCrMaxFilter] = useState<string>('any');

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
          {/* Import Button */}
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleImportBestiary}
            disabled={bestiaryLoading}
            className="w-full"
          >
            {bestiaryLoading ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <FileJson className="h-4 w-4 mr-2" />
            )}
            {bestiaryLoading ? 'Loading...' : 'Import 5e.tools JSON'}
          </Button>

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
    </div>
  );
}

// Character List Item Component
interface CharacterListItemProps {
  character: DndBeyondCharacter;
  onView: () => void;
  onRemove: () => void;
}

function CharacterListItem({ character, onView, onRemove }: CharacterListItemProps) {
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
  onRemove: () => void;
  getMonsterTypeString: (m: Monster5eTools) => string;
  formatCR: (cr: string | number) => string;
}

function MonsterListItem({ monster, onView, onRemove, getMonsterTypeString, formatCR }: MonsterListItemProps) {
  const monsterType = getMonsterTypeString(monster);
  const sizeName = MONSTER_SIZE_NAMES[monster.size] || monster.size;
  
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
