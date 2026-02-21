import type { CardTier, SkillsState } from './types';

export type SkillId =
    | 'unlockTier2Cards'
    | 'unlockTier3Cards'
    | 'unlockTier4Cards'
    | 'unlockTier5Cards'
    | 'unlockTier6Cards'
    | 'unlockTier7Cards'
    | 'unlockTier8Cards'
    | 'unlockTier9Cards';

export type SkillDefinition = {
    id: SkillId;
    name: string;
    description: string;
    cost: number;
    requires?: SkillId;
};

export const SKILLS: Record<SkillId, SkillDefinition> = {
    unlockTier2Cards: {
        id: 'unlockTier2Cards',
        name: 'Unlock Tier 2 Cards',
        description: 'Allows tier 2 cards to appear in packs and be added to your deck.',
        cost: 1,
    },
    unlockTier3Cards: {
        id: 'unlockTier3Cards',
        name: 'Unlock Tier 3 Cards',
        description: 'Allows tier 3 cards to appear in packs and be added to your deck.',
        cost: 1,
        requires: 'unlockTier2Cards',
    },
    unlockTier4Cards: {
        id: 'unlockTier4Cards',
        name: 'Unlock Tier 4 Cards',
        description: 'Allows tier 4 cards to appear in packs and be added to your deck.',
        cost: 2,
        requires: 'unlockTier3Cards',
    },
    unlockTier5Cards: {
        id: 'unlockTier5Cards',
        name: 'Unlock Tier 5 Cards',
        description: 'Allows tier 5 cards to appear in packs and be added to your deck.',
        cost: 2,
        requires: 'unlockTier4Cards',
    },
    unlockTier6Cards: {
        id: 'unlockTier6Cards',
        name: 'Unlock Tier 6 Cards',
        description: 'Allows tier 6 cards to appear in packs and be added to your deck.',
        cost: 3,
        requires: 'unlockTier5Cards',
    },
    unlockTier7Cards: {
        id: 'unlockTier7Cards',
        name: 'Unlock Tier 7 Cards',
        description: 'Allows tier 7 cards to appear in packs and be added to your deck.',
        cost: 3,
        requires: 'unlockTier6Cards',
    },
    unlockTier8Cards: {
        id: 'unlockTier8Cards',
        name: 'Unlock Tier 8 Cards',
        description: 'Allows tier 8 cards to appear in packs and be added to your deck.',
        cost: 4,
        requires: 'unlockTier7Cards',
    },
    unlockTier9Cards: {
        id: 'unlockTier9Cards',
        name: 'Unlock Tier 9 Cards',
        description: 'Allows tier 9 cards to appear in packs and be added to your deck.',
        cost: 5,
        requires: 'unlockTier8Cards',
    },
};

export function createInitialSkills(): SkillsState {
    return {
        unlocked: {},
    };
}

export function isSkillUnlocked(skills: SkillsState, id: SkillId): boolean {
    return skills.unlocked[id] === true;
}

export function unlockedCardTier(skills: SkillsState): CardTier {
    // Return the highest unlocked tier (linear chain).
    if (isSkillUnlocked(skills, 'unlockTier9Cards')) return 9;
    if (isSkillUnlocked(skills, 'unlockTier8Cards')) return 8;
    if (isSkillUnlocked(skills, 'unlockTier7Cards')) return 7;
    if (isSkillUnlocked(skills, 'unlockTier6Cards')) return 6;
    if (isSkillUnlocked(skills, 'unlockTier5Cards')) return 5;
    if (isSkillUnlocked(skills, 'unlockTier4Cards')) return 4;
    if (isSkillUnlocked(skills, 'unlockTier3Cards')) return 3;
    if (isSkillUnlocked(skills, 'unlockTier2Cards')) return 2;
    return 1;
}
