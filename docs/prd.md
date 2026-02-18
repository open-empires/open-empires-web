# Open Empires Web PRD

## 1. Product Overview
Open Empires Web is a browser-native, multiplayer RTS inspired by Age of Empires II. The game runs fully in the web client with authoritative multiplayer simulation on the backend.

Core promise:
- Classic RTS unit control and macro decisions
- Modern online matchmaking and low-friction browser play
- Deterministic-enough simulation for reproducibility, testing, and debugging

## 2. Vision and Goals
### Vision
Deliver an AoE2-style experience that feels responsive and readable in a browser while remaining scalable, maintainable, and fun to iterate on.

### Primary Goals
1. Playable online match with core RTS loop (gather, build, fight, win/lose).
2. Unit movement that feels RTS-like (grid pathing + continuous local avoidance).
3. Authoritative multiplayer model that avoids lockstep out-of-sync failures.
4. Performance targets that support medium-large battles in real time.

### Non-Goals (Initial)
- Full AoE2 civ parity, campaigns, and all historical content.
- Pixel-perfect replication of legacy mechanics.
- Massive-FFA (50-100 player) as first release target.

## 3. Target Users
- RTS players who want quick browser access with no full native install.
- Competitive players interested in matchmaking and repeatable multiplayer sessions.
- Developer/creator audience interested in moddable strategy systems over time.

## 4. Core Product Principles
1. Server authoritative: clients send commands, not truth-state positions.
2. Deterministic interfaces at simulation boundaries (tie-breaking, seeds, fixed tick rules).
3. Hybrid movement model: grid for route planning, continuous space for unit motion and collision separation.
4. Progressive loading: fast time-to-play, then stream non-critical assets.

## 5. Gameplay Scope
### MVP Gameplay Loop
1. Start match with basic economy and town center equivalent.
2. Gather resources.
3. Train units.
4. Build military structures.
5. Move/attack with groups.
6. Win condition: eliminate opponent (or destroy key structure).

### MVP Systems
- Fog of war (basic team vision)
- Selection box + command issuing
- Move/attack/build commands
- Basic formation move behavior (slot-based target offsets)
- Pathfinding with dynamic re-path on blocked routes
- Combat resolution and health/death

### Post-MVP Candidate Systems
- Advanced formations and stance behaviors
- Additional resource types and tech tree depth
- Ranked ladder, replay viewer, spectating, and tournaments

## 6. Technical Architecture
### Client
- TypeScript front-end
- Initial rendering target: Canvas 2D, with optional migration path to WebGL batching
- Client responsibilities:
  - Input and UI
  - Local interpolation/extrapolation for smooth motion
  - Visual-only prediction where safe
  - No authority over simulation truth

### Server
- SpacetimeDB authoritative simulation
- Fixed simulation tick (target 10-20 Hz initially)
- Reducers process command queues and world simulation
- Server publishes scoped state updates to clients

### Data/Replication
- Clients subscribe to relevant game state (initially whole match scope for MVP; AOI later)
- Delta-style updates per tick where feasible
- Server-enforced fog-of-war visibility boundaries

## 7. Movement and Pathfinding Requirements
### World Representation
- Terrain and building occupancy use a grid representation.
- Units exist in continuous coordinates with collision radius.

### Unit Motion Model
1. Global path from grid-based planner (A* baseline).
2. Per-frame local steering:
  - Separation from nearby units
  - Obstacle avoidance
  - Velocity smoothing
3. Soft collision handling to avoid deadlocks in crowds/chokepoints.

### Formation Behavior
- Formation move computes slot offsets around an anchor.
- Units are assigned to slots and path toward assigned destinations.
- Formation logic does not permit permanent unit stacking.

### Pathfinding Module Boundary
Pathfinding should be replaceable and benchmarkable.

Required characteristics:
- Deterministic tie-breaking (seeded where needed)
- Time/expansion budget controls
- Incremental execution support (resume across ticks)
- Clear input/output contracts separated from navigation-data building

## 8. Performance and Scale Targets
### MVP Target
- 1v1 to 4v4 matches
- Up to ~200 population per player equivalent gameplay scale
- Stable 10-20 Hz server tick under typical battle load

### Stretch Target
- Higher concurrency via AOI subscriptions and simulation optimization
- Larger matches only after proving simulation and replication headroom

### Budgets (Initial Planning)
- Initial playable load target: <20 MB for first match-ready experience
- Full asset footprint target (compressed, streamed): roughly 30-120 MB
- Keep engine/runtime bundle minimal and aggressively compressed

## 9. Networking Model
### Command Flow
1. Client sends command (`move_units`, `attack`, `build`, etc.).
2. Server validates and queues command for simulation tick.
3. Server applies command and emits resulting state changes.
4. Client interpolates visual updates between server ticks.

### Reliability Requirements
- Server is source of truth for combat, movement, economy, and win conditions.
- Client-side trust minimization: reject impossible or unauthorized commands.
- Reproducible match logs for debugging and replay evolution.

## 10. Matchmaking and Session Requirements
### MVP
- Create/join match flow in browser
- Basic matchmaking (manual queue acceptable for first release)
- Reconnect handling for short disconnect windows

### Post-MVP
- Ranked matchmaking and MMR
- Party queue
- Spectator and observer modes

## 11. Asset and Content Strategy
- Prioritize gameplay-critical assets first; stream optional assets later.
- Use modern compression formats for audio/images.
- Avoid large non-essential media in initial release (no FMV-style payloads).

## 12. Quality and Validation
### Must-Pass Acceptance Criteria (MVP)
1. Two players can complete a full online match end-to-end.
2. Unit movement avoids severe deadlocks in common chokepoint scenarios.
3. Server remains authoritative and consistent under packet delay/jitter.
4. Match state progression remains coherent over long sessions.
5. Initial load and in-match performance stay within declared budgets.

### Pathfinding Benchmarking
Maintain a benchmark suite with fixed query sets and report:
- Success rate
- Median/p95 runtime per query
- Node expansions
- Path cost inflation vs baseline
- Determinism checks under repeated runs

## 13. Delivery Plan
### Phase 1: Vertical Slice
- One map, two factions, minimal unit roster
- Authoritative multiplayer and match completion
- Baseline pathfinding + local avoidance

### Phase 2: Core RTS Depth
- Economy and production depth
- More units/buildings
- Improved formation/combat behavior

### Phase 3: Platform Hardening
- Matchmaking UX improvements
- Replay/telemetry infrastructure
- Performance optimization, anti-cheat hardening

## 14. Key Risks and Mitigations
1. Pathfinding + collision complexity at scale
- Mitigation: isolate modules, benchmark continuously, enforce per-tick budgets.

2. Replication bandwidth growth with unit count
- Mitigation: AOI/fog-scoped subscriptions and delta compression.

3. Browser rendering bottlenecks in large battles
- Mitigation: batching strategy, sprite atlas discipline, progressive WebGL adoption.

4. Simulation drift/edge-case nondeterminism
- Mitigation: deterministic tie-breakers, constrained floating-point boundaries, replay validation.

## 15. Open Questions
1. Initial rendering backend decision for production MVP: Canvas-only or early WebGL?
2. Tick rate default: 10 Hz or 20 Hz for first public playtests?
3. Initial match scale target for public alpha: 1v1 focus or 2v2/4v4 from day one?
4. Immediate AOI investment vs full-match subscriptions until optimization phase?
