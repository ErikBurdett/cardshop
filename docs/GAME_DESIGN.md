## Game Design (MVP)

This is a base **Card Shop Management Simulator / Idle Game** with:

- A **day / night cycle**
- **Customers** who buy items or challenge you
- **Battles** (minimal deterministic-ish resolution)
- **XP → levels → skill points**
- **Unlock gates** (e.g. tier 2 cards)
- A purchasable **game speed modulator** upgrade up to 3.0x
- **Deck building**

### Core loop

- The game starts in **DAY immediately** (auto-start).
- While the sim clock runs:
    - Customers spawn, browse, and either:
        - **buy** (generates money + XP), then leave
        - become **battle-ready**, allowing the player to initiate a battle
- When DAY ends, the clock transitions to **NIGHT** (shorter than day).
    - Customers still spawn (slower) and can still buy or be battled.
    - The game **autosaves at night start**.
- NIGHT ends and transitions back to DAY (day number increments).

### Day / night timing

Configured in `src/sim/config.ts`:

- **Day duration**: `daySeconds = 300`
- **Night duration**: `nightSeconds = 60`
- Spawn pacing differs for day vs night.

### Pause / resume

- Pause freezes **sim time** (clock + customers + sales).
- UI remains responsive and can still issue actions.

### Progression (XP / levels / skill points)

- XP is earned via:
    - Shop sales (MVP)
    - Battles (MVP)
- Level-ups:
    - Increase `level`
    - Grant `skillPoints`
- `xpToNext(level)` is monotonic and configurable (see `src/sim/progression.ts`).

### Unlock gates

MVP includes at least one gated feature:

- **Tier 2 cards** are locked until the player unlocks the skill:
    - Skill: `unlockTier2Cards` (cost: 1 SP)
    - After unlocking, deck building can include tier 2 cards.

### Speed modulator upgrade

The speed upgrade affects the simulation tick rate (dt multiplier).

- **Speed tier**: integer `0..40`
- **Speed multiplier**:
    - `speed = 1.0 + tier * 0.05`
    - capped at **3.0x**
- **Purchase cost** (configurable monotonic formula):
    - `cost(tier) = ceil(baseCost * growth^tier)`
    - First purchase is `tier=0`
- Tuning constants live in `src/sim/config.ts`.

### Deck building

- The player deck is a list of card IDs with a max size.
- Cards have tiers; deck edits are restricted by current unlock tier.

### Battles

MVP battle behavior:

- Player initiates a battle against a **battle-ready** customer.
- Battle resolves instantly (turn-based UI is a TODO).
- Result grants money + XP.

### TODO roadmap (high-level)

- Packs: card acquisition, rarity tables, pity, pack UX
- More skills: decor slots, shop size, spawn rate, battle perks
- Decor / customization affecting stats and sales
- Battle UI: turn order, hands, energy, status effects
- More customer archetypes, decks, and behaviors
- Balance pass + difficulty curve across days
