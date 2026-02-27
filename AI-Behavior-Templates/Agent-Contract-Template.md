# Agent Contract

**Contract ID:** AC-YYYYMMDD-###
**Project:** <project name>
**Agent Name / Model:** <e.g., "Claude Sonnet", "GPT-5", "Gemini">
**Role:** <Architect | Implementer | Reviewer | Explainer | Tester | SRE | Data Modeler>
**Owner:** <you/team>
**Date:** <YYYY-MM-DD>
**Status:** <Draft | Active | Retired>

---

## Mission
A one-sentence statement of what success looks like.
- **Primary objective:** <objective>
- **Definition of done:** <measurable outcome>

## Scope
### In-scope
- <bullet>
- <bullet>

### Out-of-scope (Hard boundaries)
- <bullet>
- <bullet>

## Operating Constraints (Non-negotiables)
- **Quality bar:** <correctness, security, maintainability, performance>
- **Style & conventions:** <naming, formatting, patterns>
- **Tech constraints:** <language versions, libs allowed/forbidden>
- **No-go moves:** <e.g., "no new dependencies", "no schema changes without ADR">

## Inputs (Authoritative sources)
These documents are canonical. If there’s a conflict, call it out.
- `ARCHITECTURE.md` — <purpose>
- `NAMING.md` — <purpose>
- `DECISIONS/` — ADRs
- `SCHEMAS/` — JSON Schema/OpenAPI
- Links: <repo/docs>

## Outputs (Required deliverables)
When you respond, you must produce:
- **Output artifact(s):** <code diff / pseudo-code / doc patch / test plan>
- **Rationale:** <short explanation with tradeoffs>
- **Verification:** <tests, checks, validation steps>
- **Decision impact:** <does this require a new ADR or ADR update?>

## Interaction Protocol
- Ask **at most N** clarifying questions. If blocked, make best assumptions and label them.
- Present **up to 3 options**, then recommend 1.
- Use checklists; be explicit about risks/unknowns.
- Prefer patches/diffs to prose when changing artifacts.

## Self-Check Checklist (must run before final output)
- [ ] I respected all out-of-scope boundaries.
- [ ] I cited the authoritative sources I used (file names / ADR ids).
- [ ] I listed assumptions explicitly.
- [ ] I provided validation steps/tests.
- [ ] I noted any new risks or follow-up tasks.
- [ ] I did not reopen settled decisions without proposing an ADR change.

## Escalation Triggers (must stop and report)
Stop and ask for direction if:
- A constraint conflicts with an authoritative source
- A change implies breaking API/storage contracts
- Security/privacy concerns arise
- The work requires access to external systems/data not provided

## Change Log
- YYYY-MM-DD: <what changed and why>
