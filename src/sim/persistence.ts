import type { GameState, SimSaveV1 } from './types';

export type StorageLike = {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
};

export const SAVE_KEY = 'cardshop.save';
export const CURRENT_SCHEMA_VERSION = 1 as const;

export function makeSave(state: GameState): SimSaveV1 {
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
        const parsed = JSON.parse(raw) as Partial<SimSaveV1>;
        if (parsed.schemaVersion !== CURRENT_SCHEMA_VERSION)
            return { ok: false, reason: 'unsupported_version' };
        if (!parsed.state) return { ok: false, reason: 'missing_state' };
        return { ok: true, state: parsed.state };
    } catch {
        return { ok: false, reason: 'parse_error' };
    }
}

export function clearSave(storage: StorageLike, key: string = SAVE_KEY): void {
    storage.removeItem(key);
}
