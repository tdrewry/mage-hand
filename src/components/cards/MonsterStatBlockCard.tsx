import { useMemo, type ReactNode } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useCreatureStore } from '@/stores/creatureStore';
import { useDiceStore } from '@/stores/diceStore';
import type { RollMetadata } from '@/lib/diceEngine';
import { useCardStore } from '@/stores/cardStore';
import { CardType } from '@/types/cardTypes';
import { 
  MONSTER_SIZE_NAMES, 
  formatModifier, 
  getAbilityModifier,
  getCRXP,
  formatSpeed,
  type Monster5eTools,
  type MonsterEntry,
  type MonsterEntryNested,
  type MonsterSpellcasting
} from '@/types/creatureTypes';

interface MonsterStatBlockCardContentProps {
  monsterId: string;
}

export function MonsterStatBlockCardContent({ monsterId }: MonsterStatBlockCardContentProps) {
  const { getMonsterById } = useCreatureStore();
  const monster = getMonsterById(monsterId);

  if (!monster) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        <p>Monster not found</p>
        <p className="text-xs mt-1">ID: {monsterId}</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <StatBlock monster={monster} />
    </ScrollArea>
  );
}

// Public export: renders any JSON blob as a stat block (best-effort)
export function StatBlockFromJson({ data }: { data: any }) {
  // Attempt to render as a Monster5eTools shape; fields default gracefully
  const monster: Monster5eTools = {
    id: data.id ?? 'unknown',
    name: data.name ?? 'Unknown',
    source: data.source ?? '',
    size: data.size ?? 'M',
    type: data.type ?? { type: 'unknown' },
    ac: Array.isArray(data.ac) ? data.ac : [{ ac: data.ac ?? 10 }],
    hp: data.hp ?? { average: 0, formula: '0' },
    speed: data.speed ?? {},
    str: data.str ?? 10,
    dex: data.dex ?? 10,
    con: data.con ?? 10,
    int: data.int ?? 10,
    wis: data.wis ?? 10,
    cha: data.cha ?? 10,
    cr: data.cr ?? '—',
    passive: data.passive ?? 10,
    ...data,
  };
  return <StatBlock monster={monster} />;
}

