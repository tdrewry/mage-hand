# Skill Check Action System

## Summary
Wire skill checks from the Actions menu through the Action Card resolve flow instead of rolling dice directly.

## Changes
1. **actionStore.ts** — Added `startSkillCheck(sourceTokenId, skillName, modifier)` that creates an ActionQueueEntry with category `'skill'`, rolls d20+modifier, and goes straight to resolve phase (no targeting needed).
2. **ActionCard.tsx** — Added `SkillCheckResolvePhase` component showing the roll result prominently with Pass/Fail buttons instead of the full attack resolution UI. History entries display skill checks with roll total and Pass/Fail badge.
3. **TokenContextMenu.tsx** — Replaced direct dice store roll with `startSkillCheck` call. Removed unused `useDiceStore` import.

## Flow
1. Right-click token → Actions → Skills → click a skill
2. Action Card opens in resolve phase showing d20+modifier result
3. DM marks Pass or Fail
4. Click "Record" to commit to action history
