import { describe, expect, test } from 'vitest';
import type { SimConfig } from './config';
import { createInitialProgression, grantXp, xpToNext } from './progression';

const TEST_CONFIG: SimConfig = {
    daySeconds: 300,
    nightSeconds: 60,
    maxDtSeconds: 0.25,
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
        baseSpeed: 1.0,
        tierIncrement: 0.05,
        capSpeed: 3.0,
        costBase: 25,
        costGrowth: 1.12,
    },
};

describe('progression', () => {
    test('xpToNext is monotonic', () => {
        let prev = xpToNext(1, TEST_CONFIG);
        for (let lvl = 2; lvl <= 50; lvl += 1) {
            const cur = xpToNext(lvl, TEST_CONFIG);
            expect(cur).toBeGreaterThanOrEqual(prev);
            prev = cur;
        }
    });

    test('level-ups grant skill points', () => {
        const p0 = createInitialProgression();
        const need = xpToNext(p0.level, TEST_CONFIG);
        const res = grantXp(p0, need + 1, TEST_CONFIG);

        expect(res.progression.level).toBe(2);
        expect(res.progression.skillPoints).toBe(1);
        expect(res.leveledUp).toBe(1);
        expect(res.progression.xp).toBe(1);
    });
});
