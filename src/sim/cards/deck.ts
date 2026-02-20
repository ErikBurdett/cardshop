import type { CardTier, DeckState } from '../types';
import { getCardById } from './cards';

export function createInitialDeck(): DeckState {
    return {
        cardIds: ['strike', 'strike', 'guard', 'spark', 'guard'],
        maxSize: 20,
    };
}

export function canUseCardInDeck(cardId: string, unlockedTier: CardTier): boolean {
    const def = getCardById(cardId);
    if (!def) return false;
    return def.tier <= unlockedTier;
}

export function addCardToDeck(
    deck: DeckState,
    cardId: string,
    unlockedTier: CardTier,
): { deck: DeckState; ok: boolean; reason?: string } {
    if (deck.cardIds.length >= deck.maxSize) return { deck, ok: false, reason: 'Deck is full' };
    if (!canUseCardInDeck(cardId, unlockedTier))
        return { deck, ok: false, reason: 'Card tier is locked' };
    return { deck: { ...deck, cardIds: [...deck.cardIds, cardId] }, ok: true };
}

export function removeCardFromDeck(deck: DeckState, index: number): DeckState {
    if (index < 0 || index >= deck.cardIds.length) return deck;
    const next = deck.cardIds.slice();
    next.splice(index, 1);
    return { ...deck, cardIds: next };
}
