import type { ShopState } from './shop';

export type GamePhase = 'day' | 'night';

export type SimEvent =
    | {
          type: 'phaseChanged';
          from: GamePhase;
          to: GamePhase;
          dayNumber: number;
      }
    | {
          type: 'customerSpawned';
          customerId: string;
      }
    | {
          type: 'customerLeft';
          customerId: string;
      }
    | {
          type: 'saleCompleted';
          customerId: string;
          skuId: string;
          value: number;
          xp: number;
      }
    | {
          type: 'customerReadyToBuy';
          customerId: string;
      }
    | {
          type: 'challengeExpired';
          customerId: string;
      }
    | {
          type: 'battleResolved';
          customerId: string;
          result: 'win' | 'loss';
          moneyDelta: number;
          xpDelta: number;
      };

export type ClockState = {
    phase: GamePhase;
    timeInPhaseSeconds: number;
    dayNumber: number;
    phaseDurationSeconds: number;
};

export type ProgressionState = {
    level: number;
    xp: number;
    skillPoints: number;
};

export type UpgradesState = {
    speedTier: number; // 0..40
};

export type SkillsState = {
    unlocked: Record<string, boolean>;
};

export type EconomyState = {
    money: number;
};

export type CardTier = 1 | 2 | 3 | 4 | 5;

export type CardDefinition = {
    id: string;
    name: string;
    tier: CardTier;
    power: number;
};

export type DeckState = {
    cardIds: string[];
    maxSize: number;
};

export type CustomerIntent = 'buy' | 'challenge';
export type CustomerStatus = 'browsing' | 'readyToBuy' | 'waitingBattle' | 'leaving';

export type Customer = {
    id: string;
    name: string;
    tier: CardTier;
    intent: CustomerIntent;
    status: CustomerStatus;
    timeToDecisionSeconds: number;
    challengeExpiresInSeconds?: number;
};

export type CustomersState = {
    nextSpawnInSeconds: number;
    customers: Customer[];
    nextId: number;
};

export type GameState = {
    paused: boolean;
    clock: ClockState;
    progression: ProgressionState;
    upgrades: UpgradesState;
    skills: SkillsState;
    economy: EconomyState;
    shop: ShopState;
    deck: DeckState;
    customers: CustomersState;
    rngSeed: number;
};

export type SimSnapshot = {
    paused: boolean;
    phase: GamePhase;
    phaseTimeRemainingSeconds: number;
    dayNumber: number;
    money: number;
    speedMultiplier: number;
    speedTier: number;
    level: number;
    xp: number;
    xpToNext: number;
    skillPoints: number;
    unlockedCardTier: CardTier;
    customers: Array<
        Pick<Customer, 'id' | 'name' | 'tier' | 'intent' | 'status'> & {
            challengeExpiresInSeconds?: number;
        }
    >;
    shop: {
        backroom: Record<string, number>;
        shelves: {
            slots: Array<{
                skuId: string | null;
                quantity: number;
                capacity: number;
            }>;
        };
    };
    deck: DeckState;
};

export type SimSaveV1 = {
    schemaVersion: 1;
    savedAtIso: string;
    state: GameState;
};

export type SimSaveV2 = {
    schemaVersion: 2;
    savedAtIso: string;
    state: GameState;
};
