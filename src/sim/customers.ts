import type { CardRarity, CardTier, Customer, CustomersState, GamePhase, SimEvent } from './types';
import type { SimConfig } from './config';
import { randFloat01, randIntInclusive, randRange } from './rng';
import { cardsForTierAndRarity } from './cards/cards';

const NAMES = ['Ari', 'Bea', 'Cato', 'Dax', 'Eli', 'Fae', 'Gus', 'Hana', 'Ivo', 'Juno'] as const;

export function createInitialCustomers(config: SimConfig): CustomersState {
    return {
        nextSpawnInSeconds: config.customer.daySpawnIntervalSeconds,
        customers: [],
        nextId: 1,
    };
}

function spawnIntervalSeconds(phase: GamePhase, config: SimConfig): number {
    return phase === 'day'
        ? config.customer.daySpawnIntervalSeconds
        : config.customer.nightSpawnIntervalSeconds;
}

function chooseCustomerTier(dayNumber: number): CardTier {
    const safeDay = Number.isFinite(dayNumber) ? dayNumber : 1;
    // Simple ramp: slowly introduce higher tiers as days pass.
    // Day 1-2: T1, day 3-4: up to T2, ... clamps at T9.
    const t = 1 + Math.floor((Math.max(1, safeDay) - 1) / 2);
    return Math.max(1, Math.min(9, t)) as CardTier;
}

function chooseRarity(seed: number): { rarity: CardRarity; seed: number } {
    // Weighted rarity distribution for NPC decks.
    // common 60%, uncommon 25%, rare 10%, epic 4%, legendary 1%
    const { value: r01, seed: s1 } = randFloat01(seed);
    const r = r01 * 100;
    if (r < 60) return { rarity: 'common', seed: s1 };
    if (r < 85) return { rarity: 'uncommon', seed: s1 };
    if (r < 95) return { rarity: 'rare', seed: s1 };
    if (r < 99) return { rarity: 'epic', seed: s1 };
    return { rarity: 'legendary', seed: s1 };
}

function buildCustomerDeck(tier: CardTier, seed: number): { deckCardIds: string[]; seed: number } {
    let s = seed;
    const deck: string[] = [];

    for (let i = 0; i < 10; i += 1) {
        const roll = chooseRarity(s);
        s = roll.seed;

        const preferred = cardsForTierAndRarity(tier, roll.rarity);
        const common = cardsForTierAndRarity(tier, 'common');
        const fallbackCommonT1 = cardsForTierAndRarity(1 as CardTier, 'common');
        const pool =
            preferred.length > 0 ? preferred : common.length > 0 ? common : fallbackCommonT1;

        // If somehow no cards are available (should never happen), fall back to a known starter id.
        const safeMax = Math.max(0, pool.length - 1);
        const { value: idx, seed: s2 } = randIntInclusive(s, 0, safeMax);
        s = s2;
        deck.push(pool[idx]?.id ?? 't1_c01');
    }

    return { deckCardIds: deck, seed: s };
}

function spawnOne(
    state: CustomersState,
    phase: GamePhase,
    dayNumber: number,
    config: SimConfig,
    seed: number,
): { state: CustomersState; seed: number; events: SimEvent[] } {
    const events: SimEvent[] = [];

    let s = seed;
    const { value: nameIndex, seed: s1 } = randIntInclusive(s, 0, NAMES.length - 1);
    s = s1;

    const { value: intentRoll, seed: s2 } = randFloat01(s);
    s = s2;

    const intent = intentRoll < config.customer.challengeChance ? 'challenge' : 'buy';
    const status = 'browsing';

    const { value: browseSeconds, seed: s3 } = randRange(
        s,
        config.customer.browseSecondsMin,
        config.customer.browseSecondsMax,
    );
    s = s3;

    const id = String(state.nextId);
    const tier = chooseCustomerTier(dayNumber);
    const { deckCardIds, seed: sDeck } = buildCustomerDeck(tier, s);
    s = sDeck;
    const customer: Customer = {
        id,
        name: NAMES[nameIndex],
        tier,
        intent,
        status,
        timeToDecisionSeconds: browseSeconds,
        deckCardIds,
    };

    events.push({ type: 'customerSpawned', customerId: id });

    const interval = spawnIntervalSeconds(phase, config);
    const { value: jitterMs, seed: s4 } = randIntInclusive(s, -800, 800);
    s = s4;
    const jitter = jitterMs / 1000;

    return {
        state: {
            ...state,
            nextSpawnInSeconds: Math.max(0.5, interval + jitter),
            customers: [...state.customers, customer].slice(-20),
            nextId: state.nextId + 1,
        },
        seed: s,
        events,
    };
}

export function tickCustomers(
    state: CustomersState,
    dtSimSeconds: number,
    phase: GamePhase,
    dayNumber: number,
    config: SimConfig,
    seed: number,
): { state: CustomersState; seed: number; events: SimEvent[] } {
    let s = seed;
    const events: SimEvent[] = [];

    // Spawn loop (dt is clamped, so usually spawns at most 1)
    const baseSpawn = Number.isFinite(state.nextSpawnInSeconds)
        ? state.nextSpawnInSeconds
        : spawnIntervalSeconds(phase, config);
    const dt = Number.isFinite(dtSimSeconds) ? dtSimSeconds : 0;
    let nextSpawnInSeconds = baseSpawn - dt;
    let customers = state.customers;
    let nextId = state.nextId;

    if (nextSpawnInSeconds <= 0) {
        const spawned = spawnOne(
            { nextSpawnInSeconds: 0, customers, nextId },
            phase,
            dayNumber,
            config,
            s,
        );
        s = spawned.seed;
        events.push(...spawned.events);
        nextSpawnInSeconds = spawned.state.nextSpawnInSeconds;
        customers = spawned.state.customers;
        nextId = spawned.state.nextId;
    }

    // Customer behavior
    const nextCustomers: Customer[] = [];
    for (const c of customers) {
        if (c.status === 'waitingBattle') {
            const remaining =
                (c.challengeExpiresInSeconds ?? config.customer.challengeTimeoutSeconds) - dt;
            if (remaining > 0) {
                nextCustomers.push({ ...c, challengeExpiresInSeconds: remaining });
            } else {
                events.push({ type: 'challengeExpired', customerId: c.id });
                events.push({ type: 'customerLeft', customerId: c.id });
            }
            continue;
        }

        if (c.status === 'browsing') {
            const t = c.timeToDecisionSeconds - dt;
            if (t > 0) {
                nextCustomers.push({ ...c, timeToDecisionSeconds: t });
                continue;
            }

            // Decision reached.
            if (c.intent === 'challenge') {
                nextCustomers.push({
                    ...c,
                    status: 'waitingBattle',
                    timeToDecisionSeconds: 0,
                    challengeExpiresInSeconds: config.customer.challengeTimeoutSeconds,
                });
                continue;
            }

            // Customer is ready to buy; actual sale resolution happens in the shop layer.
            nextCustomers.push({
                ...c,
                status: 'readyToBuy',
                timeToDecisionSeconds: 0,
            });
            events.push({ type: 'customerReadyToBuy', customerId: c.id });
            continue;
        }

        // Any other status leaves (future-proof)
        nextCustomers.push(c);
    }

    return {
        state: {
            nextSpawnInSeconds,
            customers: nextCustomers,
            nextId,
        },
        seed: s,
        events,
    };
}
