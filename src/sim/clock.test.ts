import { describe, expect, test } from 'vitest';
import { createInitialClock, tickClock } from './clock';
import type { SimConfig } from './config';

const TEST_CONFIG: SimConfig = {
    daySeconds: 10,
    nightSeconds: 3,
    maxDtSeconds: 1,
    customer: {
        daySpawnIntervalSeconds: 8,
        nightSpawnIntervalSeconds: 14,
        browseSecondsMin: 4,
        browseSecondsMax: 10,
        challengeChance: 0.25,
        challengeTimeoutSeconds: 20,
        saleValueMin: 4,
        saleValueMax: 12,
        xpPerSale: 2,
    },
    progression: { baseXpToNext: 20, xpGrowth: 1.18, skillPointsPerLevel: 1 },
    speedUpgrade: {
        baseSpeed: 1,
        tierIncrement: 0.05,
        capSpeed: 3,
        costBase: 25,
        costGrowth: 1.12,
    },
};

describe('clock', () => {
    test('transitions day -> night -> day', () => {
        const c0 = createInitialClock(TEST_CONFIG);
        expect(c0.phase).toBe('day');
        expect(c0.dayNumber).toBe(1);

        const t1 = tickClock(c0, 10, TEST_CONFIG);
        expect(t1.clock.phase).toBe('night');
        expect(t1.clock.timeInPhaseSeconds).toBe(0);
        expect(t1.events.map((e) => e.type)).toEqual(['phaseChanged']);
        expect(t1.events[0]).toMatchObject({
            type: 'phaseChanged',
            from: 'day',
            to: 'night',
            dayNumber: 1,
        });

        const t2 = tickClock(t1.clock, 3, TEST_CONFIG);
        expect(t2.clock.phase).toBe('day');
        expect(t2.clock.dayNumber).toBe(2);
        expect(t2.clock.timeInPhaseSeconds).toBe(0);
        expect(t2.events[0]).toMatchObject({
            type: 'phaseChanged',
            from: 'night',
            to: 'day',
            dayNumber: 2,
        });
    });

    test('handles multiple transitions in one tick', () => {
        const c0 = createInitialClock(TEST_CONFIG);
        const t = tickClock(c0, 13, TEST_CONFIG);
        expect(t.clock.phase).toBe('day');
        expect(t.clock.dayNumber).toBe(2);
        expect(t.events.filter((e) => e.type === 'phaseChanged')).toHaveLength(2);
        expect(t.events[0]).toMatchObject({
            type: 'phaseChanged',
            from: 'day',
            to: 'night',
            dayNumber: 1,
        });
        expect(t.events[1]).toMatchObject({
            type: 'phaseChanged',
            from: 'night',
            to: 'day',
            dayNumber: 2,
        });
    });
});
