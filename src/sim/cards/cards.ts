import type { CardDefinition, CardRarity, CardTier } from '../types';

const RARITY_COUNTS: Array<{ rarity: CardRarity; count: number; code: string }> = [
    { rarity: 'common', count: 20, code: 'c' },
    { rarity: 'uncommon', count: 10, code: 'u' },
    { rarity: 'rare', count: 6, code: 'r' },
    { rarity: 'epic', count: 3, code: 'e' },
    { rarity: 'legendary', count: 1, code: 'l' },
];

const ADJ = [
    'Ashen',
    'Bright',
    'Cinder',
    'Dawn',
    'Ebon',
    'Frost',
    'Gilded',
    'Hollow',
    'Iron',
    'Jade',
    'Keen',
    'Lunar',
    'Moss',
    'Nova',
    'Oaken',
    'Pale',
    'Quiet',
    'Riven',
    'Sable',
    'Thorn',
    'Umbral',
    'Verdant',
    'Wild',
    'Zephyr',
];

const NOUN = [
    'Blade',
    'Shield',
    'Spark',
    'Ward',
    'Cleave',
    'Bolt',
    'Oath',
    'Charm',
    'Rune',
    'Echo',
    'Vow',
    'Sigil',
    'Fang',
    'Crown',
    'Lantern',
    'Talisman',
    'Beacon',
    'Gambit',
    'Aegis',
    'Strike',
];

function tierName(tier: CardTier): string {
    return `T${tier}`;
}

function rarityLabel(r: CardRarity): string {
    switch (r) {
        case 'common':
            return 'Common';
        case 'uncommon':
            return 'Uncommon';
        case 'rare':
            return 'Rare';
        case 'epic':
            return 'Epic';
        case 'legendary':
            return 'Legendary';
        default: {
            const _exhaustive: never = r;
            return String(_exhaustive);
        }
    }
}

function rarityBonus(r: CardRarity): number {
    switch (r) {
        case 'common':
            return 0;
        case 'uncommon':
            return 2;
        case 'rare':
            return 5;
        case 'epic':
            return 9;
        case 'legendary':
            return 14;
        default: {
            const _exhaustive: never = r;
            return Number(_exhaustive);
        }
    }
}

function makeId(tier: CardTier, rarityCode: string, index1: number): string {
    return `t${tier}_${rarityCode}${String(index1).padStart(2, '0')}`;
}

function generateCards(): CardDefinition[] {
    const cards: CardDefinition[] = [];

    for (let t = 1 as CardTier; t <= 9; t = (t + 1) as CardTier) {
        let seedIndex = 0;
        for (const { rarity, count, code } of RARITY_COUNTS) {
            for (let i = 1; i <= count; i += 1) {
                const id = makeId(t, code, i);
                const adj = ADJ[(seedIndex + t * 3) % ADJ.length]!;
                const noun = NOUN[(seedIndex * 2 + t * 5) % NOUN.length]!;
                seedIndex += 1;

                // Stats scale by tier and rarity.
                const base = 2 + t * 3;
                const bonus = rarityBonus(rarity);
                const wobbleA = (i % 4) - 1; // -1..2
                const wobbleH = ((i * 3) % 5) - 2; // -2..2
                const attack = Math.max(1, base + bonus + wobbleA);
                const health = Math.max(1, base + bonus + wobbleH + 2);

                cards.push({
                    id,
                    name: `${rarityLabel(rarity)} ${adj} ${noun} (${tierName(t)})`,
                    tier: t,
                    rarity,
                    attack,
                    health,
                });
            }
        }
    }

    return cards;
}

export const CARDS: readonly CardDefinition[] = generateCards();
export const CARD_BY_ID: ReadonlyMap<string, CardDefinition> = new Map(CARDS.map((c) => [c.id, c]));

export function getCardById(id: string): CardDefinition | undefined {
    return CARD_BY_ID.get(id);
}

export function cardsForTierAndRarity(tier: CardTier, rarity: CardRarity): CardDefinition[] {
    // Used in pack opening and NPC deck generation; keep fast enough (360 cards total).
    return CARDS.filter((c) => c.tier === tier && c.rarity === rarity);
}

export function highestTierInDeck(cardIds: string[]): CardTier {
    let highest: CardTier = 1;
    for (const id of cardIds) {
        const c = getCardById(id);
        if (c && c.tier > highest) highest = c.tier;
    }
    return highest;
}
