import type { EconomyState } from './types';

export function createInitialEconomy(): EconomyState {
    // Seed money so the player can immediately buy and stock packs.
    return { money: 50 };
}

export function addMoney(economy: EconomyState, amount: number): EconomyState {
    const delta = Math.max(0, amount);
    return { money: economy.money + delta };
}

export function canAfford(economy: EconomyState, cost: number): boolean {
    return economy.money >= Math.max(0, cost);
}

export function spendMoney(economy: EconomyState, cost: number): EconomyState {
    const c = Math.max(0, cost);
    return { money: Math.max(0, economy.money - c) };
}
