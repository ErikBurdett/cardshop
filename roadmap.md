# Cardshop Roadmap (2026)

This repo already has a strong **engine-agnostic sim core** (`src/sim/**`) and a thin Phaser + React adapter layer. The next step is to turn the current “debug UI” and placeholder shop view into a cohesive, interactive, pixel-art shop scene with fewer menus and more *in-world* actions (clicking customers and shop elements for contextual actions).

---

## Feature inventory

### Present (implemented today)

- **Sim core (pure TS)** in `src/sim/**`
  - **Day/night clock** + phase transitions (`src/sim/clock.ts`, `src/sim/game.ts`)
  - **Customers**: spawn, browse, decide, buy-or-challenge loop (`src/sim/customers.ts`)
  - **Economy**: money in/out; wholesale buying; shelf stocking; sales resolution (`src/sim/shop.ts`, `src/sim/economy.ts`)
  - **Progression**: XP → levels → skill points (`src/sim/progression.ts`)
  - **Skills / unlock gate**: tier-2 unlock (`src/sim/skills.ts`)
  - **Deck building**: add/remove cards with tier gating (`src/sim/cards/**`)
  - **Battle resolver (MVP)**: instant resolution vs battle-ready customer (`src/sim/battle.ts`)
  - **Persistence**: localStorage save/load + schema versioning; autosave at night start (`src/sim/persistence.ts`, `src/game/scenes/ShopScene.ts`)
  - **Tests** for sim modules (`src/sim/*.test.ts`)

- **Phaser adapter** in `src/game/**`
  - `ShopScene` owns a `SimGame`, ticks it, and emits snapshots to React (`src/game/scenes/ShopScene.ts`)
  - **Clickable customers**: clicking a battle-ready customer triggers `sim:battlePrompt` (wired to React) (`src/game/scenes/ShopScene.ts`, `src/App.tsx`)

- **React UI (MVP)** in `src/App.tsx`
  - Tabs: **Shop / Manage / Packs / Deck / Battle / Skills / Settings**
  - Can buy wholesale packs, stock/unstock shelves, buy speed tiers, unlock tier 2, start battles, save/load

- **Pixel character spritesheet baseline**
  - `public/assets/knight-walking.png` is now loaded and used for customer rendering.
  - Phaser animation key: `knight_walking_loop` (frames 0–15, 8 fps, repeat) created in `src/game/scenes/Preloader.ts`.

### Absent (not implemented yet)

- **Cohesive shop scene**
  - No tilemap / shop layout / walkable space / decor placement
  - No player avatar or navigation
  - No pathing for customers, no queueing, no shelf interaction visuals

- **Centralized UI / fewer menus**
  - Current UI is tab-based; not contextual to what you click in the shop
  - No in-world action menus (customer / shelf / decor context panel)

- **Customer interactivity depth**
  - No “talk / sell / dismiss / upsell / offer battle / inspect” menu
  - No archetypes, moods, preferences, patience, reputation, etc.

- **Card acquisition + opening loop**
  - You can buy “packs” as SKUs, but there’s no pack-opening UX, rarity tables, collection, or card visuals

- **Battle gameplay UI**
  - Resolver exists, but no turn-based battle loop, hand UI, status effects, etc.

- **2D pixel asset pipeline (beyond the single sample)**
  - No standardized loader/registry for characters, tiles, decor, UI atlases
  - No naming conventions enforced across assets

- **Audio, juice, UX polish**
  - Minimal feedback (no sfx, vfx, hover states, contextual tooltips, etc.)

---

## Roadmap (recommended milestones)

### Milestone 1 — Sprite & asset foundation (fast win)

- Standardize **character spritesheets** to the 4×4 format (16 frames) and centralize loading + anim creation.
- Add a minimal “asset registry” module so `Preloader` stays clean as assets grow.
- Establish folder layout under `public/assets/`:
  - `characters/`, `tiles/`, `decor/`, `ui/`, `cards/`, `generated/`

### Milestone 2 — Shop scene becomes the game (tilemap + entities)

- Replace the placeholder shelf/customer layout with a **tile-based shop**.
- Render shelves and shop props as placed entities (not just text rows).
- Spawn customers into the scene as moving sprites (even simple lerps first; pathing later).

### Milestone 3 — Contextual interaction (less menus, more in-world)

- Clicking a **customer** opens a contextual action menu:
  - Buy / Offer battle / Inspect / Dismiss / (future: upsell, haggle, loyalty)
- Clicking a **shop element** (shelf, counter, decor) opens a contextual menu:
  - Stock/unstock, upgrade, move, inspect stats, etc.
- Refactor React UI into:
  - a **top status bar** (money/day/phase/speed)
  - a **single right-side context panel** that changes based on selection
  - optional collapsible “management” drawers (inventory/deck/skills)

### Milestone 4 — Card loop (opening, collection, selling)

- Pack opening flow (rarities, card art, collection, duplicates).
- Inventory/collection screens integrated into the context panel (not separate tabs).
- Link cards to the shop loop (sell singles, bundles, or play them in battle).

### Milestone 5 — Battle loop (turn-based UI)

- Turn order, hands, energy/mana, statuses, win/lose outcomes.
- Add battle scene/panel that reuses the same card assets (frames, icons, VFX).

### Milestone 6 — Progression expansion + content

- More customer archetypes and behaviors
- Decor system that affects stats (spawn rate, sale price, challenge rate, etc.)
- Shop expansion (floor space, shelf count, queue length)
- Balancing across days/tiers, difficulty curve

---

## Asset plan (how `knight-walking.png` grows)

### Character sprites (4×4 @ 16 frames)

