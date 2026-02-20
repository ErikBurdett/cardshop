import { SIM_CONFIG, type SimConfig } from './config';
import { createInitialClock, getPhaseTimeRemainingSeconds, tickClock } from './clock';
import { createInitialEconomy, addMoney, canAfford, spendMoney } from './economy';
import { grantXp, createInitialProgression, xpToNext } from './progression';
import {
    createInitialUpgrades,
    maxSpeedTier,
    speedMultiplierForTier,
    speedTierCost,
} from './upgrades';
import { createInitialCustomers, tickCustomers } from './customers';
import { createInitialDeck, addCardToDeck, removeCardFromDeck } from './cards/deck';
import {
    createInitialSkills,
    isSkillUnlocked,
    SKILLS,
    type SkillId,
    unlockedCardTier,
} from './skills';
import { resolveBattle } from './battle';
import type { GameState, SimEvent, SimSnapshot } from './types';

export type SimAction =
    | { type: 'newGame'; seed?: number }
    | { type: 'togglePause' }
    | { type: 'purchaseSpeedTier' }
    | { type: 'unlockSkill'; skillId: SkillId }
    | { type: 'startBattle'; customerId: string }
    | { type: 'deckAddCard'; cardId: string }
    | { type: 'deckRemoveCard'; index: number };

export function createNewGameState(
    config: SimConfig = SIM_CONFIG,
    seed: number = 12345,
): GameState {
    return {
        paused: false,
        clock: createInitialClock(config),
        progression: createInitialProgression(),
        upgrades: createInitialUpgrades(),
        skills: createInitialSkills(),
        economy: createInitialEconomy(),
        deck: createInitialDeck(),
        customers: createInitialCustomers(config),
        rngSeed: seed,
    };
}

export class SimGame {
    private config: SimConfig;
    state: GameState;

    constructor(config: SimConfig = SIM_CONFIG, seed?: number) {
        this.config = config;
        this.state = createNewGameState(config, seed ?? 12345);
    }

    getSpeedMultiplier(): number {
        return speedMultiplierForTier(this.state.upgrades.speedTier, this.config);
    }

    tick(dtRealSeconds: number): SimEvent[] {
        if (this.state.paused) return [];

        const dt = Math.min(this.config.maxDtSeconds, Math.max(0, dtRealSeconds));
        const dtSim = dt * this.getSpeedMultiplier();

        const clockTick = tickClock(this.state.clock, dtSim, this.config);
        let nextState: GameState = { ...this.state, clock: clockTick.clock };

        const custTick = tickCustomers(
            nextState.customers,
            dtSim,
            nextState.clock.phase,
            nextState.clock.dayNumber,
            this.config,
            nextState.rngSeed,
        );
        nextState = { ...nextState, customers: custTick.state, rngSeed: custTick.seed };

        const events: SimEvent[] = [...clockTick.events, ...custTick.events];

        // Apply sale outcomes to economy + progression
        for (const e of custTick.events) {
            if (e.type !== 'saleCompleted') continue;
            nextState = {
                ...nextState,
                economy: addMoney(nextState.economy, e.value),
            };
            nextState = {
                ...nextState,
                progression: grantXp(nextState.progression, e.xp, this.config).progression,
            };
        }

        this.state = nextState;
        return events;
    }

