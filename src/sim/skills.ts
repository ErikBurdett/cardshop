import type { CardTier, SkillsState } from './types';

export type SkillId = 'unlockTier2Cards';

export type SkillDefinition = {
    id: SkillId;
    name: string;
    description: string;
    cost: number;
};

export const SKILLS: Record<SkillId, SkillDefinition> = {
    unlockTier2Cards: {
        id: 'unlockTier2Cards',
        name: 'Unlock Tier 2 Cards',
        description: 'Allows tier 2 cards to appear in packs and be added to your deck.',
        cost: 1,
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
    return isSkillUnlocked(skills, 'unlockTier2Cards') ? 2 : 1;
}
