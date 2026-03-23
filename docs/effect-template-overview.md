# Effect Template System Overview

The Effect Template system in Mage-Hand provides a flexible framework for defining, placing, and resolving map-based effects such as spells, traps, skills, and environmental hazards. This system is designed to perform hit-testing against tokens and map objects, feeding the results into the Action Card and overall rules engine.

## Name Linking & Character Sheet Integration

Currently, the linkage between character sheet actions (spells, traits, attacks) and Effect Templates is primarily designed through explicit ID assignment (`effectTemplateId`) within the creature/character data model, which is parsed by `attackParser.ts`. 

The capability for dynamic **name linking** (e.g., automatically matching an action named "Fireball" to the built-in "Fireball" template ID by string matching) appears to be a **stub or a work in progress**. While the underpinnings exist in the parser to extract spell/attack names and an `effectTemplateId` field, the automated string-matching and dynamic hook-up from the UI layer to launch templates strictly by name is not yet fully implemented.

## Template Editor Tabs

The Template Editor (found in `EffectsCatalog.tsx`) breaks down effect configuration into seven distinct tabs. Here is what each tab encapsulates:

### 1. Shape
Intended to encapsulate all **spatial geometry, placement rules, and visual aesthetics**.
- **Geometry**: Defines the overarching shape (circle, line, cone, rectangle, circle-burst, rectangle-burst, polyline/wall) and its associated dimensions (radius, length, width, angle).
- **Placement**: Configures whether the effect aligns to the 45° grid, targets the caster, can be placed at a distance (ranged), or requires multiple drops (e.g., *Meteor Swarm*). It also includes configuration for "Auras" that lock to and move with a specific token.
- **Visuals**: Manages the color, opacity, texture mappings (with scale/offset), and dynamic animations (flicker, crackle, pulse, swirl, rotate, etc.).

### 2. Dmg (Damage)
Intended to encapsulate the **damage payloads and attack roll requirements**.
- **Damage Rows**: Allows defining multiple damage dice formulas and their corresponding types (e.g., 4d6 Fire + 4d6 Radiant for *Flame Strike*).
- **Attack Rolls**: Configures whether the effect requires a to-hit roll before applying damage, including which ability modifier to use (Spellcasting, STR, DEX, etc.) and any fixed bonuses.

### 3. Level
Intended to encapsulate **scaling logic for upcast abilities**.
- **Base Level**: Sets the minimum required spell slot or starting level for the template.
- **Scaling Rules**: Automates how properties (such as damage dice, radius, length, width, or multi-drop quantity) increase per level upcast.
- **Level Overrides**: Allows for explicit, hardcoded replacements for certain stats at specific levels (e.g., replacing the computed 10d6 at level 5 with a completely different formula or size).

### 4. Mods (Modifiers)
Intended to encapsulate **mathematical stat adjustments** applied to targeted tokens.
- **Stat Targets**: Modifies token properties like Armor Class, Speed, Initiative, Temp HP, or Ability Scores.
- **Operations & Timing**: Defines the math operation (`add`, `set`, `multiply`), the numeric value, and exactly when the modifier triggers relative to the token's position in the area (`on-enter`, `on-exit`, `on-stay`).

### 5. Conds (Conditions)
Intended to encapsulate the application and removal of **standard 5e conditions**.
- Modifies boolean states for conditions such as *blinded*, *frightened*, *paralyzed*, and *restrained*.
- Like Modifiers, it allows developers to specify whether the condition is applied or removed, and exactly when it triggers (`on-enter`, `on-exit`, `on-stay`).

### 6. Grants
Intended to encapsulate **temporary actions or features** granted to tokens within an effect.
- Can give a token a new, temporary Action, Attack, Spell, or Trait while they occupy the effect area or hold the condition.
- Includes fields for the granted action's attack bonus, damage formula, and description.

### 7. Dur (Duration)
Intended to encapsulate the **lifespan and persistence** of the effect.
- **Duration Type**: Determines if the effect is `instantaneous` (one-shot fireball), `timed` (persists for N rounds), or `infinite` (persists until manually dismissed).
- **Template Mode**: For non-instantaneous effects, this controls whether the visual shape remains painted on the map (`persistent`) or is removed after initial targeting (`targeting-only`).
- **Trigger Behavior**: Controls whether the effect is `Recurring` (re-evaluates and triggers on creatures every round they are inside) or `One-shot` (only affects a creature the first time they interact with it).