    dispatch(action: SimAction): { ok: boolean; events?: SimEvent[]; reason?: string } {
        switch (action.type) {
            case 'newGame': {
                this.state = createNewGameState(this.config, action.seed ?? 12345);
                return { ok: true };
            }
            case 'togglePause': {
                this.state = { ...this.state, paused: !this.state.paused };
                return { ok: true };
            }
            case 'purchaseSpeedTier': {
                const tier = this.state.upgrades.speedTier;
                if (tier >= maxSpeedTier(this.config)) return { ok: false, reason: 'max_tier' };
                const cost = speedTierCost(tier, this.config);
                if (!canAfford(this.state.economy, cost))
                    return { ok: false, reason: 'insufficient_funds' };
                this.state = {
                    ...this.state,
                    economy: spendMoney(this.state.economy, cost),
                    upgrades: { ...this.state.upgrades, speedTier: tier + 1 },
                };
                return { ok: true };
            }
            case 'unlockSkill': {
                const def = SKILLS[action.skillId];
                if (!def) return { ok: false, reason: 'unknown_skill' };
                if (isSkillUnlocked(this.state.skills, action.skillId))
                    return { ok: false, reason: 'already_unlocked' };
                if (this.state.progression.skillPoints < def.cost)
                    return { ok: false, reason: 'insufficient_skill_points' };
                this.state = {
                    ...this.state,
                    progression: {
                        ...this.state.progression,
                        skillPoints: this.state.progression.skillPoints - def.cost,
                    },
                    skills: {
                        ...this.state.skills,
                        unlocked: { ...this.state.skills.unlocked, [action.skillId]: true },
                    },
                };
                return { ok: true };
            }
            case 'startBattle': {
                const idx = this.state.customers.customers.findIndex(
                    (c) => c.id === action.customerId,
                );
                if (idx < 0) return { ok: false, reason: 'missing_customer' };
                const customer = this.state.customers.customers[idx];
                if (customer.status !== 'waitingBattle') return { ok: false, reason: 'not_ready' };

                const result = resolveBattle(
                    this.state.deck.cardIds,
                    customer.tier,
                    this.state.rngSeed,
                );
                const { progression } = grantXp(
                    this.state.progression,
                    result.xpDelta,
                    this.config,
                );
                const economy = addMoney(this.state.economy, result.moneyDelta);

                const nextCustomers = this.state.customers.customers.slice();
                nextCustomers.splice(idx, 1);

                this.state = {
                    ...this.state,
                    rngSeed: result.seed,
                    progression,
                    economy,
                    customers: { ...this.state.customers, customers: nextCustomers },
                };

                const events: SimEvent[] = [
                    {
                        type: 'battleResolved',
                        customerId: customer.id,
                        result: result.result,
                        moneyDelta: result.moneyDelta,
                        xpDelta: result.xpDelta,
                    },
                    { type: 'customerLeft', customerId: customer.id },
                ];
                return { ok: true, events };
            }
            case 'deckAddCard': {
                const unlockedTier = unlockedCardTier(this.state.skills);
                const res = addCardToDeck(this.state.deck, action.cardId, unlockedTier);
                if (!res.ok) return { ok: false, reason: res.reason ?? 'invalid' };
                this.state = { ...this.state, deck: res.deck };
                return { ok: true };
            }
            case 'deckRemoveCard': {
                this.state = {
                    ...this.state,
                    deck: removeCardFromDeck(this.state.deck, action.index),
                };
                return { ok: true };
            }
            default: {
                const _exhaustive: never = action;
                return { ok: false, reason: `unhandled:${String(_exhaustive)}` };
            }
        }
    }

    snapshot(): SimSnapshot {
        const unlockedTier = unlockedCardTier(this.state.skills);
        return {
            paused: this.state.paused,
            phase: this.state.clock.phase,
            phaseTimeRemainingSeconds: getPhaseTimeRemainingSeconds(this.state.clock),
            dayNumber: this.state.clock.dayNumber,
            money: this.state.economy.money,
            speedMultiplier: this.getSpeedMultiplier(),
            speedTier: this.state.upgrades.speedTier,
            level: this.state.progression.level,
            xp: this.state.progression.xp,
            xpToNext: xpToNext(this.state.progression.level, this.config),
            skillPoints: this.state.progression.skillPoints,
            unlockedCardTier: unlockedTier,
            customers: this.state.customers.customers.map((c) => ({
                id: c.id,
                name: c.name,
                tier: c.tier,
                intent: c.intent,
                status: c.status,
            })),
            deck: this.state.deck,
        };
    }
}
