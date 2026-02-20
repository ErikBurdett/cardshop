import type { SimConfig } from './config';
import type { UpgradesState } from './types';

export function maxSpeedTier(config: SimConfig): number {
    const tiers = Math.floor(
        (config.speedUpgrade.capSpeed - config.speedUpgrade.baseSpeed) /
            config.speedUpgrade.tierIncrement,
    );
    return Math.max(0, tiers);
}

export function speedMultiplierForTier(tier: number, config: SimConfig): number {
    const t = Math.max(0, Math.min(maxSpeedTier(config), Math.floor(tier)));
    const raw = config.speedUpgrade.baseSpeed + t * config.speedUpgrade.tierIncrement;
    return Math.min(config.speedUpgrade.capSpeed, raw);
}

export function speedTierCost(tier: number, config: SimConfig): number {
    const t = Math.max(0, Math.floor(tier));
    const raw = config.speedUpgrade.costBase * Math.pow(config.speedUpgrade.costGrowth, t);
    return Math.max(0, Math.ceil(raw));
}

export function createInitialUpgrades(): UpgradesState {
    return {
        speedTier: 0,
    };
}
