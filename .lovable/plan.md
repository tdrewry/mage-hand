
# D&D Beyond Character Sheets & 5e.tools Monster Bestiary Integration

## Overview

This plan implements a comprehensive creature/character data system that enables:

1. **Character Sheet Cards** - Display D&D Beyond character data in draggable UI cards
2. **Monster Stat Block Cards** - Display 5e.tools monster data in stat block format
3. **Enhanced Token Creation Panel** - Create tokens from imported characters/monsters with auto-populated portraits

---

## Architecture

```text
+------------------+     +------------------+     +------------------+
|  Data Sources    |     |   Data Stores    |     |   UI Components  |
+------------------+     +------------------+     +------------------+
|                  |     |                  |     |                  |
| D&D Beyond URLs  |---->| creatureStore.ts |---->| CharacterCard    |
| (Firecrawl)      |     | - characters[]   |     | MonsterCard      |
|                  |     | - monsters[]     |     | CreaturePanel    |
| 5e.tools Data    |---->| - bestiary[]     |     | (Token Creation) |
| (Static JSON)    |     |                  |     |                  |
+------------------+     +------------------+     +------------------+
        |                        |                        |
        v                        v                        v
+------------------+     +------------------+     +------------------+
| Token Creation   |<----|  Token.entityRef |<----| Token Edit Modal |
| with Portrait    |     |  Links token to  |     | Shows linked     |
|                  |     |  creature data   |     | creature data    |
+------------------+     +------------------+     +------------------+
```

---

## Data Types

### Character Data (D&D Beyond)

```typescript
interface DndBeyondCharacter {
  id: string;
  name: string;
  portraitUrl?: string;
  level: number;
  classes: Array<{ name: string; level: number }>;
  race: string;
  
  // Ability Scores
  abilities: {
    strength: { score: number; modifier: number };
    dexterity: { score: number; modifier: number };
    constitution: { score: number; modifier: number };
    intelligence: { score: number; modifier: number };
    wisdom: { score: number; modifier: number };
    charisma: { score: number; modifier: number };
  };
  
  // Combat Stats
  armorClass: number;
  hitPoints: { current: number; max: number; temp: number };
  speed: number;
  initiative: number;
  proficiencyBonus: number;
  
  // Skills & Proficiencies
  skills: Array<{ name: string; modifier: number; proficient: boolean }>;
  savingThrows: Array<{ ability: string; modifier: number; proficient: boolean }>;
  proficiencies: {
    armor: string[];
    weapons: string[];
    tools: string[];
    languages: string[];
  };
  
  // Features & Actions
  features: Array<{ name: string; description: string; source: string }>;
  actions: Array<{ name: string; attackBonus?: number; damage?: string; description: string }>;
  spells?: Array<{ name: string; level: number; prepared: boolean }>;
  
  // Conditions
  conditions: string[];
  
  // Source tracking
  sourceUrl: string;
  lastUpdated: Date;
}
```

### Monster Data (5e.tools Format)

```typescript
interface Monster5eTools {
  id: string;
  name: string;
  source: string;  // Book source (e.g., "MM", "VGM")
  
  // Classification
  size: 'T' | 'S' | 'M' | 'L' | 'H' | 'G';  // Tiny to Gargantuan
  type: string;  // "dragon", "humanoid", etc.
  alignment: string;
  
  // Combat Stats
  ac: Array<{ ac: number; from?: string[] }>;
  hp: { average: number; formula: string };
  speed: { walk?: number; fly?: number; swim?: number; climb?: number; burrow?: number };
  
  // Ability Scores
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
  
  // Challenge
  cr: string | number;  // Can be "1/4", "1/2", etc.
  
  // Defenses
  senses: string[];
  passive: number;  // Passive Perception
  languages: string[];
  immune?: string[];  // Damage immunities
  resist?: string[];  // Damage resistances
  vulnerable?: string[];
  conditionImmune?: string[];
  
  // Actions & Traits
  trait?: Array<{ name: string; entries: string[] }>;
  action?: Array<{ name: string; entries: string[] }>;
  legendary?: Array<{ name: string; entries: string[] }>;
  reaction?: Array<{ name: string; entries: string[] }>;
  
  // Images
  tokenUrl?: string;
  fluffImages?: Array<{ url: string }>;
}
```

---

## Implementation Phases

### Phase 1: Core Data Infrastructure ✅ COMPLETE

