## Game-stopper bug: Day never starts / customers never spawn

### Symptom

- The game loads, but the **day clock never advances** and **customers never appear**.
- Console repeatedly logs a Phaser update error originating from the sim customer spawner, e.g.:
    - `TypeError: Cannot read properties of undefined (reading 'id')`
    - stack: `buildCustomerDeck -> spawnOne -> tickCustomers -> SimGame.tick -> ShopScene.update`

### Root cause

This was caused by **invalid numeric values** (most commonly `NaN`) inside a previously saved localStorage state.

Two failure modes were observed:

1. **Clock/day number corruption**

- A corrupted save could contain `clock.dayNumber = NaN`.
- That propagated into `chooseCustomerTier(dayNumber)` which then produced a `tier = NaN`.
- `cardsForTierAndRarity(NaN, ...)` returns an empty pool, and NPC deck generation crashed.

2. **Customer spawn timer corruption**

- A corrupted save could contain `customers.nextSpawnInSeconds = NaN`.
- The spawner does: `nextSpawnInSeconds = state.nextSpawnInSeconds - dt`
- If it becomes `NaN`, the spawn condition (`<= 0`) never triggers and customers never spawn.

Once the sim throws inside `ShopScene.update`, the scene catches and continues the render loop, but **the sim tick is effectively stuck** (no advancing time / no spawns).

### Fix

We hardened the system in three layers:

1. **Persistence normalization (primary defense)**

- `src/sim/persistence.ts` now normalizes any loaded save state (including schema v3) before it is used:
    - Ensures `clock.dayNumber`, `clock.timeInPhaseSeconds`, and customer spawn timers are **finite**.
    - Repairs invalid values and respawns customers (customers are treated as ephemeral).

2. **Runtime guards in sim clock and customer spawner (secondary defense)**

- `src/sim/clock.ts` now ignores non-finite clock fields and derives duration from config.
- `src/sim/customers.ts` now:
    - treats non-finite `dayNumber` as day 1
    - treats non-finite `nextSpawnInSeconds` as the configured spawn interval
    - makes NPC deck generation resilient (never throws, even if pools are empty)

3. **Regression tests**

- Added unit tests to ensure:
    - a v3 save with `NaN` values is normalized on load
    - customer spawning is robust to `NaN` timers / `NaN` dayNumber

### Future-proofing checklist

When adding new sim fields that affect ticking (timers, counters, costs, etc.):

- Add them to the **save normalization** step (`src/sim/persistence.ts`)
- Add **runtime guards** around any arithmetic that could become `NaN`
- Add a **unit test** that loads a deliberately corrupted save and verifies the sim still ticks
