import { describe, expect, test } from 'vitest';
import type { SimConfig } from './config';
import { maxSpeedTier, speedMultiplierForTier, speedTierCost } from './upgrades';

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

describe('speed upgrade', () => {
    test('increments by 0.05 and caps at 3.0x', () => {
        expect(maxSpeedTier(TEST_CONFIG)).toBe(40);
        expect(speedMultiplierForTier(0, TEST_CONFIG)).toBeCloseTo(1.0, 10);
        expect(speedMultiplierForTier(1, TEST_CONFIG)).toBeCloseTo(1.05, 10);
        expect(speedMultiplierForTier(40, TEST_CONFIG)).toBeCloseTo(3.0, 10);
        expect(speedMultiplierForTier(999, TEST_CONFIG)).toBeCloseTo(3.0, 10);

        for (let t = 0; t < 40; t += 1) {
            const a = speedMultiplierForTier(t, TEST_CONFIG);
            const b = speedMultiplierForTier(t + 1, TEST_CONFIG);
            expect(b - a).toBeCloseTo(0.05, 10);
        }
    });

    test('tier cost is monotonic increasing', () => {
        let prev = speedTierCost(0, TEST_CONFIG);
        for (let t = 1; t <= 40; t += 1) {
            const cur = speedTierCost(t, TEST_CONFIG);
            expect(cur).toBeGreaterThanOrEqual(prev);
            prev = cur;
        }
    });
});