**New Files Created:**
- ✅ `src/types/creatureTypes.ts` - Type definitions for characters and monsters
- ✅ `src/stores/creatureStore.ts` - Zustand store for creature data management
- ✅ `src/lib/dndBeyondParser.ts` - Parse scraped D&D Beyond HTML to character data
- ✅ `src/lib/monsterDataLoader.ts` - Load and manage 5e.tools monster data

**Modified Files:**
- ✅ `src/types/cardTypes.ts` - Added CHARACTER_SHEET, MONSTER_STAT_BLOCK, CREATURE_LIBRARY
- ✅ `src/stores/cardStore.ts` - Added default configs for new card types
- ✅ `src/components/CardManager.tsx` - Registered new card content renderers (placeholder)

### Phase 2: Data Import Systems

**D&D Beyond Import (via Firecrawl):**
- Create Supabase Edge Function `supabase/functions/scrape-dndbeyond/index.ts`
- Accepts character URL, scrapes page, returns structured data
- Extracts: portrait URL, stats, skills, features, actions, spells

**5e.tools Data Loading:**
- Bundle a curated SRD-compliant bestiary JSON (avoid copyright issues)
- Provide UI to load external 5e.tools JSON exports
- Store in IndexedDB for offline access
- Option 1: Ship with basic SRD monsters
- Option 2: Allow user to paste/import 5e.tools JSON export

### Phase 3: UI Cards - IN PROGRESS

**New Card Types:**
- ✅ `CardType.CHARACTER_SHEET` - Displays character data (placeholder)
- ✅ `CardType.MONSTER_STAT_BLOCK` - Displays monster stat block (placeholder)
- ✅ `CardType.CREATURE_LIBRARY` - Browse/search creatures, create tokens (COMPLETE)

**Card Components:**

```text
src/components/cards/
  CharacterSheetCard.tsx      - Full character sheet display (TODO)
  MonsterStatBlockCard.tsx    - Traditional stat block format (TODO)
  CreatureLibraryCard.tsx     - Browse/import creatures (COMPLETE)
```

**CharacterSheetCard Layout:**
```
+---------------------------------------+
| [Portrait] Character Name    Lvl X    |
|           Race | Class(es)            |
+---------------------------------------+
| STR  DEX  CON  INT  WIS  CHA         |
| +2   +3   +1   +0   +2   -1          |
+---------------------------------------+
| AC: 16  |  HP: 45/52  |  Init: +3    |
| Speed: 30ft  |  Prof: +2             |
+---------------------------------------+
| [Skills Tab] [Features Tab] [Spells] |
|                                       |
| Acrobatics: +5                        |
| Arcana: +7*                          |
| ...                                   |
+---------------------------------------+
| [Create Token]  [Refresh]  [Remove]  |
+---------------------------------------+
```

**MonsterStatBlockCard Layout:**
```
+---------------------------------------+
| [Token Art]  ADULT RED DRAGON        |
|              Huge dragon, CE          |
+---------------------------------------+
| AC 19 (natural armor)                 |
| HP 256 (19d12 + 133)                  |
| Speed 40ft, climb 40ft, fly 80ft      |
+---------------------------------------+
| STR  DEX  CON  INT  WIS  CHA         |
| 27   10   25   16   13   21          |
+---------------------------------------+
| Saving Throws DEX +6, CON +13...      |
| Skills Perception +13, Stealth +6     |
| Damage Immunities fire                |
| Senses blindsight 60ft...             |
| Languages Common, Draconic            |
| CR 17 (18,000 XP)                     |
+---------------------------------------+
| TRAITS                                |
| Legendary Resistance (3/Day). ...     |
+---------------------------------------+
| ACTIONS                               |
| Multiattack. The dragon can use...    |
| Bite. +14 to hit, reach 10ft...       |
+---------------------------------------+
| [Create Token]                        |
+---------------------------------------+
```

### Phase 4: Token Creation Integration

**Enhanced Token Creation Flow:**

1. **From Character Sheet Card:**
   - "Create Token" button extracts portrait URL
   - Creates token with:
     - `imageUrl`: Character portrait
     - `name`: Character name
     - `label`: Character name
     - `entityRef`: `{ type: 'local', entityId: characterId, projectionType: 'character' }`
   - Size defaults to Medium (1x1)

2. **From Monster Stat Block Card:**
   - "Create Token" button uses token/portrait image
   - Creates token with:
     - `imageUrl`: Monster token art
     - `name`: Monster name  
     - `label`: Monster name
     - `gridWidth/gridHeight`: Based on size (T=0.5, S/M=1, L=2, H=3, G=4)
     - `entityRef`: `{ type: 'local', entityId: monsterId, projectionType: 'stat-block' }`

