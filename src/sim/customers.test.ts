import { describe, expect, test } from 'vitest';
import { SIM_CONFIG } from './config';
import { createInitialCustomers, tickCustomers } from './customers';

describe('customers', () => {
    test('spawning is robust to NaN timers and NaN dayNumber', () => {
        const s0 = createInitialCustomers(SIM_CONFIG);
        const broken = { ...s0, nextSpawnInSeconds: Number.NaN };

        expect(() => {
            tickCustomers(broken, 0.1, 'day', Number.NaN, SIM_CONFIG, 123);
        }).not.toThrow();

        const res = tickCustomers(broken, 1, 'day', Number.NaN, SIM_CONFIG, 123);
        // nextSpawnInSeconds may still be >0 (spawn includes jitter), but should be finite.
        expect(Number.isFinite(res.state.nextSpawnInSeconds)).toBe(true);

        // Force a spawn.
        const res2 = tickCustomers(
            { ...res.state, nextSpawnInSeconds: 0 },
            0.1,
            'day',
            1,
            SIM_CONFIG,
            res.seed,
        );
        expect(res2.state.customers.length).toBe(1);
        expect(res2.state.customers[0]!.deckCardIds.length).toBeGreaterThan(0);
    });
});
