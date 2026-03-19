# STEP-009 — Generic Token / Character Sheet Data Model

## Overview

The current `Token` type has a fixed 5e-centric character sheet model. This plan designs a **system-agnostic, extensible schema** for token metadata that:

1. Maps cleanly to D&D 5e, Pathfinder, Lancer, Call of Cthulhu, and homebrew systems
2. Supports both full **Character Sheets** (for player characters) and compact **Stat Blocks** (for monsters/NPCs)
3. Provides a **template system** for custom UI layouts per game system
4. Defines an **Action Formula Language** for encoding interactive mechanics

This is the foundational design work. Implementation follows in phases.

---

## Generic Entity Schema

All sections are optional. A minimal token may have only `description.name` and position data.

```ts
interface EntitySheet {
  version: 1;

  // ── Description ─────────────────────────────────────────────────────
  description: {
    name: string;
    species?: string;
    background?: string;
    alignment?: string;
    levels?: Array<{ class: string; level: number }>;
    appearance?: string;        // Freeform text
    notes?: string;
    // Arbitrary flavor fields (game-system custom)
    custom?: Record<string, string | number>;
  };

  // ── Defenses ────────────────────────────────────────────────────────
  defenses: {
    armorClass?: ModifiableValue;
    hitPoints?: {
      max: number;
      current: number;
      temporary: number;
    };
    savingThrows?: Record<string, ModifiableValue>;
    resistances?: string[];     // e.g. ["fire", "slashing"]
    immunities?: string[];
    vulnerabilities?: string[];
  };

  // ── Ability Scores ───────────────────────────────────────────────────
  abilityScores?: Record<string, ModifiableValue>;
  // e.g. { str: { base: 18, modifiers: [{source: "Belt of Giant Strength", value: 6}] } }

  // ── Speeds ──────────────────────────────────────────────────────────
  speeds?: Record<string, number>;
  // e.g. { walk: 30, fly: 60, swim: 30, burrow: 0 }

  // ── Actions ─────────────────────────────────────────────────────────
  actions?: EntityAction[];

  // ── Features & Traits ───────────────────────────────────────────────
  // Merged into one array; featureType discriminates for UI section headers.
  // Features = class/species/background-derived; Traits = user-added flavor.
  features?: EntityFeature[];

  // ── Spellcasting ────────────────────────────────────────────────────
  spellcasting?: SpellcastingBlock[];

  // ── Conditions ──────────────────────────────────────────────────────
  conditions?: EntityCondition[];

  // ── Inventory ───────────────────────────────────────────────────────
  inventory?: InventoryEntry[];

  // ── Companions ──────────────────────────────────────────────────────
  companions?: CompanionRef[];
}
```

---

## Supporting Types

### ModifiableValue
```ts
interface ModifiableValue {
  base: number;
  modifiers?: Array<{
    source: string;    // "Bless spell", "Ring of Protection"
    value: number;
    expires?: string;  // ISO duration or "permanent"
  }>;
  // Computed: base + sum(modifiers)
}
```

### EntityAction
```ts
interface EntityAction {
  id: string;
  name: string;
  actionType: 'action' | 'bonus_action' | 'reaction' | 'free' | 'legendary' | 'lair';
  description?: string;
  formula?: ActionFormula; // See below
  tags?: string[];        // e.g. ["melee", "weapon", "slashing"]
  requiresItem?: string;  // Item ID from inventory
}
```

### Formula Engine: Peggy DSL + Secure AST Interpreter

**Decision:** Peggy (PEG.js successor) compiles a grammar file at build time into a self-contained parser module. The evaluator is a pure AST walker with zero `eval` / `Function` calls. Works fully offline.

#### DSL Syntax

| Element | Syntax | Example |
|---|---|---|
| Dice | `NdX` | `2d6`, `1d20`, `d4` |
| Keep highest/lowest | `NdXkh/klM` | `4d6kh3` |
| Drop highest/lowest | `NdXdh/dlM` | `4d6dl1` |
| Property ref | `{dot.path}` | `{str.modifier}`, `{proficiency}` |
| Card draw | `draw(deck_id [, N])` | `draw(standard)`, `draw(tarot_major, 2)` |
| Math | `+ - * / % ^` | `2d6 * 2` |
| Functions | `min() max() floor() ceil() abs() round()` | `max(1, 1d6 + {str.modifier})` |
| Conditionals | `if(cond, then, else)` | `if({has_advantage}, max(1d20, 1d20), 1d20)` |
| Comparisons | `= != < <= > >=` | `{target.ac} >= 15` |

