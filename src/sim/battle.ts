import type { CardTier } from './types';
import { getCardById } from './cards/cards';
import { randIntInclusive } from './rng';

export type BattleResult = {
    result: 'win' | 'loss';
    moneyDelta: number;
    xpDelta: number;
    seed: number;
};

function deckPower(cardIds: string[]): number {
    let total = 0;
    for (const id of cardIds) {
        const c = getCardById(id);
        if (c) total += c.power;
    }
    return total;
}

export function customerDeckForTier(tier: CardTier): string[] {
    if (tier >= 2) return ['cleave', 'ward', 'strike', 'guard', 'spark'];
    return ['strike', 'guard', 'spark', 'guard', 'strike'];
}

export function resolveBattle(
    playerDeckCardIds: string[],
    customerTier: CardTier,
    seed: number,
): BattleResult {
    let s = seed;
    const playerBase = deckPower(playerDeckCardIds);
    const enemyBase = deckPower(customerDeckForTier(customerTier));

    // Small deterministic variance so battles aren't always identical.
    const { value: pVar, seed: s1 } = randIntInclusive(s, -2, 2);
    s = s1;
    const { value: eVar, seed: s2 } = randIntInclusive(s, -2, 2);
    s = s2;

    const playerScore = playerBase + pVar;
    const enemyScore = enemyBase + eVar + (customerTier - 1) * 2;
    const result: 'win' | 'loss' = playerScore >= enemyScore ? 'win' : 'loss';

    const moneyDelta = result === 'win' ? 10 * customerTier : 2 * customerTier;
    const xpDelta = result === 'win' ? 6 * customerTier : 2 * customerTier;

    return { result, moneyDelta, xpDelta, seed: s };
}