// Main stat block component with classic D&D styling
function StatBlock({ monster }: { monster: Monster5eTools }) {
  const monsterName = monster.name;
  const typeString = useMemo(() => {
    if (typeof monster.type === 'string') return monster.type;
    const base = monster.type?.type || 'unknown';
    const tags = monster.type?.tags?.length ? ` (${monster.type.tags.join(', ')})` : '';
    return base + tags;
  }, [monster.type]);

  const alignmentString = monster.alignment?.join(' ') || 'unaligned';
  const sizeString = MONSTER_SIZE_NAMES[monster.size] || monster.size;
  const crXP = getCRXP(monster.cr);

  return (
    <div className="stat-block p-4 font-serif">
      {/* Header - Name and Meta */}
      <div className="border-b-2 border-[hsl(var(--primary))] pb-2 mb-3">
        <h2 className="text-xl font-bold text-[hsl(var(--primary))] leading-tight">
          {monster.name}
        </h2>
        <p className="text-sm italic text-muted-foreground">
          {sizeString} {typeString}, {alignmentString}
        </p>
      </div>

      {/* Combat Stats */}
      <div className="space-y-1 text-sm mb-3">
        <StatLine label="Armor Class" value={formatAC(monster.ac)} />
        <p>
          <span className="font-bold text-[hsl(var(--primary))]">Hit Points</span>{' '}
          <span>{monster.hp.average} (</span>
          <DiceFormula formula={monster.hp.formula} display={monster.hp.formula} label={`${monsterName} HP`} source={monsterName} reason="HP" />
          <span>)</span>
        </p>
        <StatLine label="Speed" value={formatSpeed(monster.speed)} />
      </div>

      <TaperedRule />

      {/* Ability Scores */}
      <div className="grid grid-cols-6 gap-1 text-center my-3">
        <AbilityScore label="STR" score={monster.str} source={monsterName} />
        <AbilityScore label="DEX" score={monster.dex} source={monsterName} />
        <AbilityScore label="CON" score={monster.con} source={monsterName} />
        <AbilityScore label="INT" score={monster.int} source={monsterName} />
        <AbilityScore label="WIS" score={monster.wis} source={monsterName} />
        <AbilityScore label="CHA" score={monster.cha} source={monsterName} />
      </div>

      <TaperedRule />

      {/* Secondary Stats */}
      <div className="space-y-1 text-sm my-3">
        {monster.save && Object.keys(monster.save).length > 0 && (
          <RollableStatLine
            label="Saving Throws"
            source={monsterName}
            entries={Object.entries(monster.save).map(([k, v]) => ({
              name: k.charAt(0).toUpperCase() + k.slice(1),
              bonus: String(v),
              rollLabel: `${k.charAt(0).toUpperCase() + k.slice(1)} Save`,
            }))}
          />
        )}
        {monster.skill && Object.keys(monster.skill).length > 0 && (
          <RollableStatLine
            label="Skills"
            source={monsterName}
            entries={Object.entries(monster.skill).map(([k, v]) => ({
              name: capitalize(k),
              bonus: String(v),
              rollLabel: `${capitalize(k)}`,
            }))}
          />
        )}
        {monster.vulnerable && monster.vulnerable.length > 0 && (
          <StatLine label="Damage Vulnerabilities" value={formatDamageList(monster.vulnerable)} />
        )}
        {monster.resist && monster.resist.length > 0 && (
          <StatLine label="Damage Resistances" value={formatDamageList(monster.resist)} />
        )}
        {monster.immune && monster.immune.length > 0 && (
          <StatLine label="Damage Immunities" value={formatDamageList(monster.immune)} />
        )}
        {monster.conditionImmune && monster.conditionImmune.length > 0 && (
          <StatLine label="Condition Immunities" value={monster.conditionImmune.join(', ')} />
        )}
        <StatLine 
          label="Senses" 
          value={[...(monster.senses || []), `passive Perception ${monster.passive}`].join(', ')} 
        />
        <StatLine 
          label="Languages" 
          value={monster.languages?.join(', ') || '—'} 
        />
        <StatLine 
          label="Challenge" 
          value={`${monster.cr} (${crXP.toLocaleString()} XP)`} 
        />
      </div>

      <TaperedRule />

      {/* Traits */}
      {monster.trait && monster.trait.length > 0 && (
        <EntrySection entries={monster.trait} source={monsterName} />
      )}

      {/* Spellcasting */}
      {monster.spellcasting && monster.spellcasting.length > 0 && (
        <SpellcastingSection spellcasting={monster.spellcasting} />
      )}

      {/* Actions */}
      {monster.action && monster.action.length > 0 && (
        <>
          <SectionHeader>Actions</SectionHeader>
          <EntrySection entries={monster.action} source={monsterName} />
        </>
      )}

      {/* Bonus Actions */}
      {monster.bonus && monster.bonus.length > 0 && (
        <>
          <SectionHeader>Bonus Actions</SectionHeader>
          <EntrySection entries={monster.bonus} source={monsterName} />
        </>
      )}

      {/* Reactions */}
      {monster.reaction && monster.reaction.length > 0 && (
        <>
          <SectionHeader>Reactions</SectionHeader>
          <EntrySection entries={monster.reaction} source={monsterName} />
        </>
      )}

      {/* Legendary Actions */}
      {monster.legendary && monster.legendary.length > 0 && (
        <>
          <SectionHeader>Legendary Actions</SectionHeader>
          {monster.legendaryHeader && (
            <p className="text-sm mb-2 text-muted-foreground italic">
              {monster.legendaryHeader.join(' ')}
            </p>
          )}
          {!monster.legendaryHeader && (
            <p className="text-sm mb-2 text-muted-foreground italic">
              The {monster.name.toLowerCase()} can take {monster.legendaryActions || 3} legendary actions, 
              choosing from the options below. Only one legendary action option can be used at a time and 
              only at the end of another creature's turn. The {monster.name.toLowerCase()} regains spent 
              legendary actions at the start of its turn.
            </p>
          )}
          <EntrySection entries={monster.legendary} source={monsterName} />
        </>
      )}

      {/* Source */}
      <div className="mt-4 pt-2 border-t border-border">
        <p className="text-xs text-muted-foreground">
          Source: {monster.source}{monster.page ? `, p. ${monster.page}` : ''}
        </p>
      </div>
    </div>
  );
}

// Helper Components

function StatLine({ label, value }: { label: string; value: string }) {
  return (
    <p>
      <span className="font-bold text-[hsl(var(--primary))]">{label}</span>{' '}
      <span>{value}</span>
    </p>
  );
}

function RollableStatLine({ label, source, entries }: { label: string; source?: string; entries: { name: string; bonus: string; rollLabel: string }[] }) {
  return (
    <p>
      <span className="font-bold text-[hsl(var(--primary))]">{label}</span>{' '}
      {entries.map((entry, idx) => {
        const formula = `1d20${entry.bonus.startsWith('+') || entry.bonus.startsWith('-') ? '' : '+'}${entry.bonus}`;
        return (
          <span key={entry.name}>
            {idx > 0 && ', '}
            {entry.name}{' '}
            <DiceFormula formula={formula} display={entry.bonus} label={entry.rollLabel} source={source} reason={entry.rollLabel} />
          </span>
        );
      })}
    </p>
  );
}

