import type { CardDefinition, CardTier } from '../types';

export const CARDS: readonly CardDefinition[] = [
    { id: 'strike', name: 'Strike', tier: 1, power: 3 },
    { id: 'guard', name: 'Guard', tier: 1, power: 2 },
    { id: 'spark', name: 'Spark', tier: 1, power: 4 },
    { id: 'cleave', name: 'Cleave', tier: 2, power: 7 },
    { id: 'ward', name: 'Ward', tier: 2, power: 6 },
] as const;

export function getCardById(id: string): CardDefinition | undefined {
    return CARDS.find((c) => c.id === id);
}

export function highestTierInDeck(cardIds: string[]): CardTier {
    let highest: CardTier = 1;
    for (const id of cardIds) {
        const c = getCardById(id);
        if (c && c.tier > highest) highest = c.tier;
    }
    return highest;
}
