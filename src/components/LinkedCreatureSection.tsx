import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Database, FileText, Unlink, Skull, Users } from 'lucide-react';
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
}

export function LinkedCreatureSection({ token, onViewStats, onUnlink }: LinkedCreatureSectionProps) {
  const { getCreatureById, getCreatureType } = useCreatureStore();
  
  const linkedCreatureId = token?.entityRef?.entityId;
  const creature = linkedCreatureId ? getCreatureById(linkedCreatureId) : undefined;
  const creatureType = linkedCreatureId ? getCreatureType(linkedCreatureId) : undefined;
  
  // No linked creature - show placeholder
  if (!creature || !creatureType) {
    return (
      <div className="p-3 rounded-lg bg-muted/50 border border-dashed border-muted-foreground/30">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Database className="h-4 w-4" />
          <span className="text-sm font-medium">No Linked Creature</span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Create tokens from the Creature Library to automatically link creature data.
        </p>
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
