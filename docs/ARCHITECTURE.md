## Architecture (Sim vs Phaser vs React)

This project is structured around a **pure TypeScript simulation core** and two thin adapters:

- **Simulation (engine-agnostic)**: `src/sim/**`
- **Rendering + input (Phaser)**: `src/game/**`
- **UI (React)**: `src/**` (primarily `src/App.tsx`)

### Goals

- **All game rules live in `src/sim/`** (no Phaser imports, no React imports).
- Phaser scenes **render** and **forward input**; they call `sim.tick(...)` and dispatch sim actions.
- React components **display** state and **dispatch actions** through a small facade and the existing `EventBus`.

### `src/sim/**` (rules + state)

- **Central clock**: `src/sim/clock.ts`
    - Day / night phase switching
    - Phase duration and remaining time
- **Progression**: `src/sim/progression.ts`
    - XP curve (`xpToNext`) is monotonic
    - Level-ups grant skill points
- **Upgrades**: `src/sim/upgrades.ts`
    - Speed tier → speed multiplier
    - Configurable monotonic cost formula
- **Economy**: `src/sim/economy.ts`
    - Money accounting
- **Customers + shop loop**: `src/sim/customers.ts`
    - Spawn pacing differs for day vs night
    - Customers either buy (sale → money + XP) or become battle-ready
- **Deck + cards**: `src/sim/cards/*`
    - Minimal card definitions with tiers
    - Deck constraints and tier gating
- **Battle**: `src/sim/battle.ts`
    - Minimal deterministic-ish resolution using seeded RNG
- **Persistence schema**: `src/sim/persistence.ts`
    - LocalStorage save format with schema versioning

### `src/game/**` (Phaser adapter)

- **Event bridge**: `src/game/EventBus.ts` (template event emitter)
- **Shop scene**: `src/game/scenes/ShopScene.ts`
    - Owns a `SimGame` instance
    - Calls `sim.tick(dtSeconds)` in `update`
    - Emits `sim:snapshot` to React at ~10Hz
    - Accepts actions from React via `sim:action`
    - **Autosaves** on night start (phase change → night)

### React UI (display + actions)

- **Facade**: `src/game/GameFacade.ts`
    - React does not call Phaser APIs directly
    - React dispatches actions by emitting to `EventBus`
- **UI**: `src/App.tsx`
    - Subscribes to snapshots
    - Presents the tab layout and controls

### EventBus message contracts (MVP)

- **React → Phaser**
    - `sim:action` with `SimAction`
    - `sim:save` (manual save)
    - `sim:load` (manual load)
- **Phaser → React**
    - `sim:snapshot` with `SimSnapshot` (throttled)
    - `sim:event` with `SimEvent` (battle results, etc.)
    - `sim:battlePrompt` with `customerId`
    - `sim:autosaved`
