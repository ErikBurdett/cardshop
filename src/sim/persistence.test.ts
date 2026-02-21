import { describe, expect, test } from 'vitest';
import { SIM_CONFIG } from './config';
import { createNewGameState } from './game';
import { loadFromStorage, SAVE_KEY } from './persistence';

function makeStorage(initial: Record<string, string> = {}) {
    const store = { ...initial };
    return {
        getItem: (k: string) => store[k] ?? null,
        setItem: (k: string, v: string) => {
            store[k] = v;
        },
        removeItem: (k: string) => {
            delete store[k];
        },
    };
}

describe('persistence migration', () => {
    test('v2 save migrates starter card ids and adds collection', () => {
        const base = createNewGameState(SIM_CONFIG, 1);

        const v2Save = {
            schemaVersion: 2,
            savedAtIso: new Date().toISOString(),
            state: {
                ...base,
                // Pretend this was the old deck / no collection fields in schema v2
                deck: { ...base.deck, cardIds: ['strike', 'guard', 'spark'] },
                sealedPacks: undefined,
                collection: undefined,
            },
        } as unknown;

        const storage = makeStorage({ [SAVE_KEY]: JSON.stringify(v2Save) });
        const loaded = loadFromStorage(storage, SAVE_KEY);
        expect(loaded.ok).toBe(true);
        if (!loaded.ok) return;

        expect(loaded.state.deck.cardIds).toEqual(['t1_c01', 't1_c02', 't1_c03']);
        expect(Object.keys(loaded.state.collection).length).toBeGreaterThan(0);
        expect(loaded.state.sealedPacks).toBeTruthy();
        expect(loaded.state.customers.customers.length).toBe(0);
    });

    test('v3 save with NaN clock/customer timers is normalized', () => {
        const base = createNewGameState(SIM_CONFIG, 1);
        const broken = {
            schemaVersion: 3,
            savedAtIso: new Date().toISOString(),
            state: {
                ...base,
                clock: { ...base.clock, dayNumber: Number.NaN, timeInPhaseSeconds: Number.NaN },
                customers: { ...base.customers, nextSpawnInSeconds: Number.NaN },
            },
        };

        const storage = makeStorage({ [SAVE_KEY]: JSON.stringify(broken) });
        const loaded = loadFromStorage(storage, SAVE_KEY);
        expect(loaded.ok).toBe(true);
        if (!loaded.ok) return;

        expect(Number.isFinite(loaded.state.clock.dayNumber)).toBe(true);
        expect(Number.isFinite(loaded.state.clock.timeInPhaseSeconds)).toBe(true);
        expect(Number.isFinite(loaded.state.customers.nextSpawnInSeconds)).toBe(true);
        expect(loaded.state.clock.dayNumber).toBeGreaterThanOrEqual(1);
    });
});
