import type { ProgressionState } from './types';
import type { SimConfig } from './config';

export function xpToNext(level: number, config: SimConfig): number {
    const lvl = Math.max(1, Math.floor(level));
    const raw = config.progression.baseXpToNext * Math.pow(config.progression.xpGrowth, lvl - 1);
    return Math.max(1, Math.ceil(raw));
}

export function createInitialProgression(): ProgressionState {
    return {
        level: 1,
        xp: 0,
        skillPoints: 0,
    };
}

export function grantXp(
    progression: ProgressionState,
    amount: number,
    config: SimConfig,
): { progression: ProgressionState; leveledUp: number } {
    const gained = Math.max(0, amount);
    let level = progression.level;
    let xp = progression.xp + gained;
    let skillPoints = progression.skillPoints;
    let leveledUp = 0;

    while (xp >= xpToNext(level, config)) {
        xp -= xpToNext(level, config);
        level += 1;
        skillPoints += config.progression.skillPointsPerLevel;
        leveledUp += 1;
    }

    return { progression: { level, xp, skillPoints }, leveledUp };
}