3. **Creature Library Panel:**
   - Searchable list of all characters and monsters
   - Drag-and-drop or click to create token
   - Preview panel shows quick stats

### Phase 5: Token-Creature Linking

**Token Details Tab Enhancement:**

The existing "Details" tab in Edit Token modal gains:
- "Linked Creature" section showing linked character/monster
- Quick stats summary inline
- "View Full Sheet" button opens the full card
- "Unlink" button to disconnect

**entityRef Usage:**
```typescript
// Existing Token.entityRef structure:
entityRef: {
  type: 'local',           // Local data store
  entityId: 'char-123',    // ID in creatureStore
  projectionType: 'character' | 'stat-block'
}
```

---

## File Changes Summary

### New Files

| File | Purpose |
|------|---------|
| `src/types/creatureTypes.ts` | TypeScript interfaces for characters/monsters |
| `src/stores/creatureStore.ts` | Zustand store for creature data |
| `src/lib/dndBeyondParser.ts` | Parse D&D Beyond page content |
| `src/lib/monsterDataLoader.ts` | Load/search 5e.tools data |
| `src/components/cards/CharacterSheetCard.tsx` | Character sheet UI |
| `src/components/cards/MonsterStatBlockCard.tsx` | Monster stat block UI |
| `src/components/cards/CreatureLibraryCard.tsx` | Creature browser/search |
| `src/components/modals/ImportCharacterModal.tsx` | D&D Beyond URL import |
| `src/components/modals/ImportBestiaryModal.tsx` | 5e.tools JSON import |
| `supabase/functions/scrape-dndbeyond/index.ts` | Edge function for scraping |
| `public/data/srd-bestiary.json` | SRD-compliant monster data |

### Modified Files

| File | Changes |
|------|---------|
| `src/types/cardTypes.ts` | Add `CHARACTER_SHEET`, `MONSTER_STAT_BLOCK`, `CREATURE_LIBRARY` |
| `src/stores/cardStore.ts` | Add default configs for new card types |
| `src/components/CardManager.tsx` | Register new card content renderers |
| `src/components/cards/MenuCard.tsx` | Add "Creature Library" button |
| `src/components/TokenContextMenu.tsx` | Show linked creature info in Details tab |

---

## Technical Considerations

### Data Storage Strategy

- **Characters**: Stored in `creatureStore` (Zustand with localStorage persistence)
- **Monsters**: Loaded into memory from JSON, optionally cached in IndexedDB
- **Token Images**: Saved via existing `tokenTextureStorage.ts` system

### 5e.tools Data Loading Options

1. **Bundled SRD Data**: Ship basic SRD monsters (~300 creatures, legal)
2. **User Import**: Allow paste/upload of 5e.tools JSON export
3. **Direct Fetch**: User provides their own 5e.tools data file URL

Recommendation: Start with bundled SRD + user import for full bestiary.

### D&D Beyond Scraping Considerations

- Requires Firecrawl connector for web scraping
- Falls back to manual data entry if scraping fails
- Respects rate limits and caching (1 request per character per hour)
- Character must be set to "Public" on D&D Beyond

### Image Handling

- Portrait/token images downloaded and stored in IndexedDB
- Uses existing texture storage system (`tokenTextureStorage.ts`)
- Hash-based deduplication prevents duplicates
- Synced to other clients via existing `textureSync.ts`

---

## User Workflow

### Importing a D&D Beyond Character

1. User clicks "Creature Library" in Menu Card
2. Clicks "Import Character" button
3. Pastes D&D Beyond character URL
4. System scrapes page, extracts data, downloads portrait
5. Character appears in library and as a new Character Sheet Card
6. User can "Create Token" to place on map

### Adding Monsters from 5e.tools

1. User clicks "Import Bestiary" in Creature Library
2. Option A: Search bundled SRD monsters
3. Option B: Paste 5e.tools bestiary JSON export
4. Monsters appear in searchable library
5. Click monster to open Stat Block Card
6. "Create Token" spawns token with correct size

### Linking Token to Creature

1. Right-click token -> Edit Token
2. Details tab shows "Link Creature" section
3. Search/select from library
4. Token now displays quick stats, opens full sheet on demand

---

## Dependencies

- **Firecrawl Connector**: Required for D&D Beyond scraping
- **Existing Infrastructure**: Uses current card system, token storage, image handling
- **No New npm Packages**: Leverages existing UI components

