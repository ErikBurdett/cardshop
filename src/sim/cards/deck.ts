import type { CardTier, DeckState } from '../types';
import { getCardById } from './cards';

export function createInitialDeck(): DeckState {
    return {
        // Starter deck: 5 tier-1 commons (matches initial collection in `createNewGameState`)
        cardIds: ['t1_c01', 't1_c01', 't1_c02', 't1_c03', 't1_c02'],
        maxSize: 20,
    };
}

export function canUseCardInDeck(cardId: string, unlockedTier: CardTier): boolean {
    const def = getCardById(cardId);
    if (!def) return false;
    return def.tier <= unlockedTier;
}

export function countCardInDeck(deck: DeckState, cardId: string): number {
    let n = 0;
    for (const id of deck.cardIds) if (id === cardId) n += 1;
    return n;
}

export function addCardToDeck(
    deck: DeckState,
    cardId: string,
    unlockedTier: CardTier,
    collectionCount: number,
): { deck: DeckState; ok: boolean; reason?: string } {
    if (deck.cardIds.length >= deck.maxSize) return { deck, ok: false, reason: 'Deck is full' };
    if (!canUseCardInDeck(cardId, unlockedTier))
        return { deck, ok: false, reason: 'Card tier is locked' };
    const alreadyInDeck = countCardInDeck(deck, cardId);
    if (alreadyInDeck >= collectionCount) return { deck, ok: false, reason: 'No owned copy' };
    return { deck: { ...deck, cardIds: [...deck.cardIds, cardId] }, ok: true };
}

export function removeCardFromDeck(deck: DeckState, index: number): DeckState {
    if (index < 0 || index >= deck.cardIds.length) return deck;
    const next = deck.cardIds.slice();
    next.splice(index, 1);
    return { ...deck, cardIds: next };
}
