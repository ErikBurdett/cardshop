import { SIM_CONFIG } from './config';
import { createInitialShop } from './shop';
import type { GameState, SimSaveV1, SimSaveV2 } from './types';

export type StorageLike = {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
};

export const SAVE_KEY = 'cardshop.save';
export const CURRENT_SCHEMA_VERSION = 2 as const;

export function makeSave(state: GameState): SimSaveV2 {
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
        const parsed = JSON.parse(raw) as Partial<SimSaveV1 | SimSaveV2>;
        if (!parsed.schemaVersion) return { ok: false, reason: 'missing_version' };
        if (!parsed.state) return { ok: false, reason: 'missing_state' };

        if (parsed.schemaVersion === 2) {
            return { ok: true, state: parsed.state };
        }

        if (parsed.schemaVersion === 1) {
            // Migrate old saves to include the shop state and new customer fields.
            const state = parsed.state as unknown as GameState & { shop?: GameState['shop'] };
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

            return {
                ok: true,
                state: {
                    ...state,
                    shop,
                    customers,
                },
            };
        }

        return { ok: false, reason: 'unsupported_version' };
    } catch {
        return { ok: false, reason: 'parse_error' };
    }
}

export function clearSave(storage: StorageLike, key: string = SAVE_KEY): void {
    storage.removeItem(key);
}
