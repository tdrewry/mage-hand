import { useState, useMemo } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  Heart,
  Shield,
  Zap,
  Target,
  BookOpen,
  Swords,
  Sparkles,
  User,
  ExternalLink,
  RefreshCw
} from 'lucide-react';
import { useCreatureStore } from '@/stores/creatureStore';
import { useSessionStore, type LabelPosition } from '@/stores/sessionStore';
import { useMapStore } from '@/stores/mapStore';
import { 
  formatModifier,
  type DndBeyondCharacter
} from '@/types/creatureTypes';
import { toast } from 'sonner';

interface CharacterSheetCardContentProps {
  characterId: string;
}

// Color palette for tokens without images
const TOKEN_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
  '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
];

const getRandomTokenColor = () => TOKEN_COLORS[Math.floor(Math.random() * TOKEN_COLORS.length)];

export function CharacterSheetCardContent({ characterId }: CharacterSheetCardContentProps) {
  const { getCharacterById } = useCreatureStore();
  const character = getCharacterById(characterId);

  if (!character) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        <p>Character not found</p>
        <p className="text-xs mt-1">ID: {characterId}</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <CharacterSheet character={character} />
    </ScrollArea>
  );
}

function CharacterSheet({ character }: { character: DndBeyondCharacter }) {
  const [activeTab, setActiveTab] = useState('stats');
  const { addToken, getViewportTransform } = useSessionStore();
  const { selectedMapId } = useMapStore();

  const classString = character.classes.map(c => `${c.name} ${c.level}`).join(' / ');
  const hpPercentage = character.hitPoints.max > 0 
    ? (character.hitPoints.current / character.hitPoints.max) * 100 
    : 0;

  const getViewportCenter = () => {
    const transform = selectedMapId ? getViewportTransform(selectedMapId) : { x: 0, y: 0, zoom: 1 };
    const worldX = (window.innerWidth / 2 - transform.x) / transform.zoom;
    const worldY = (window.innerHeight / 2 - transform.y) / transform.zoom;
    return { x: worldX, y: worldY };
  };

  const handleCreateToken = async () => {
    const tokenId = `token-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const center = getViewportCenter();
    
    let imageUrl = '';
    if (character.portraitUrl) {
      try {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Timeout')), 5000);
          img.onload = () => { clearTimeout(timeout); resolve(); };
          img.onerror = () => { clearTimeout(timeout); reject(); };
          img.src = character.portraitUrl!;
        });
        imageUrl = character.portraitUrl;
      } catch {
        console.warn(`Could not load portrait for ${character.name}`);
      }
    }

    const tokenColor = imageUrl ? undefined : getRandomTokenColor();

    addToken({
      id: tokenId,
      name: character.name,
      imageUrl,
      x: center.x,
      y: center.y,
      gridWidth: 1,
      gridHeight: 1,
      label: character.name,
      labelPosition: 'below' as LabelPosition,
      roleId: 'player',
      isHidden: false,
      color: tokenColor,
      entityRef: {
        type: 'local',
        entityId: character.id,
        projectionType: 'character',
      },
    });
    
    toast.success(`Created ${character.name} token`);
  };

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        {character.portraitUrl ? (
          <img 
            src={character.portraitUrl} 
            alt={character.name}
            className="w-16 h-16 rounded-full object-cover border-2 border-primary"
          />
        ) : (
          <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
            <User className="w-8 h-8 text-primary" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold truncate">{character.name}</h2>
          <p className="text-sm text-muted-foreground">
            Level {character.level} {character.race}
          </p>
          <p className="text-sm text-muted-foreground truncate">{classString}</p>
        </div>
      </div>

      {/* Quick Stats Bar */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <QuickStat 
          icon={<Shield className="w-4 h-4" />} 
          label="AC" 
          value={character.armorClass} 
        />
        <QuickStat 
          icon={<Zap className="w-4 h-4" />} 
          label="Init" 
          value={formatModifier(character.initiative)} 
        />
        <QuickStat 
          icon={<Target className="w-4 h-4" />} 
          label="Prof" 
          value={formatModifier(character.proficiencyBonus)} 
        />
      </div>

      {/* HP Bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-1">
            <Heart className="w-4 h-4 text-red-500" />
            Hit Points
          </span>
          <span className="font-medium">
            {character.hitPoints.current} / {character.hitPoints.max}
            {character.hitPoints.temp > 0 && (
              <span className="text-blue-400 ml-1">(+{character.hitPoints.temp})</span>
            )}
          </span>
        </div>
        <Progress 
          value={hpPercentage} 
          className="h-2"
        />
      </div>

      {/* Speed */}
      <div className="text-sm">
        <span className="text-muted-foreground">Speed:</span>{' '}
        <span className="font-medium">{character.speed} ft.</span>
      </div>

      <Separator />

      {/* Ability Scores */}
      <div className="grid grid-cols-6 gap-1 text-center">
        <AbilityScore label="STR" score={character.abilities.strength.score} modifier={character.abilities.strength.modifier} />
        <AbilityScore label="DEX" score={character.abilities.dexterity.score} modifier={character.abilities.dexterity.modifier} />
        <AbilityScore label="CON" score={character.abilities.constitution.score} modifier={character.abilities.constitution.modifier} />
        <AbilityScore label="INT" score={character.abilities.intelligence.score} modifier={character.abilities.intelligence.modifier} />
        <AbilityScore label="WIS" score={character.abilities.wisdom.score} modifier={character.abilities.wisdom.modifier} />
        <AbilityScore label="CHA" score={character.abilities.charisma.score} modifier={character.abilities.charisma.modifier} />
      </div>

      <Separator />

      {/* Tabbed Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full grid grid-cols-4">
          <TabsTrigger value="stats" className="text-xs">
            <BookOpen className="w-3 h-3 mr-1" />
            Skills
          </TabsTrigger>
          <TabsTrigger value="features" className="text-xs">
            <Sparkles className="w-3 h-3 mr-1" />
            Features
          </TabsTrigger>
          <TabsTrigger value="actions" className="text-xs">
            <Swords className="w-3 h-3 mr-1" />
            Actions
          </TabsTrigger>
          <TabsTrigger value="spells" className="text-xs">
            ✨ Spells
          </TabsTrigger>
        </TabsList>

        <TabsContent value="stats" className="mt-3 space-y-3">
          {/* Saving Throws */}
          <div>
            <h4 className="text-sm font-semibold mb-2">Saving Throws</h4>
            <div className="grid grid-cols-2 gap-1 text-sm">
              {character.savingThrows.map((save) => (
                <div 
                  key={save.ability} 
                  className={`flex justify-between px-2 py-1 rounded ${save.proficient ? 'bg-primary/10' : ''}`}
                >
                  <span className={save.proficient ? 'font-medium' : 'text-muted-foreground'}>
                    {save.ability}
                  </span>
                  <span className={save.proficient ? 'font-bold' : ''}>
                    {formatModifier(save.modifier)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Skills */}
          <div>
            <h4 className="text-sm font-semibold mb-2">Skills</h4>
            <div className="space-y-0.5 text-sm max-h-48 overflow-y-auto">
              {character.skills.map((skill) => (
                <div 
                  key={skill.name} 
                  className={`flex justify-between px-2 py-0.5 rounded ${skill.proficient ? 'bg-primary/10' : ''}`}
                >
                  <span className={skill.proficient ? 'font-medium' : 'text-muted-foreground'}>
                    {skill.name}
                    {skill.expertise && <span className="text-primary ml-1">★</span>}
                  </span>
                  <span className={skill.proficient ? 'font-bold' : ''}>
                    {formatModifier(skill.modifier)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Passive Senses */}
          <div>
            <h4 className="text-sm font-semibold mb-2">Passive Senses</h4>
            <div className="grid grid-cols-1 gap-1 text-sm">
              <div className="flex justify-between px-2">
                <span>Passive Perception</span>
                <span className="font-medium">{character.passivePerception}</span>
              </div>
              {character.passiveInvestigation && (
                <div className="flex justify-between px-2">
                  <span>Passive Investigation</span>
                  <span className="font-medium">{character.passiveInvestigation}</span>
                </div>
              )}
              {character.passiveInsight && (
                <div className="flex justify-between px-2">
                  <span>Passive Insight</span>
                  <span className="font-medium">{character.passiveInsight}</span>
                </div>
              )}
            </div>
          </div>

          {/* Proficiencies */}
          <div>
            <h4 className="text-sm font-semibold mb-2">Proficiencies</h4>
            <div className="space-y-2 text-sm">
              {character.proficiencies.languages.length > 0 && (
                <div>
                  <span className="text-muted-foreground">Languages: </span>
                  {character.proficiencies.languages.join(', ')}
                </div>
              )}
              {character.proficiencies.armor.length > 0 && (
                <div>
                  <span className="text-muted-foreground">Armor: </span>
                  {character.proficiencies.armor.join(', ')}
                </div>
              )}
              {character.proficiencies.weapons.length > 0 && (
                <div>
                  <span className="text-muted-foreground">Weapons: </span>
                  {character.proficiencies.weapons.join(', ')}
                </div>
              )}
              {character.proficiencies.tools.length > 0 && (
                <div>
                  <span className="text-muted-foreground">Tools: </span>
                  {character.proficiencies.tools.join(', ')}
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="features" className="mt-3">
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {character.features.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No features available
              </p>
            ) : (
              character.features.map((feature, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h5 className="text-sm font-semibold">{feature.name}</h5>
                    <Badge variant="outline" className="text-xs">
                      {feature.source}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{feature.description}</p>
                </div>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="actions" className="mt-3">
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {character.actions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No actions available
              </p>
            ) : (
              character.actions.map((action, idx) => (
                <div key={idx} className="p-2 bg-secondary/30 rounded space-y-1">
                  <div className="flex items-center justify-between">
                    <h5 className="text-sm font-semibold">{action.name}</h5>
                    {action.attackBonus !== undefined && (
                      <Badge variant="secondary">
                        {formatModifier(action.attackBonus)} to hit
                      </Badge>
                    )}
                  </div>
                  {action.damage && (
                    <div className="text-xs">
                      <span className="text-muted-foreground">Damage: </span>
                      <span className="font-medium">{action.damage}</span>
                      {action.damageType && (
                        <span className="text-muted-foreground"> {action.damageType}</span>
                      )}
                    </div>
                  )}
                  {action.range && (
                    <div className="text-xs">
                      <span className="text-muted-foreground">Range: </span>
                      <span>{action.range}</span>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">{action.description}</p>
                </div>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="spells" className="mt-3">
          {!character.spells ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              This character has no spellcasting abilities
            </p>
          ) : (
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {/* Spellcasting Info */}
              <div className="grid grid-cols-3 gap-2 text-center text-sm">
                {character.spells.spellcastingAbility && (
                  <div className="p-2 bg-secondary/30 rounded">
                    <div className="text-xs text-muted-foreground">Ability</div>
                    <div className="font-medium">{character.spells.spellcastingAbility}</div>
                  </div>
                )}
                {character.spells.spellSaveDC !== undefined && (
                  <div className="p-2 bg-secondary/30 rounded">
                    <div className="text-xs text-muted-foreground">Save DC</div>
                    <div className="font-medium">{character.spells.spellSaveDC}</div>
                  </div>
                )}
                {character.spells.spellAttackBonus !== undefined && (
                  <div className="p-2 bg-secondary/30 rounded">
                    <div className="text-xs text-muted-foreground">Attack</div>
                    <div className="font-medium">{formatModifier(character.spells.spellAttackBonus)}</div>
                  </div>
                )}
              </div>

              {/* Cantrips */}
              {character.spells.cantrips.length > 0 && (
                <div>
                  <h5 className="text-sm font-semibold mb-1">Cantrips</h5>
                  <div className="flex flex-wrap gap-1">
                    {character.spells.cantrips.map((spell, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {spell.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Spells by Level */}
              {character.spells.spellsByLevel.map((level) => (
                <div key={level.level}>
                  <div className="flex items-center justify-between mb-1">
                    <h5 className="text-sm font-semibold">
                      {level.level === 0 ? 'Cantrips' : `Level ${level.level}`}
                    </h5>
                    {level.slots > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {level.slots - level.slotsUsed}/{level.slots} slots
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {level.spells.map((spell, idx) => (
                      <Badge 
                        key={idx} 
                        variant={spell.prepared ? 'default' : 'outline'}
                        className="text-xs"
                      >
                        {spell.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Conditions */}
      {character.conditions.length > 0 && (
        <>
          <Separator />
          <div>
            <h4 className="text-sm font-semibold mb-2">Conditions</h4>
            <div className="flex flex-wrap gap-1">
              {character.conditions.map((condition, idx) => (
                <Badge key={idx} variant="destructive" className="text-xs">
                  {condition}
                </Badge>
              ))}
            </div>
          </div>
        </>
      )}

      <Separator />

      {/* Actions */}
      <div className="flex gap-2">
        <Button size="sm" onClick={handleCreateToken} className="flex-1">
          <Target className="w-4 h-4 mr-1" />
          Create Token
        </Button>
        {character.sourceUrl && (
          <Button 
            size="sm" 
            variant="outline"
            onClick={() => window.open(character.sourceUrl, '_blank')}
          >
            <ExternalLink className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Source info */}
      <p className="text-xs text-muted-foreground text-center">
        Last updated: {new Date(character.lastUpdated).toLocaleDateString()}
      </p>
    </div>
  );
}

// Helper Components

function QuickStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="p-2 bg-secondary/30 rounded flex flex-col items-center">
      <div className="flex items-center gap-1 text-muted-foreground text-xs">
        {icon}
        {label}
      </div>
      <div className="text-lg font-bold">{value}</div>
    </div>
  );
}

function AbilityScore({ label, score, modifier }: { label: string; score: number; modifier: number }) {
  return (
    <div className="flex flex-col p-1 bg-secondary/20 rounded">
      <span className="text-xs font-bold text-primary">{label}</span>
      <span className="text-sm font-medium">{score}</span>
      <span className="text-xs text-muted-foreground">({formatModifier(modifier)})</span>
    </div>
  );
}