function AbilityScore({ label, score, source }: { label: string; score: number; source?: string }) {
  const mod = getAbilityModifier(score);
  const formula = `1d20${mod >= 0 ? '+' : ''}${mod}`;
  const reason = `${label} Check`;
  return (
    <div className="flex flex-col">
      <span className="text-xs font-bold text-[hsl(var(--primary))]">{label}</span>
      <button
        type="button"
        className="text-sm hover:text-[hsl(var(--primary))] cursor-pointer transition-colors"
        onClick={() => rollInDiceBox(formula, reason, source ? { source, reason } : undefined)}
        title={`Roll ${formula}`}
      >
        {score} ({formatModifier(mod)})
      </button>
    </div>
  );
}

function TaperedRule() {
  return (
    <div className="h-[2px] bg-gradient-to-r from-transparent via-[hsl(var(--primary)/0.5)] to-transparent my-2" />
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-base font-bold text-[hsl(var(--primary))] border-b border-[hsl(var(--primary))] mt-4 mb-2">
      {children}
    </h3>
  );
}

function EntrySection({ entries, source }: { entries: MonsterEntry[]; source?: string }) {
  return (
    <div className="space-y-2 text-sm">
      {entries.map((entry, idx) => (
        <div key={idx}>
          <p>
            <span className="font-bold italic">{entry.name}.</span>{' '}
            {formatEntries(entry.entries, source, entry.name)}
          </p>
        </div>
      ))}
    </div>
  );
}

function SpellcastingSection({ spellcasting }: { spellcasting: MonsterSpellcasting[] }) {
  return (
    <div className="space-y-3 text-sm">
      {spellcasting.map((sc, idx) => (
        <div key={idx}>
          <p>
            <span className="font-bold italic">{sc.name}.</span>{' '}
            {sc.headerEntries && formatEntries(sc.headerEntries)}
          </p>
          
          {sc.will && sc.will.length > 0 && (
            <p className="ml-4">
              <span className="italic">At will:</span> {sc.will.join(', ')}
            </p>
          )}
          
          {sc.daily && Object.entries(sc.daily).map(([uses, spells]) => (
            <p key={uses} className="ml-4">
              <span className="italic">{formatDailyUses(uses)}:</span> {spells.join(', ')}
            </p>
          ))}
          
          {sc.spells && Object.entries(sc.spells).map(([level, data]) => (
            <p key={level} className="ml-4">
              <span className="italic">{formatSpellLevel(level, data.slots)}:</span>{' '}
              {data.spells.join(', ')}
            </p>
          ))}
          
          {sc.footerEntries && (
            <p className="mt-1">{formatEntries(sc.footerEntries)}</p>
          )}
        </div>
      ))}
    </div>
  );
}

// Formatting Helpers

function formatAC(ac: Monster5eTools['ac']): string {
  return ac.map(a => {
    let str = String(a.ac);
    if (a.from?.length) str += ` (${a.from.join(', ')})`;
    if (a.condition) str += ` ${a.condition}`;
    return str;
  }).join(', ');
}

function formatDamageList(list: string[]): string {
  // Handle complex damage type entries (objects with special conditions)
  return list.map(item => {
    if (typeof item === 'object') {
      const obj = item as any;
      if (obj.special) return obj.special;
      if (obj.resist) return `${obj.resist.join(', ')} ${obj.note || ''}`.trim();
      return JSON.stringify(item);
    }
    return item;
  }).join('; ');
}

function formatEntries(entries: (string | MonsterEntryNested)[], source?: string, actionName?: string): ReactNode {
  return entries.map((entry, idx) => {
    if (typeof entry === 'string') {
      return <span key={idx}>{cleanEntryText(entry, source, actionName)}{idx < entries.length - 1 ? ' ' : ''}</span>;
    }
    if (entry.type === 'list' && entry.items) {
      return <span key={idx}>{entry.items.map(i => `• ${i}`).join(' ')}{idx < entries.length - 1 ? ' ' : ''}</span>;
    }
    if (entry.entries) {
      return <span key={idx}>{entry.entries.join(' ')}{idx < entries.length - 1 ? ' ' : ''}</span>;
    }
    return null;
  });
}

