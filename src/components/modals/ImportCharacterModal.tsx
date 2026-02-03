import { useState, useRef, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Upload, FileJson, PenLine, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { useCreatureStore } from '@/stores/creatureStore';
import { parseDndBeyondExport } from '@/lib/dndBeyondParser';
import { getAbilityModifier, formatModifier, type DndBeyondCharacter } from '@/types/creatureTypes';

interface ImportCharacterModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const D5E_CLASSES = [
  'Artificer', 'Barbarian', 'Bard', 'Cleric', 'Druid', 
  'Fighter', 'Monk', 'Paladin', 'Ranger', 'Rogue', 
  'Sorcerer', 'Warlock', 'Wizard', 'Blood Hunter'
];

const COMMON_RACES = [
  'Human', 'Elf', 'Half-Elf', 'Dwarf', 'Halfling', 
  'Gnome', 'Half-Orc', 'Tiefling', 'Dragonborn', 'Aasimar',
  'Goliath', 'Tabaxi', 'Firbolg', 'Kenku', 'Goblin'
];

// Quick templates for common character builds
const QUICK_TEMPLATES: Array<{
  name: string;
  race: string;
  className: string;
  level: number;
  abilities: [number, number, number, number, number, number]; // STR, DEX, CON, INT, WIS, CHA
  description: string;
}> = [
  {
    name: 'Human Fighter',
    race: 'Human',
    className: 'Fighter',
    level: 1,
    abilities: [16, 14, 14, 10, 12, 10],
    description: 'A balanced melee combatant with good survivability',
  },
  {
    name: 'Elf Wizard',
    race: 'High Elf',
    className: 'Wizard',
    level: 1,
    abilities: [8, 14, 14, 16, 12, 10],
    description: 'A scholarly spellcaster with arcane mastery',
  },
  {
    name: 'Halfling Rogue',
    race: 'Lightfoot Halfling',
    className: 'Rogue',
    level: 1,
    abilities: [10, 16, 14, 12, 10, 14],
    description: 'A nimble and stealthy skill expert',
  },
  {
    name: 'Dwarf Cleric',
    race: 'Hill Dwarf',
    className: 'Cleric',
    level: 1,
    abilities: [14, 10, 16, 10, 16, 10],
    description: 'A divine healer and frontline support',
  },
];

export function ImportCharacterModal({ open, onOpenChange }: ImportCharacterModalProps) {
  const { addCharacter } = useCreatureStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [activeTab, setActiveTab] = useState<'json' | 'manual' | 'template'>('json');
  const [jsonText, setJsonText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Manual entry state
  const [manualName, setManualName] = useState('');
  const [manualRace, setManualRace] = useState('Human');
  const [manualClass, setManualClass] = useState('Fighter');
  const [manualLevel, setManualLevel] = useState(1);
  const [manualAbilities, setManualAbilities] = useState([10, 10, 10, 10, 10, 10]);
  const [manualAC, setManualAC] = useState(10);
  const [manualHP, setManualHP] = useState(10);
  const [manualSpeed, setManualSpeed] = useState(30);

  const resetForm = useCallback(() => {
    setJsonText('');
    setManualName('');
    setManualRace('Human');
    setManualClass('Fighter');
    setManualLevel(1);
    setManualAbilities([10, 10, 10, 10, 10, 10]);
    setManualAC(10);
    setManualHP(10);
    setManualSpeed(30);
  }, []);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setJsonText(text);
    };
    reader.readAsText(file);
    
    // Reset input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleJsonImport = () => {
    if (!jsonText.trim()) {
      toast.error('Please paste or upload character JSON');
      return;
    }

    setIsProcessing(true);
    
    try {
      const data = JSON.parse(jsonText);
      const result = parseDndBeyondExport(data);
      
      if (!result.success || !result.character) {
        toast.error(result.error || 'Failed to parse character data');
        return;
      }

      addCharacter(result.character);
      toast.success(`Imported ${result.character.name}!`);
      resetForm();
      onOpenChange(false);
    } catch (error) {
      console.error('JSON parse error:', error);
      toast.error('Invalid JSON format. Please check the data.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleManualCreate = () => {
    if (!manualName.trim()) {
      toast.error('Character name is required');
      return;
    }

    const proficiencyBonus = Math.ceil(manualLevel / 4) + 1;
    const dexMod = getAbilityModifier(manualAbilities[1]);

    const character: DndBeyondCharacter = {
      id: `manual-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: manualName.trim(),
      level: manualLevel,
      classes: [{ name: manualClass, level: manualLevel }],
      race: manualRace,
      abilities: {
        strength: { score: manualAbilities[0], modifier: getAbilityModifier(manualAbilities[0]) },
        dexterity: { score: manualAbilities[1], modifier: getAbilityModifier(manualAbilities[1]) },
        constitution: { score: manualAbilities[2], modifier: getAbilityModifier(manualAbilities[2]) },
        intelligence: { score: manualAbilities[3], modifier: getAbilityModifier(manualAbilities[3]) },
        wisdom: { score: manualAbilities[4], modifier: getAbilityModifier(manualAbilities[4]) },
        charisma: { score: manualAbilities[5], modifier: getAbilityModifier(manualAbilities[5]) },
      },
      armorClass: manualAC,
      hitPoints: { current: manualHP, max: manualHP, temp: 0 },
      speed: manualSpeed,
      initiative: dexMod,
      proficiencyBonus,
      skills: [],
      savingThrows: [
        { ability: 'Strength', modifier: getAbilityModifier(manualAbilities[0]), proficient: false },
        { ability: 'Dexterity', modifier: getAbilityModifier(manualAbilities[1]), proficient: false },
        { ability: 'Constitution', modifier: getAbilityModifier(manualAbilities[2]), proficient: false },
        { ability: 'Intelligence', modifier: getAbilityModifier(manualAbilities[3]), proficient: false },
        { ability: 'Wisdom', modifier: getAbilityModifier(manualAbilities[4]), proficient: false },
        { ability: 'Charisma', modifier: getAbilityModifier(manualAbilities[5]), proficient: false },
      ],
      proficiencies: { armor: [], weapons: [], tools: [], languages: ['Common'] },
      passivePerception: 10 + getAbilityModifier(manualAbilities[4]),
      features: [],
      actions: [],
      conditions: [],
      sourceUrl: '',
      lastUpdated: new Date().toISOString(),
    };

    addCharacter(character);
    toast.success(`Created ${character.name}!`);
    resetForm();
    onOpenChange(false);
  };

  const handleTemplateSelect = (template: typeof QUICK_TEMPLATES[0]) => {
    const proficiencyBonus = Math.ceil(template.level / 4) + 1;
    const dexMod = getAbilityModifier(template.abilities[1]);

    const character: DndBeyondCharacter = {
      id: `template-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: template.name,
      level: template.level,
      classes: [{ name: template.className, level: template.level }],
      race: template.race,
      abilities: {
        strength: { score: template.abilities[0], modifier: getAbilityModifier(template.abilities[0]) },
        dexterity: { score: template.abilities[1], modifier: getAbilityModifier(template.abilities[1]) },
        constitution: { score: template.abilities[2], modifier: getAbilityModifier(template.abilities[2]) },
        intelligence: { score: template.abilities[3], modifier: getAbilityModifier(template.abilities[3]) },
        wisdom: { score: template.abilities[4], modifier: getAbilityModifier(template.abilities[4]) },
        charisma: { score: template.abilities[5], modifier: getAbilityModifier(template.abilities[5]) },
      },
      armorClass: 10 + getAbilityModifier(template.abilities[1]),
      hitPoints: { current: 10, max: 10, temp: 0 },
      speed: 30,
      initiative: dexMod,
      proficiencyBonus,
      skills: [],
      savingThrows: [
        { ability: 'Strength', modifier: getAbilityModifier(template.abilities[0]), proficient: false },
        { ability: 'Dexterity', modifier: getAbilityModifier(template.abilities[1]), proficient: false },
        { ability: 'Constitution', modifier: getAbilityModifier(template.abilities[2]), proficient: false },
        { ability: 'Intelligence', modifier: getAbilityModifier(template.abilities[3]), proficient: false },
        { ability: 'Wisdom', modifier: getAbilityModifier(template.abilities[4]), proficient: false },
        { ability: 'Charisma', modifier: getAbilityModifier(template.abilities[5]), proficient: false },
      ],
      proficiencies: { armor: [], weapons: [], tools: [], languages: ['Common'] },
      passivePerception: 10 + getAbilityModifier(template.abilities[4]),
      features: [],
      actions: [],
      conditions: [],
      sourceUrl: '',
      lastUpdated: new Date().toISOString(),
    };

    addCharacter(character);
    toast.success(`Created ${character.name} from template!`);
    onOpenChange(false);
  };

  const updateAbility = (index: number, value: number) => {
    const clamped = Math.max(1, Math.min(30, value));
    setManualAbilities(prev => {
      const next = [...prev];
      next[index] = clamped;
      return next;
    });
  };

  const abilityLabels = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Import Character</DialogTitle>
          <DialogDescription>
            Add a character from D&D Beyond export, manual entry, or quick template.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="json" className="gap-1.5">
              <FileJson className="h-3.5 w-3.5" />
              JSON Import
            </TabsTrigger>
            <TabsTrigger value="manual" className="gap-1.5">
              <PenLine className="h-3.5 w-3.5" />
              Manual
            </TabsTrigger>
            <TabsTrigger value="template" className="gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              Template
            </TabsTrigger>
          </TabsList>

          {/* JSON Import Tab */}
          <TabsContent value="json" className="flex-1 flex flex-col gap-3 min-h-0">
            <div className="text-xs text-muted-foreground">
              Export your character from D&D Beyond (Character Sheet → Options → Export JSON), 
              then paste or upload the file here.
            </div>
            
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => fileInputRef.current?.click()}
                className="gap-1.5"
              >
                <Upload className="h-3.5 w-3.5" />
                Upload File
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>

            <Textarea
              placeholder="Paste D&D Beyond character JSON here..."
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              className="flex-1 min-h-[180px] font-mono text-xs resize-none"
            />

            <Button 
              onClick={handleJsonImport} 
              disabled={!jsonText.trim() || isProcessing}
              className="w-full"
            >
              {isProcessing ? 'Importing...' : 'Import Character'}
            </Button>
          </TabsContent>

          {/* Manual Entry Tab */}
          <TabsContent value="manual" className="flex-1 flex flex-col min-h-0">
            <ScrollArea className="flex-1 pr-3">
              <div className="space-y-4 pb-2">
                {/* Basic Info */}
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label htmlFor="charName" className="text-xs">Name *</Label>
                      <Input
                        id="charName"
                        value={manualName}
                        onChange={(e) => setManualName(e.target.value)}
                        placeholder="Character name"
                        className="h-8"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Race</Label>
                      <Select value={manualRace} onValueChange={setManualRace}>
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {COMMON_RACES.map(race => (
                            <SelectItem key={race} value={race}>{race}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Class</Label>
                      <Select value={manualClass} onValueChange={setManualClass}>
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {D5E_CLASSES.map(cls => (
                            <SelectItem key={cls} value={cls}>{cls}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="charLevel" className="text-xs">Level</Label>
                      <Input
                        id="charLevel"
                        type="number"
                        min={1}
                        max={20}
                        value={manualLevel}
                        onChange={(e) => setManualLevel(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
                        className="h-8"
                      />
                    </div>
                  </div>
                </div>

                {/* Ability Scores */}
                <div>
                  <Label className="text-xs font-medium">Ability Scores</Label>
                  <div className="grid grid-cols-6 gap-1.5 mt-1.5">
                    {abilityLabels.map((label, index) => (
                      <div key={label} className="text-center">
                        <div className="text-[10px] text-muted-foreground font-medium mb-0.5">{label}</div>
                        <Input
                          type="number"
                          min={1}
                          max={30}
                          value={manualAbilities[index]}
                          onChange={(e) => updateAbility(index, parseInt(e.target.value) || 10)}
                          className="h-8 text-center px-1"
                        />
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          {formatModifier(getAbilityModifier(manualAbilities[index]))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Combat Stats */}
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label htmlFor="charAC" className="text-xs">AC</Label>
                    <Input
                      id="charAC"
                      type="number"
                      min={1}
                      value={manualAC}
                      onChange={(e) => setManualAC(Math.max(1, parseInt(e.target.value) || 10))}
                      className="h-8"
                    />
                  </div>
                  <div>
                    <Label htmlFor="charHP" className="text-xs">HP</Label>
                    <Input
                      id="charHP"
                      type="number"
                      min={1}
                      value={manualHP}
                      onChange={(e) => setManualHP(Math.max(1, parseInt(e.target.value) || 10))}
                      className="h-8"
                    />
                  </div>
                  <div>
                    <Label htmlFor="charSpeed" className="text-xs">Speed</Label>
                    <Input
                      id="charSpeed"
                      type="number"
                      min={0}
                      step={5}
                      value={manualSpeed}
                      onChange={(e) => setManualSpeed(Math.max(0, parseInt(e.target.value) || 30))}
                      className="h-8"
                    />
                  </div>
                </div>
              </div>
            </ScrollArea>

            <Button onClick={handleManualCreate} className="w-full mt-3" disabled={!manualName.trim()}>
              Create Character
            </Button>
          </TabsContent>

          {/* Template Tab */}
          <TabsContent value="template" className="flex-1 min-h-0">
            <ScrollArea className="h-full">
              <div className="space-y-2 pr-2">
                {QUICK_TEMPLATES.map((template) => (
                  <button
                    key={template.name}
                    onClick={() => handleTemplateSelect(template)}
                    className="w-full p-3 rounded-md border border-border bg-card hover:bg-accent transition-colors text-left"
                  >
                    <div className="font-medium text-sm">{template.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {template.race} {template.className} {template.level}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {template.description}
                    </div>
                    <div className="flex gap-2 mt-2 text-[10px] text-muted-foreground font-mono">
                      {['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'].map((stat, i) => (
                        <span key={stat}>{stat} {template.abilities[i]}</span>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
