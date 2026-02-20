export type SimConfig = {
    daySeconds: number;
    nightSeconds: number;
    maxDtSeconds: number;
    customer: {
        daySpawnIntervalSeconds: number;
        nightSpawnIntervalSeconds: number;
        browseSecondsMin: number;
        browseSecondsMax: number;
        challengeChance: number; // 0..1
        saleValueMin: number;
        saleValueMax: number;
        xpPerSale: number;
    };
    progression: {
        baseXpToNext: number;
        xpGrowth: number;
        skillPointsPerLevel: number;
    };
    speedUpgrade: {
        baseSpeed: number; // 1.0
        tierIncrement: number; // 0.05
        capSpeed: number; // 3.0
        costBase: number;
        costGrowth: number;
    };
};

export const SIM_CONFIG: SimConfig = {
    daySeconds: 300,
    nightSeconds: 60,
    maxDtSeconds: 0.25,
    customer: {
        daySpawnIntervalSeconds: 8,
        nightSpawnIntervalSeconds: 14,
        browseSecondsMin: 4,
        browseSecondsMax: 10,
        challengeChance: 0.25,
        saleValueMin: 4,
        saleValueMax: 12,
        xpPerSale: 2,
    },
    progression: {
        baseXpToNext: 20,
        xpGrowth: 1.18,
        skillPointsPerLevel: 1,
    },
    speedUpgrade: {
        baseSpeed: 1.0,
        tierIncrement: 0.05,
        capSpeed: 3.0,
        costBase: 25,
        costGrowth: 1.12,
    },
};