/** Rolls a formula and opens/focuses the Dice Box card */
function rollInDiceBox(formula: string, label?: string, meta?: RollMetadata) {
  const { roll } = useDiceStore.getState();
  const cardStore = useCardStore.getState();
  
  // Ensure Dice Box is open — register it if it doesn't exist yet
  let diceCard = cardStore.getCardByType(CardType.DICE_BOX);
  if (!diceCard) {
    const newId = cardStore.registerCard({
      type: CardType.DICE_BOX,
      title: 'Dice Box',
      defaultPosition: { x: 345, y: 80 },
      defaultSize: { width: 350, height: 500 },
    });
    diceCard = cardStore.getCard(newId) ?? undefined;
  }
  if (diceCard) {
    cardStore.setVisibility(diceCard.id, true);
    cardStore.bringToFront(diceCard.id);
  }
  
  roll(formula, label, meta);
}

/** Clickable dice formula span */
function DiceFormula({ formula, display, label, source, reason }: { formula: string; display: string; label?: string; source?: string; reason?: string }) {
  const meta: RollMetadata | undefined = source ? { source, reason: reason || label } : undefined;
  return (
    <button
      type="button"
      className="inline font-mono text-[hsl(var(--primary))] hover:text-[hsl(var(--primary)/0.7)] underline decoration-dotted underline-offset-2 cursor-pointer transition-colors"
      onClick={(e) => { e.stopPropagation(); rollInDiceBox(formula, label, meta); }}
      title={`Roll ${formula}`}
    >
      {display}
    </button>
  );
}

function cleanEntryText(text: string, source?: string, actionName?: string): ReactNode {
  // Regex to find all rollable tags: {@damage X}, {@hit X}, {@dice X}, {@skill X}
  const rollableRegex = /\{@(damage|hit|dice|skill|recharge) ?([^}]*)\}/g;
  // Non-rollable tags cleaned to plain text
  const cleanNonRollable = (s: string) => s
    .replace(/\{@creature ([^}|]+)(\|[^}]*)?\}/g, '$1')
    .replace(/\{@spell ([^}|]+)(\|[^}]*)?\}/g, '$1')
    .replace(/\{@item ([^}|]+)(\|[^}]*)?\}/g, '$1')
    .replace(/\{@condition ([^}|]+)(\|[^}]*)?\}/g, '$1')
    .replace(/\{@action ([^}|]+)(\|[^}]*)?\}/g, '$1')
    .replace(/\{@sense ([^}|]+)(\|[^}]*)?\}/g, '$1')
    .replace(/\{@dc ([^}]+)\}/g, 'DC $1')
    .replace(/\{@atk ([^}]+)\}/g, (_, type) => {
      if (type.includes('m')) return 'Melee';
      if (type.includes('r')) return 'Ranged';
      return type;
    })
    .replace(/\{@h\}/g, '')
    .replace(/\{@b ([^}]+)\}/g, '$1')
    .replace(/\{@i ([^}]+)\}/g, '$1');

  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = rollableRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(cleanNonRollable(text.slice(lastIndex, match.index)));
    }

    const tagType = match[1];
    const rawValue = match[2].trim();

    if (tagType === 'hit') {
      const formula = `1d20+${rawValue}`;
      const reason = actionName ? `${actionName} Attack` : 'Attack Roll';
      parts.push(<DiceFormula key={match.index} formula={formula} display={`+${rawValue}`} label={reason} source={source} reason={reason} />);
    } else if (tagType === 'skill') {
      parts.push(<span key={match.index}>{rawValue}</span>);
    } else if (tagType === 'recharge') {
      const num = rawValue ? rawValue.trim() : '6';
      const display = `(Recharge ${num}${num !== '6' ? '–6' : ''})`;
      const reason = actionName ? `${actionName} Recharge` : `Recharge (${num}+)`;
      parts.push(
        <DiceFormula key={match.index} formula="1d6" display={display} label={reason} source={source} reason={reason} />
      );
    } else {
      const reason = tagType === 'damage' ? (actionName ? `${actionName} Damage` : 'Damage') : actionName;
      parts.push(<DiceFormula key={match.index} formula={rawValue} display={rawValue} label={reason} source={source} reason={reason} />);
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(cleanNonRollable(text.slice(lastIndex)));
  }

  return parts.length === 1 ? parts[0] : <>{parts}</>;
}

function formatDailyUses(uses: string): string {
  const num = uses.replace('e', '');
  const each = uses.includes('e') ? ' each' : '';
  return `${num}/day${each}`;
}

function formatSpellLevel(level: string, slots?: number): string {
  if (level === '0') return 'Cantrips (at will)';
  const ordinal = getOrdinal(parseInt(level));
  const slotsStr = slots ? ` (${slots} slot${slots > 1 ? 's' : ''})` : '';
  return `${ordinal} level${slotsStr}`;
}

function getOrdinal(n: number): string {
  if (n === 1) return '1st';
  if (n === 2) return '2nd';
  if (n === 3) return '3rd';
  return `${n}th`;
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
