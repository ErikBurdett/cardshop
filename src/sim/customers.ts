import type { GamePhase, SimEvent, CustomersState, Customer, CardTier } from './types';
import type { SimConfig } from './config';
import { randFloat01, randIntInclusive, randRange } from './rng';

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
    // MVP: tier 1 customers for a while, then slowly introduce tier 2
    return dayNumber >= 3 ? 2 : 1;
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
    const customer: Customer = {
        id,
        name: NAMES[nameIndex],
        tier: chooseCustomerTier(dayNumber),
        intent,
        status,
        timeToDecisionSeconds: browseSeconds,
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
    let nextSpawnInSeconds = state.nextSpawnInSeconds - dtSimSeconds;
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
            nextCustomers.push(c);
            continue;
        }

        if (c.status === 'browsing') {
            const t = c.timeToDecisionSeconds - dtSimSeconds;
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
                });
                continue;
            }

            // Buying completes immediately in MVP.
            const { value: value, seed: s1 } = randIntInclusive(
                s,
                config.customer.saleValueMin,
                config.customer.saleValueMax,
            );
            s = s1;

            events.push({
                type: 'saleCompleted',
                customerId: c.id,
                value,
                xp: config.customer.xpPerSale,
            });
            events.push({ type: 'customerLeft', customerId: c.id });
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
