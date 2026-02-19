# Project Context

## Agent Operating Contract
- `CONTEXT.md` is the active memory and operating contract for this repository.
- Start every run by reading this file.
- Keep execution autonomous and momentum-oriented.
- Ask clarifying questions only when a decision is high-risk, irreversible, or product-direction changing.
- Update this file when project decisions materially change.

## Hard Rules
- Maintain `CONTEXT.md` autonomously; do not ask the user what to store here.
- Keep entries durable and reusable; avoid one-off incident logs.
- Prefer concise, decision-oriented wording over process-heavy prose.
- If repository facts contradict this file, update this file in the same run.

## Per-Run Output Contract
- Every final response includes: `Context Sync: read=<yes/no>, sweep=<yes/no>, updated=<yes/no>`.
- If `updated=yes`, include `Context Deltas:` with concise bullets.

## Engineering Standards
- Default to small, verifiable changes over speculative rewrites.
- Keep docs and implementation aligned in the same run when practical.
- Follow clean code, DRY, and SOLID principles.
- In TypeScript source, prefer static ES imports over CommonJS `require(...)`.

## Canonical Docs
- `docs/prd.md`

## Product Scope (Current)
- Build a browser-native, multiplayer RTS inspired by AoE2 using TypeScript.
- Primary game loop: gather resources, build, train units, fight, and resolve win/loss.
- Movement model: grid-based global pathfinding plus continuous local collision/avoidance.
- Multiplayer model: authoritative server simulation with client interpolation.

## Technical Decisions (Current)
- Backend authority model: SpacetimeDB reducers as simulation authority.
- Immediate implementation phase: local browser prototype with no backend dependency.
- Current prototype view/model: isometric tile terrain with grid outlines and non-walkable water tiles.
- Current input model: click/drag multi-unit selection with shared right-click move commands.
- Minimap input model: left click/drag on minimap pans camera focus.
- Current render model: terrain/grid pre-rendered to a cached layer and composited each frame for smoother camera movement.
- Current camera model: fixed overscroll clamp against map projection bounds (about 50% vertical, 25% horizontal minimum map visibility), with minimap viewport box derived from true camera footprint.
- Camera boundary behavior: movement projects to the closest valid in-bounds camera point (enabling edge sliding, e.g. right movement can induce up).
- Minimap viewport overlay is clipped to minimap container bounds.
- CI/CD model: GitHub Actions builds Bun static export (`dist/`) and publishes it to `gh-pages`.
- Tick model target: fixed server tick in the 10-20 Hz range for MVP.
- Client stack: TypeScript with Canvas-first rendering, preserving a migration path to WebGL batching.
- Pathfinding architecture: replaceable module boundary with deterministic tie-breaking and budgeted/incremental execution.
- Asset strategy: progressive loading and modern compression; keep initial playable load small.

## Repository Snapshot
- `CONTEXT.md` stores operating memory and guardrails for agent execution.
- `docs/prd.md` is the product source-of-truth.
- Local client code is now organized under `src/game/` modules (`iso`, `terrain`, `units`) with `src/index.ts` as orchestrator.

## Known Issues / Active Risks
- Movement quality and collision deadlock handling at scale are not yet validated in implementation.
- Replication bandwidth strategy (full-match vs AOI scoped) is still an open architectural tradeoff.
- Final rendering backend commitment (Canvas-only vs early WebGL adoption) remains open.

## Open Questions
- Public alpha target scale: start with 1v1 only or include team modes immediately?
- Default simulation tick for first playtests: 10 Hz or 20 Hz?
- Sequence for AOI/fog-scoped subscription investment: MVP or post-vertical-slice hardening?

## User Collaboration Preferences
- Autonomy-first: implement directly when decisions are bounded by repo context.
- Ask questions only when blocked by missing permissions/credentials or materially risky choices.
- Keep communication concise and explicit about tradeoffs.
- Keep `CONTEXT.md` clean and project-relevant as decisions evolve.