#### Example Formulas
```
# Longsword attack roll
1d20 + {str.modifier} + {proficiency}

# Longsword damage (on hit)
1d10 + {str.modifier}

# Advantage (roll twice, take higher)
max(1d20, 1d20) + {str.modifier} + {proficiency}

# Ability check with card draw as RNG
draw(standard) + {wis.modifier}

# Savage-style exploding die (simplified)
max(1d8, 1d6) + {str.modifier}

# Save DC
8 + {proficiency} + {wis.modifier}
```

#### Card Draws as RNG Source
Deck state is a Jazz CoValue owned by the primary DM client:
```ts
interface Deck {
  id: string;               // e.g. "standard", "tarot_major", "session_custom"
  cards: Card[];            // Shuffled order (synced via Jazz)
  drawnCount: number;       // Pointer into cards[]
  reset(): void;            // Reshuffle — host-initiated
}
interface Card {
  value: number;            // Numeric for algebra (K=13, Q=12, J=11, A=1|14)
  label: string;            // "King of Hearts"
  suit?: string;
  face?: string;
}
```
`draw(standard)` returns `card.value` for immediate use in algebra.

#### Project Layout
```
src/lib/formulaEngine/
  grammar.peggy      ← DSL grammar (~150 lines, compiled at build time)
  parser.ts          ← Generated parser wrapper
  evaluator.ts       ← Secure AST walker, no eval
  decks.ts           ← Deck/card state, shuffle, draw
  context.ts         ← PropertyContext builder (DM-full vs player-filtered)
  types.ts           ← ASTNode, PropertyContext, RNGSource, RollRecord
```

---

#### Evaluation Authority Model

The client with the **fullest valid context** evaluates the formula. Routing at invocation time:

```
1. Local client has DM role          → evaluate locally
2. A DM client is connected          → route to primary DM (first to claim)
3. No DM connected, host connected   → route to host (partial context, flagged)
4. Fully offline / solo              → evaluate locally with available context
```

**Multi-DM claim protocol** (prevents race conditions):
```ts
// Initiating client broadcasts:
{ kind: 'formula_eval_request', requestId, formula, contextSnapshot }

// First DM to respond claims it:
{ kind: 'formula_claim', requestId, claimedByClientId }

// Claiming DM evaluates and broadcasts result:
{ kind: 'formula_result', requestId, ...rollRecord }
```

**Roll audit trail — broadcast on every evaluation:**
```ts
interface RollRecord {
  requestId: string;
  formulaText: string;        // Human-readable
  ast: ASTNode;               // Full AST for re-evaluation
  contextSnapshot: Record<string, number>; // Property values used
  diceValues: Array<{ notation: string; results: number[] }>;
  finalResult: number;
  evaluatedBy: string;        // clientId
  timestamp: number;
}
```
Any DM can recompute `finalResult` from `contextSnapshot + diceValues` to verify independently.

**Property context access control:**
- DM context: full access to all entity properties
- Player context: owns their own tokens; visible-to-player fields on others
- Formulas referencing inaccessible properties return `null` → formula is flagged as requiring DM evaluation

---

### ActionFormula (on EntityAction)

Stores the formula strings used at evaluation time:

```ts
interface ActionFormula {
  // Roll to hit / succeed
  attack?: {
    roll: string;     // e.g. "1d20 + {str.modifier} + {proficiency}"
    versus: string;   // e.g. "target.defenses.armorClass.computed"
  };
  // Effect on success
  effect?: {
    apply: string;    // e.g. "target.defenses.hitPoints.current"
    value: string;    // e.g. "-(1d10 + {str.modifier})"
    damageType?: string;
    halfOnSave?: string;
  };
  // Conditions applied
  conditions?: Array<{
    apply: EntityCondition;
    duration: string;
    saves?: string;
    saveDC?: string;
  }>;
}
```

**Example — Longsword Attack:**
```ts
{
  attack: {
    roll: "1d20 + {str.modifier} + {proficiency}",
    versus: "target.defenses.armorClass.computed"
  },
  effect: {
    apply: "target.defenses.hitPoints.current",
    value: "-(1d10 + {str.modifier})",
    damageType: "slashing"
  }
}
```

### SpellcastingBlock
```ts
interface SpellcastingBlock {
  ability: string;       // "int", "wis", "cha"
  saveDC?: number;       // Usually computed: 8 + proficiency + ability.modifier
  attackBonus?: number;
  slots?: Record<number, { max: number; current: number }>; // level → slots
  knownSpells?: string[];   // Spell IDs from compendium
  preparedSpells?: string[];
  innateSpells?: Array<{ spellId: string; frequency: string }>; // "at_will", "1/day"
}
```

