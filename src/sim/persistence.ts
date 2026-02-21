import { SIM_CONFIG, type SimConfig } from './config';
import { createNewGameState } from './game';
import { createInitialShop, getShopTuning } from './shop';
import { createInitialCustomers } from './customers';
import type { CardTier, GamePhase, GameState, SimSaveV1, SimSaveV2, SimSaveV3 } from './types';

function isFiniteNumber(x: unknown): x is number {
    return typeof x === 'number' && Number.isFinite(x);
}

function clamp(n: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, n));
}

function normalizePhase(x: unknown): GamePhase {
    return x === 'night' ? 'night' : 'day';
}

function normalizeTier(x: unknown): CardTier {
    const n = typeof x === 'number' ? Math.floor(x) : 1;
    return clamp(n, 1, 9) as CardTier;
}

function asRecord(x: unknown): Record<string, unknown> | null {
    return x && typeof x === 'object' ? (x as Record<string, unknown>) : null;
}

function normalizeLoadedState(input: unknown, config: SimConfig): GameState {
    const rec = asRecord(input);
    const seed = isFiniteNumber(rec?.rngSeed) ? (rec!.rngSeed as number) : 12345;
    const fresh = createNewGameState(config, seed);

    const paused = typeof rec?.paused === 'boolean' ? (rec.paused as boolean) : false;

    const clockRec = asRecord(rec?.clock);
    const phase = normalizePhase(clockRec?.phase);
    const duration = phase === 'day' ? config.daySeconds : config.nightSeconds;
    const timeInPhase = isFiniteNumber(clockRec?.timeInPhaseSeconds)
        ? clamp(clockRec.timeInPhaseSeconds as number, 0, duration)
        : 0;
    const dayNumber = isFiniteNumber(clockRec?.dayNumber)
        ? Math.max(1, Math.floor(clockRec.dayNumber as number))
        : 1;
    const clock = {
        phase,
        timeInPhaseSeconds: timeInPhase,
        dayNumber,
        phaseDurationSeconds: duration,
    };

    const economyRec = asRecord(rec?.economy);
    const money = isFiniteNumber(economyRec?.money)
        ? Math.max(0, Math.floor(economyRec.money as number))
        : fresh.economy.money;
    const economy = { money };

    const progRec = asRecord(rec?.progression);
    const level = isFiniteNumber(progRec?.level)
        ? Math.max(1, Math.floor(progRec.level as number))
        : fresh.progression.level;
    const xp = isFiniteNumber(progRec?.xp)
        ? Math.max(0, Math.floor(progRec.xp as number))
        : fresh.progression.xp;
    const skillPoints = isFiniteNumber(progRec?.skillPoints)
        ? Math.max(0, Math.floor(progRec.skillPoints as number))
        : fresh.progression.skillPoints;
    const progression = { level, xp, skillPoints };

    const upgradesRec = asRecord(rec?.upgrades);
    const speedTier = isFiniteNumber(upgradesRec?.speedTier)
        ? Math.max(0, Math.floor(upgradesRec.speedTier as number))
        : 0;
    const upgrades = { speedTier };

    const skillsRec = asRecord(rec?.skills);
    const unlockedRec = asRecord(skillsRec?.unlocked);
    const skills = unlockedRec ? { unlocked: { ...unlockedRec } } : fresh.skills;

    // Customers are ephemeral; if anything looks off, respawn them to keep sim ticking.
    const customersRec = asRecord(rec?.customers);
    const customersArr = customersRec ? customersRec.customers : null;
    const customers =
        customersRec &&
        isFiniteNumber(customersRec.nextSpawnInSeconds) &&
        Array.isArray(customersArr) &&
        isFiniteNumber(customersRec.nextId)
            ? {
                  nextSpawnInSeconds: Math.max(0.5, customersRec.nextSpawnInSeconds as number),
                  nextId: Math.max(1, Math.floor(customersRec.nextId as number)),
                  customers: (customersArr as unknown[])
                      .map(asRecord)
                      .filter((c): c is Record<string, unknown> => !!c && typeof c.id === 'string')
                      .map((c) => {
                          const status = c.status;
                          const normalizedStatus =
                              status === 'waitingBattle'
                                  ? 'waitingBattle'
                                  : status === 'readyToBuy'
                                    ? 'readyToBuy'
                                    : 'browsing';
                          const challengeExpires =
                              normalizedStatus === 'waitingBattle'
                                  ? isFiniteNumber(c.challengeExpiresInSeconds)
                                      ? Math.max(0, c.challengeExpiresInSeconds)
                                      : config.customer.challengeTimeoutSeconds
                                  : undefined;
                          const deckCardIds = Array.isArray(c.deckCardIds)
                              ? (c.deckCardIds as unknown[]).filter(
                                    (id): id is string => typeof id === 'string',
                                )
                              : [];

                          return {
                              id: c.id as string,
                              name: typeof c.name === 'string' ? (c.name as string) : 'Visitor',
                              tier: normalizeTier(c.tier),
                              intent: c.intent === 'challenge' ? 'challenge' : 'buy',
                              status: normalizedStatus,
                              timeToDecisionSeconds: isFiniteNumber(c.timeToDecisionSeconds)
                                  ? Math.max(0, c.timeToDecisionSeconds)
                                  : 0,
                              challengeExpiresInSeconds: challengeExpires,
                              deckCardIds,
                          };
                      }),
              }
            : createInitialCustomers(config);

    // Shop: repair shelves shape and counts.
    const tuning = getShopTuning(config);
    const shopRec = asRecord(rec?.shop);
    const shelvesRec = asRecord(shopRec?.shelves);
    const slotsIn = shelvesRec?.slots;
    let shop = shopRec ? (shopRec as unknown as GameState['shop']) : createInitialShop(config);
    if (!shop || !shop.shelves || !Array.isArray(shop.shelves.slots))
        shop = createInitialShop(config);

    const allowedSkuIds = new Set<string>(tuning.packSkus.map((s) => s.id));
    const slots = Array.from({ length: tuning.shelfSlots }, (_, i) => {
        const rawSlot =
            Array.isArray(slotsIn) && i < slotsIn.length
                ? asRecord((slotsIn as unknown[])[i])
                : null;
        const capacity = tuning.shelfSlotCapacity;
        const skuId =
            rawSlot && typeof rawSlot.skuId === 'string' && allowedSkuIds.has(rawSlot.skuId)
                ? rawSlot.skuId
                : null;
        const quantity =
            rawSlot && isFiniteNumber(rawSlot.quantity)
                ? clamp(Math.floor(rawSlot.quantity as number), 0, capacity)
                : 0;
        return {
            skuId: quantity === 0 ? null : skuId,
            quantity,
            capacity,
        };
    });
    const backroom: Record<string, number> = {};
    for (const sku of tuning.packSkus) {
        const raw = asRecord(shopRec?.backroom)?.[sku.id];
        backroom[sku.id] = isFiniteNumber(raw) ? Math.max(0, Math.floor(raw)) : 0;
    }
    shop = { backroom, shelves: { slots } } as unknown as GameState['shop'];

    const sealedPacksRec = asRecord(rec?.sealedPacks);
    const sealedPacks = sealedPacksRec
        ? (sealedPacksRec as GameState['sealedPacks'])
        : fresh.sealedPacks;

    const collectionRec = asRecord(rec?.collection);
    const collection = collectionRec
        ? (collectionRec as GameState['collection'])
        : fresh.collection;

    const deckRec = asRecord(rec?.deck);
    const deck =
        deckRec && Array.isArray(deckRec.cardIds) && isFiniteNumber(deckRec.maxSize)
            ? {
                  cardIds: (deckRec.cardIds as unknown[]).filter(
                      (id): id is string => typeof id === 'string',
                  ),
                  maxSize: Math.max(1, Math.floor(deckRec.maxSize as number)),
              }
            : fresh.deck;

    return {
        ...fresh,
        paused,
        rngSeed: seed,
        clock,
        economy,
        progression,
        upgrades,
        skills,
        shop,
        sealedPacks,
        collection,
        deck,
        customers,
    };
}

