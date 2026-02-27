# Handoff Packet — <Project>

**Packet ID:** HP-YYYYMMDD-###
**From:** <agent/model or person>
**To:** <agent/model>
**Date:** YYYY-MM-DD
**Timezone:** America/New_York
**Goal of handoff:** <what the new agent should accomplish next>

---

## Executive Summary (5–10 lines)
- What we’re building:
- Current state:
- What’s blocked:
- What “good” looks like in the next step:

## Current Objective (single most important task)
- **Task:** <one sentence>
- **Done when:** <clear acceptance criteria>

## Ground Truth (Authoritative Artifacts)
These are canonical; do not contradict without proposing an ADR change.
- `ARCHITECTURE.md`
- `NAMING.md`
- `DECISIONS/ADR-### ...`
- `SCHEMAS/...`
- `README.md` / `CONTRIBUTING.md`

## Key Decisions (Digest)
List the top 5–10 decisions the new agent must not accidentally undo.
- ADR-###: <title> — <1 line what it means operationally>
- ADR-###: ...

## Invariants (Do-not-break rules)
- <e.g., URN format, PK/SK rules, API routing rules, versioning constraints>
- <dependency constraints>

## Open Questions / Known Unknowns
- Q:
    - What we know:
    - What we need:

## Work Completed Since Last Handoff
- <bullet list with file paths / PR ids / commit hashes if applicable>

## Next Actions (prioritized)
1. <action with file targets>
2. <action>
3. <action>

## Risks & Footguns
- <risk> — mitigation
- <risk> — mitigation

## Validation Checklist
How to prove the work is correct:
- [ ] Unit tests: <command>
- [ ] Integration tests: <command>
- [ ] Lint/format: <command>
- [ ] Manual checks: <steps>

## “If you only read one thing”
- Point to the single most important ADR/doc for correctness.

## Appendix
- Glossary (project-specific terms)
- Links / references