**Format you chose (recommended):**
- Sheet size: \(N \cdot 48\) × \(N \cdot 48\) pixels (currently 4×4 → **192×192**)
- Frames: 16 total (0–15), frame size **48×48**
- Suggested semantic rows (future-proof):
  - Row 0: down (frames 0–3)
  - Row 1: left (4–7)
  - Row 2: right (8–11)
  - Row 3: up (12–15)

**Folder + naming convention (recommended):**
- `public/assets/characters/<id>/<id>-walk-48.png`
- `public/assets/characters/<id>/<id>-meta.json` (optional later: offsets, speed, hitbox)

**How customers use it now:**
- Customers render using texture key `knight_walking_sheet` and play `knight_walking_loop`.

**How it expands soon:**
- Add direction-specific anims (`<id>_walk_down`, etc.) and choose which to play based on movement vector.
- Add “idle” anims in the same 4×4 sheet (either dedicate a second sheet, or reserve a row/frames convention).

### Player sprites

Use the same 4×4 standard so player/customer share animation code.

- `public/assets/characters/player/player-walk-48.png`
- Later: `player-idle-48.png`, `player-interact-48.png`

### Card assets

Cards benefit from a **data-driven** approach rather than one spritesheet format:

- **Card art**: `public/assets/cards/art/<cardId>.png` (source size e.g. 256×384)
- **In-game card frame**: `public/assets/cards/frame.png` (or an atlas)
- **Icons**: `public/assets/cards/icons/<keyword>.png` (16/24/32 px)

Later (recommended): pack these into a Phaser atlas for fewer HTTP requests:
- `public/assets/cards/cards-atlas.png`
- `public/assets/cards/cards-atlas.json`

### Shop tiles + decor assets

For the shop scene, prefer a **tilemap** + a decor layer:

- **Tileset** (choose one grid and stick to it project-wide):
  - `public/assets/tiles/shop-tiles-32.png` (32×32 tiles) *(recommended for readable interiors)*
- **Decor sprites**:
  - `public/assets/decor/shelves-32.png`
  - `public/assets/decor/props-32.png`
  - Or combine into an atlas later.

---

## Best-practice implementation prompts (copy/paste)

Use these as “starter prompts” when implementing each missing feature. They’re designed to preserve the sim/adapter separation, keep diffs tight, and avoid UI sprawl.

### 1) Centralize sprite loading + animation registration

> You are a senior Phaser 3 + TypeScript engineer. Create a small asset registry for character spritesheets and animations.
> - Keep the sim core in `src/sim/**` pure (no Phaser imports).
> - Add a `src/game/assets/` module that exposes `preloadAssets(scene)` and `createGlobalAnims(scene)`.
> - Migrate the existing `knight_walking_sheet` load + `knight_walking_loop` animation from `Preloader` into this registry.
> - Ensure animations are idempotent (`scene.anims.exists`).
> - Provide final code changes and explain where new characters should be registered.

### 2) Customer action menu (click customer → context panel)

> You are implementing in-world UI. When a customer sprite is clicked in `ShopScene`, open a contextual action menu in React.
> - Add a new EventBus message `ui:selectEntity` with payload `{ kind: 'customer', id: string }`.
> - In React, replace the “tabs only” flow with a right-side context panel that renders actions for the selected customer.
> - Actions must dispatch `SimAction` via `GameFacade.dispatch`.
> - Keep current battle flow working (battle-ready click should still allow starting a battle).
> - Add minimal UI state, no new dependencies.

### 3) Clickable shop elements (shelves/counter/decor)

> Turn shelves into clickable world objects (not list rows).
> - In `ShopScene`, render each shelf slot as a placed entity in the shop scene.
> - Add pointer interactions and emit `ui:selectEntity` with `{ kind: 'shelfSlot', index: number }`.
> - In React, show stock/unstock/clear actions in the context panel for the selected shelf slot.
> - Keep sim logic in `src/sim/shop.ts` and only add new `SimAction` types if truly required.

### 4) Tilemap shop layout + basic navigation

> Implement a tile-based shop scene.
> - Load a tileset from `public/assets/tiles/` and render a simple map.
> - Place shelves and a counter at fixed coordinates.
> - Spawn customers at an entrance, move them to a browse point, then to the exit (simple tween/lerp is OK; pathfinding can be later).
> - Keep the authoritative gameplay state in `src/sim/**`; Phaser should mirror entities based on snapshot + simple local movement.

### 5) Replace tabs with a cohesive HUD (fewer menus, more options)

> Refactor `src/App.tsx` UI.
> - Keep a top status bar (money/time/speed/level).
> - Replace most tabs with a single “Context” panel driven by selection (customer/shelf/shop).
> - Keep Deck/Skills accessible via small buttons or collapsible sections (avoid full-screen menus).
> - Preserve existing functionality (buy packs, stock shelves, battle, save/load).
> - Do not add external UI libraries.

### 6) Pack opening + card collection loop

> Add pack opening and collection.
> - Add sim support for “owned cards” and “open pack” results (data-driven rarity table).
> - Add a React pack-opening view with animation/flip (simple CSS transitions OK).
> - Keep the shop SKU system intact: buying packs adds sealed packs; opening consumes sealed packs and adds cards.
> - Add unit tests for rarity distribution and inventory changes.

### 7) Turn-based battle UI (build on existing resolver)

> Evolve battles from instant resolution into a turn-based loop.
> - Keep the current resolver as a fallback or “auto-resolve”.
> - Add sim state for an active battle: player hand, enemy intent, turn counter, statuses.
> - Add a React battle panel with hand UI, end turn, play card.
> - Add tests for battle state transitions.