export type StorageLike = {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
};

export const SAVE_KEY = 'cardshop.save';
export const CURRENT_SCHEMA_VERSION = 3 as const;

export function makeSave(state: GameState): SimSaveV3 {
    return {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        savedAtIso: new Date().toISOString(),
        state,
    };
}

export function saveToStorage(
    storage: StorageLike,
    state: GameState,
    key: string = SAVE_KEY,
): void {
    const payload = makeSave(state);
    storage.setItem(key, JSON.stringify(payload));
}

export function loadFromStorage(
    storage: StorageLike,
    key: string = SAVE_KEY,
): { ok: true; state: GameState } | { ok: false; reason: string } {
    const raw = storage.getItem(key);
    if (!raw) return { ok: false, reason: 'no_save' };

    try {
        const parsed = JSON.parse(raw) as Partial<SimSaveV1 | SimSaveV2 | SimSaveV3>;
        if (!parsed.schemaVersion) return { ok: false, reason: 'missing_version' };
        if (!parsed.state) return { ok: false, reason: 'missing_state' };

        if (parsed.schemaVersion === 3) {
            return { ok: true, state: normalizeLoadedState(parsed.state, SIM_CONFIG) };
        }

        // v1 -> v2 migration (historical), then v2 -> v3 below.
        let state = parsed.state as unknown as GameState & {
            shop?: GameState['shop'];
            sealedPacks?: GameState['sealedPacks'];
            collection?: GameState['collection'];
        };

        if (parsed.schemaVersion === 1) {
            const shop = state.shop ?? createInitialShop(SIM_CONFIG);
            const customers = {
                ...state.customers,
                customers: state.customers.customers.map((c) =>
                    c.status === 'waitingBattle' && c.challengeExpiresInSeconds == null
                        ? {
                              ...c,
                              challengeExpiresInSeconds:
                                  SIM_CONFIG.customer.challengeTimeoutSeconds,
                          }
                        : c,
                ),
            };
            state = { ...state, shop, customers } as typeof state;
        }

        if (parsed.schemaVersion === 2 || parsed.schemaVersion === 1) {
            // v2 -> v3 migration:
            // - Introduce sealed packs + collection
            // - Map old starter card ids to new ids (deck + derived collection)
            const oldToNew: Record<string, string> = {
                strike: 't1_c01',
                guard: 't1_c02',
                spark: 't1_c03',
                cleave: 't2_c01',
                ward: 't2_c02',
            };
            const mapCardId = (id: string) => oldToNew[id] ?? id;

            const nextDeck = {
                ...state.deck,
                cardIds: state.deck.cardIds.map(mapCardId),
            };

            const nextCollection: Record<string, number> = {};
            for (const id of nextDeck.cardIds) {
                nextCollection[id] = (nextCollection[id] ?? 0) + 1;
            }

            // Customers gained new fields over time; safest is to respawn them.
            const nextCustomers = createInitialCustomers(SIM_CONFIG);

            const nextState: GameState = {
                ...state,
                shop: state.shop ?? createInitialShop(SIM_CONFIG),
                deck: nextDeck,
                customers: nextCustomers,
                sealedPacks: state.sealedPacks ?? {},
                collection: state.collection ?? nextCollection,
            } as GameState;

            return { ok: true, state: normalizeLoadedState(nextState, SIM_CONFIG) };
        }

        return { ok: false, reason: 'unsupported_version' };
    } catch {
        return { ok: false, reason: 'parse_error' };
    }
}

export function clearSave(storage: StorageLike, key: string = SAVE_KEY): void {
    storage.removeItem(key);
}
