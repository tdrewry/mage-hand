import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Database, FileText, Unlink, Skull, Users, Link2, Search, X } from 'lucide-react';
import { useCreatureStore } from '@/stores/creatureStore';
import { 
  MONSTER_SIZE_NAMES, 
  formatModifier, 
  getAbilityModifier,
  type Monster5eTools,
  type DndBeyondCharacter 
} from '@/types/creatureTypes';
import type { Token } from '@/stores/sessionStore';

interface LinkedCreatureSectionProps {
  token: Token | null;
  onViewStats: () => void;
  onUnlink?: () => void;
  onLinkCreature?: (creatureId: string, creatureType: 'character' | 'monster') => void;
}

export function LinkedCreatureSection({ token, onViewStats, onUnlink, onLinkCreature }: LinkedCreatureSectionProps) {
  const { getCreatureById, getCreatureType, searchMonsters, searchCharacters, monsters, characters } = useCreatureStore();
  
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const linkedCreatureId = token?.entityRef?.entityId;
  const creature = linkedCreatureId ? getCreatureById(linkedCreatureId) : undefined;
  const creatureType = linkedCreatureId ? getCreatureType(linkedCreatureId) : undefined;
  
  // Search results
  const searchResults = useMemo(() => {
    const monsterResults = searchMonsters(searchQuery, { limit: 5 });
    const characterResults = searchCharacters(searchQuery).slice(0, 5);
    return { monsters: monsterResults, characters: characterResults };
  }, [searchQuery, searchMonsters, searchCharacters]);
  
  const hasLibraryContent = monsters.length > 0 || characters.length > 0;
  const hasSearchResults = searchResults.monsters.length > 0 || searchResults.characters.length > 0;
  
  const handleSelectCreature = (creatureId: string, type: 'character' | 'monster') => {
    onLinkCreature?.(creatureId, type);
    setShowSearch(false);
    setSearchQuery('');
  };
  
  const handleCancelSearch = () => {
    setShowSearch(false);
    setSearchQuery('');
  };
  
  // No linked creature - show placeholder or search UI
  if (!creature || !creatureType) {
    // Show search UI when toggled
    if (showSearch) {
      return (
        <div className="p-3 rounded-lg bg-muted/50 border border-muted-foreground/30">
          <div className="flex items-center gap-2 mb-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search creatures..."
              className="flex-1 h-8"
              autoFocus
            />
            <Button variant="ghost" size="sm" onClick={handleCancelSearch}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          {!hasLibraryContent ? (
            <p className="text-xs text-muted-foreground text-center py-2">
              No creatures in library. Import from Creature Library first.
            </p>
          ) : !hasSearchResults && searchQuery.length > 0 ? (
            <p className="text-xs text-muted-foreground text-center py-2">
              No creatures match "{searchQuery}"
            </p>
          ) : (
            <ScrollArea className="max-h-48">
              <div className="space-y-1">
                {/* Monsters Section */}
                {searchResults.monsters.length > 0 && (
                  <>
                    <p className="text-xs text-muted-foreground font-medium px-1 pt-1">Monsters</p>
                    {searchResults.monsters.map((monster) => {
                      const monsterType = typeof monster.type === 'object' ? monster.type.type : monster.type;
                      return (
                        <button
                          key={monster.id}
                          className="w-full flex items-center gap-2 p-2 rounded-md hover:bg-accent/50 text-left transition-colors"
                          onClick={() => handleSelectCreature(monster.id, 'monster')}
                        >
                          <Skull className="h-4 w-4 text-destructive shrink-0" />
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-medium truncate block">{monster.name}</span>
                            <span className="text-xs text-muted-foreground">
                              CR {monster.cr}, {MONSTER_SIZE_NAMES[monster.size]} {monsterType}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </>
                )}
                
                {/* Characters Section */}
                {searchResults.characters.length > 0 && (
                  <>
                    <p className="text-xs text-muted-foreground font-medium px-1 pt-2">Characters</p>
                    {searchResults.characters.map((character) => {
                      const classString = character.classes.map(c => `${c.name} ${c.level}`).join(' / ');
                      return (
                        <button
                          key={character.id}
                          className="w-full flex items-center gap-2 p-2 rounded-md hover:bg-accent/50 text-left transition-colors"
                          onClick={() => handleSelectCreature(character.id, 'character')}
                        >
                          <Users className="h-4 w-4 text-primary shrink-0" />
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-medium truncate block">{character.name}</span>
                            <span className="text-xs text-muted-foreground">
                              Lvl {character.level} {character.race} {classString}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </>
                )}
              </div>
            </ScrollArea>
          )}
        </div>
      );
    }
    
    // Show placeholder with "Link to Creature" button
    return (
      <div className="p-3 rounded-lg bg-muted/50 border border-dashed border-muted-foreground/30">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Database className="h-4 w-4" />
          <span className="text-sm font-medium">No Linked Creature</span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Create tokens from the Creature Library to automatically link creature data.
        </p>
        {onLinkCreature && (
          <Button 
            variant="outline" 
            size="sm" 
            className="mt-3 w-full"
            onClick={() => setShowSearch(true)}
          >
            <Link2 className="h-3 w-3 mr-1" />
            Link to Creature
          </Button>
        )}
      </div>
    );
  }
  
  // Render monster quick stats
  if (creatureType === 'monster') {
    const monster = creature as Monster5eTools;
    const monsterType = typeof monster.type === 'object' ? monster.type.type : monster.type;
    const hpAvg = monster.hp?.average || 0;
    const hpFormula = monster.hp?.formula || '';
    // Handle AC being number, array of numbers, or array of objects with .ac
    const acValue = Array.isArray(monster.ac) 
      ? (typeof monster.ac[0] === 'object' ? monster.ac[0].ac : monster.ac[0])
      : monster.ac;
    
    return (
      <div className="p-3 rounded-lg bg-accent/30 border border-accent">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Skull className="h-4 w-4 text-destructive" />
            <span className="text-sm font-medium">{monster.name}</span>
          </div>
          <Badge variant="outline" className="text-xs">
            CR {monster.cr}
          </Badge>
        </div>
        
        {/* Quick Stats Row */}
        <div className="flex gap-3 text-xs text-muted-foreground mb-2">
          <span>{MONSTER_SIZE_NAMES[monster.size]} {monsterType}</span>
          <span>•</span>
          <span>AC {acValue}</span>
          <span>•</span>
          <span>HP {hpAvg} ({hpFormula})</span>
        </div>
        
        {/* Ability Scores Row */}
        <div className="grid grid-cols-6 gap-1 text-center text-xs mb-3">
          {[
            { label: 'STR', score: monster.str },
            { label: 'DEX', score: monster.dex },
            { label: 'CON', score: monster.con },
            { label: 'INT', score: monster.int },
            { label: 'WIS', score: monster.wis },
            { label: 'CHA', score: monster.cha },
          ].map(({ label, score }) => (
            <div key={label} className="flex flex-col items-center">
              <span className="text-muted-foreground font-medium">{label}</span>
              <span className="font-mono">{score}</span>
              <span className="text-muted-foreground">({formatModifier(getAbilityModifier(score))})</span>
            </div>
          ))}
        </div>
        
        {/* Actions */}
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1"
            onClick={onViewStats}
          >
            <FileText className="h-3 w-3 mr-1" />
            View Stat Block
          </Button>
          {onUnlink && (
            <Button 
              variant="ghost" 
              size="sm"
              onClick={onUnlink}
              title="Unlink creature"
            >
              <Unlink className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
    );
  }
  
  // Render character quick stats
  const character = creature as DndBeyondCharacter;
  const classString = character.classes.map(c => `${c.name} ${c.level}`).join(' / ');
  
  return (
    <div className="p-3 rounded-lg bg-accent/30 border border-accent">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">{character.name}</span>
        </div>
        <Badge variant="outline" className="text-xs">
          Lvl {character.level}
        </Badge>
      </div>
      
      {/* Quick Stats Row */}
      <div className="flex gap-3 text-xs text-muted-foreground mb-2">
        <span>{character.race}</span>
        <span>•</span>
        <span>{classString}</span>
      </div>
      
      {/* Combat Stats Row */}
      <div className="flex gap-4 text-xs mb-2">
        <span>
          <span className="text-muted-foreground">AC</span>{' '}
          <span className="font-medium">{character.armorClass}</span>
        </span>
        <span>
          <span className="text-muted-foreground">HP</span>{' '}
          <span className="font-medium">{character.hitPoints.current}/{character.hitPoints.max}</span>
        </span>
        <span>
          <span className="text-muted-foreground">Init</span>{' '}
          <span className="font-medium">{formatModifier(character.initiative)}</span>
        </span>
      </div>
      
      {/* Ability Scores Row */}
      <div className="grid grid-cols-6 gap-1 text-center text-xs mb-3">
        {[
          { label: 'STR', ability: character.abilities.strength },
          { label: 'DEX', ability: character.abilities.dexterity },
          { label: 'CON', ability: character.abilities.constitution },
          { label: 'INT', ability: character.abilities.intelligence },
          { label: 'WIS', ability: character.abilities.wisdom },
          { label: 'CHA', ability: character.abilities.charisma },
        ].map(({ label, ability }) => (
          <div key={label} className="flex flex-col items-center">
            <span className="text-muted-foreground font-medium">{label}</span>
            <span className="font-mono">{ability.score}</span>
            <span className="text-muted-foreground">({formatModifier(ability.modifier)})</span>
          </div>
        ))}
      </div>
      
      {/* Actions */}
      <div className="flex gap-2">
        <Button 
          variant="outline" 
          size="sm" 
          className="flex-1"
          onClick={onViewStats}
        >
          <FileText className="h-3 w-3 mr-1" />
          View Character Sheet
        </Button>
        {onUnlink && (
          <Button 
            variant="ghost" 
            size="sm"
            onClick={onUnlink}
            title="Unlink creature"
          >
            <Unlink className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
}