### EntityCondition
```ts
interface EntityCondition {
  id: string;
  name: string;
  description?: string;
  duration?: string;       // "permanent", ISO 8601 duration, "until_dispelled"
  roundsRemaining?: number;
  // Mechanical impacts (optional)
  impacts?: Array<{
    target: string;        // e.g. "defenses.armorClass.modifiers"
    value: string | number; // e.g. -2
    source: string;        // e.g. "Frightened"
  }>;
}
```

### InventoryEntry
```ts
interface InventoryEntry {
  id: string;
  name: string;
  quantity: number;
  equipped?: boolean;
  // Optional refs
  itemRefId?: string;     // Links to a CanvasItem on map (STEP-007)
  // If container:
  isContainer?: boolean;
  contents?: InventoryEntry[];
}
```

### CompanionRef
```ts
interface CompanionRef {
  id: string;
  name: string;
  sourceTokenId?: string;   // Existing token on map
  // Or spawn data for summoning:
  spawnData?: Partial<Token>;
  relationship: 'familiar' | 'mount' | 'pet' | 'companion' | 'summon';
}
```

---

## UI Template System

Different game systems need different sheet layouts. A **SheetTemplate** defines which sections to show, their order, and any system-specific label overrides.

```ts
interface SheetTemplate {
  id: string;
  name: string;              // "D&D 5e Character", "5e Monster Stat Block", "Lancer Mech"
  sections: SheetSection[];
  labelOverrides?: Record<string, string>;  // e.g. "abilityScores.str" → "Strength"
}

interface SheetSection {
  key: keyof EntitySheet;
  label: string;
  layout: 'compact' | 'full' | 'grid' | 'list';
  visible: boolean;
  order: number;
}
```

Built-in templates at launch:
- `dnd5e-character` — Full character sheet layout
- `dnd5e-statblock` — Compact stat block (monster) layout
- `generic-token` — Minimal: name, HP, AC only

---

## Migration from Current Token Type

Current `Token` fields → mapped to `EntitySheet`:
```
token.name           → description.name
token.hp             → defenses.hitPoints.current
token.ac             → defenses.armorClass.base
token.initiative     → (tracked externally, not in EntitySheet)
token.roleId         → (remains separate — permissions, not creature data)
token.illuminationSources → (remains on Token root, not EntitySheet)
```

`EntitySheet` is stored as a JSON blob field on `Token`:
```ts
interface Token {
  // ... existing fields ...
  entitySheet?: EntitySheet;  // null/undefined for tokens with no sheet
}
```

This is backward-compatible. Tokens without a sheet still work. Sheets are additive.

---

## Outstanding Questions for User Review

1. **Stat Block vs. Character Sheet split:** Should we have ONE generic `EntitySheet` type that works for both, or TWO types (`StatBlock` for monsters, `CharacterSheet` for PCs) with different required fields? Unified is simpler to maintain; split is more type-safe.

2. ~~**Action Formula evaluation:**~~ ✅ **RESOLVED** — Peggy DSL + AST interpreter. Evaluation authority: DM-role client with fullest context, multi-DM claim protocol, offline falls back to local eval. Card draws are a first-class RNG source alongside dice. Full roll audit trail broadcast on every evaluation.

3. **Template persistence:** Should sheet templates be stored per-session (synced via Jazz), per-user (local), or globally (shipped with the app)? Recommend: built-in templates ship with app; custom templates store per-session.

4. **Importing existing 5e stat blocks:** We already have a 5e.tools JSON importer. Should we write a mapper `Monster5eTools → EntitySheet` as part of this plan, or as a follow-on to STEP-008?

5. ~~**Features vs. Traits:**~~ ✅ **RESOLVED** — Merged into single `features: EntityFeature[]` array. `EntityFeature` gains `featureType: 'feature' | 'trait'` (convention-only) and `source?: string` (e.g. `"Half-Orc"`, `"Fighter 5"`, `"User-defined"`) to preserve authorial intent without splitting the schema.

6. **Conditions UI:** When a condition has mechanical impacts (e.g., Frightened = disadvantage on ability checks), should the UI show these impacts as a formatted list, or just the description text with the impacts stored but not displayed to players?

7. **Performance:** A fully-populated `EntitySheet` for a complex character could be 5–20KB. With many tokens on the map, this could be significant. Should we lazy-load sheet data (expand on click) rather than embedding it in the token render loop?

---

## Dependencies
- All subsequent STEPs that touch creature/item data (STEP-007 Item data sheet, STEP-008 CharacterRef)
- The formula engine: `src/lib/formulaEngine/` (Peggy grammar + AST evaluator + deck state)
- Peggy build plugin for Vite (`rollup-plugin-peggy` or `vite-plugin-peggy`)
