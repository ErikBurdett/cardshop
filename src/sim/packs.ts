import type { CardRarity, CardTier, GameState, SimEvent } from './types';
import type { SimConfig } from './config';
import { canAfford, spendMoney } from './economy';
import { cardsForTierAndRarity } from './cards/cards';
import { randIntInclusive } from './rng';

export type PlayerPackDefinition = {
    id: string;
    name: string;
    tier: CardTier;
    rarity: CardRarity;
    cost: number;
    cardsPerPack: number;
};

const RARITY_MULTIPLIER: Record<CardRarity, number> = {
    common: 1,
    uncommon: 2,
    rare: 4,
    epic: 7,
    legendary: 12,
};

function packCost(tier: CardTier, rarity: CardRarity): number {
    // Tuned to feel meaningful but reachable; can be moved into config later.
    const base = 6 + tier * tier * 2;
    return Math.ceil(base * RARITY_MULTIPLIER[rarity]);
}

export function getPlayerPackDefinitions(config: SimConfig): readonly PlayerPackDefinition[] {
    void config;
    const defs: PlayerPackDefinition[] = [];
    const rarities: CardRarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

    for (let t = 1 as CardTier; t <= 9; t = (t + 1) as CardTier) {
        for (const r of rarities) {
            defs.push({
                id: `playerPack_t${t}_${r}`,
                name: `Pack (T${t} • ${r})`,
                tier: t,
                rarity: r,
                cost: packCost(t, r),
                cardsPerPack: 8,
            });
        }
    }

    return defs;
}

export function getPlayerPackById(id: string, config: SimConfig): PlayerPackDefinition | undefined {
    return getPlayerPackDefinitions(config).find((d) => d.id === id);
}

export function buyPlayerPacks(
    state: GameState,
    packId: string,
    quantity: number,
    config: SimConfig,
): { ok: true; state: GameState } | { ok: false; reason: string } {
    const def = getPlayerPackById(packId, config);
    if (!def) return { ok: false, reason: 'unknown_pack' };
    const qty = Math.floor(quantity);
    if (qty <= 0) return { ok: false, reason: 'invalid_quantity' };

    const total = def.cost * qty;
    if (!canAfford(state.economy, total)) return { ok: false, reason: 'insufficient_funds' };

    return {
        ok: true,
        state: {
            ...state,
            economy: spendMoney(state.economy, total),
            sealedPacks: { ...state.sealedPacks, [packId]: (state.sealedPacks[packId] ?? 0) + qty },
        },
    };
}

export function openPlayerPack(
    state: GameState,
    packId: string,
    config: SimConfig,
): { ok: true; state: GameState; events: SimEvent[] } | { ok: false; reason: string } {
    const def = getPlayerPackById(packId, config);
    if (!def) return { ok: false, reason: 'unknown_pack' };
    const available = state.sealedPacks[packId] ?? 0;
    if (available <= 0) return { ok: false, reason: 'no_packs' };

    const pool = cardsForTierAndRarity(def.tier, def.rarity);
    if (pool.length === 0) return { ok: false, reason: 'empty_pool' };

    let s = state.rngSeed;
    const opened: Array<{ cardId: string; attack: number; health: number; rarity: CardRarity }> =
        [];
    const nextCollection = { ...state.collection };

    for (let i = 0; i < def.cardsPerPack; i += 1) {
        const { value: idx, seed } = randIntInclusive(s, 0, pool.length - 1);
        s = seed;
        const safeIdx = idx < 0 || idx >= pool.length ? 0 : idx;
        const card = pool[safeIdx]!;
        opened.push({
            cardId: card.id,
            attack: card.attack,
            health: card.health,
            rarity: card.rarity,
        });
        nextCollection[card.id] = (nextCollection[card.id] ?? 0) + 1;
    }

    const nextSealed = { ...state.sealedPacks, [packId]: available - 1 };

    const events: SimEvent[] = [
        {
            type: 'packOpened',
            packId,
            tier: def.tier,
            rarity: def.rarity,
            cards: opened,
        },
    ];

    return {
        ok: true,
        state: {
            ...state,
            rngSeed: s,
            sealedPacks: nextSealed,
            collection: nextCollection,
        },
        events,
    };
}
