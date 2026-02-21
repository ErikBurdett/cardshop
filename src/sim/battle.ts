import type { CardTier } from './types';
import { getCardById } from './cards/cards';
import { randIntInclusive } from './rng';

export type BattleResult = {
    result: 'win' | 'loss';
    moneyDelta: number;
    xpDelta: number;
    seed: number;
};

function deckScore(cardIds: string[]): number {
    let attack = 0;
    let health = 0;
    for (const id of cardIds) {
        const c = getCardById(id);
        if (!c) continue;
        attack += c.attack;
        health += c.health;
    }
    // A light weighting to make attack matter a bit more.
    return attack * 1.15 + health;
}

export function resolveBattle(
    playerDeckCardIds: string[],
    customerTier: CardTier,
    customerDeckCardIds: string[],
    seed: number,
): BattleResult {
    let s = seed;
    const playerBase = deckScore(playerDeckCardIds);
    const enemyBase = deckScore(customerDeckCardIds);

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
