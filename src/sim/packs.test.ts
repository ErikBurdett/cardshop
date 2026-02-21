import { describe, expect, test } from 'vitest';
import { SIM_CONFIG } from './config';
import { SimGame } from './game';
import { getPlayerPackDefinitions } from './packs';

describe('player packs + collection', () => {
    test('buy + open pack adds 8 cards to collection', () => {
        const sim = new SimGame(SIM_CONFIG, 123);
        const pack = getPlayerPackDefinitions(SIM_CONFIG).find(
            (p) => p.tier === 1 && p.rarity === 'common',
        );
        expect(pack).toBeTruthy();
        if (!pack) return;

        const startMoney = sim.state.economy.money;
        const buy = sim.dispatch({ type: 'buyPlayerPack', packId: pack.id, quantity: 1 });
        expect(buy.ok).toBe(true);
        expect(sim.state.sealedPacks[pack.id]).toBe(1);
        expect(sim.state.economy.money).toBe(startMoney - pack.cost);

        const beforeCount = Object.values(sim.state.collection).reduce((a, b) => a + b, 0);
        const open = sim.dispatch({ type: 'openPlayerPack', packId: pack.id });
        expect(open.ok).toBe(true);
        expect(sim.state.sealedPacks[pack.id]).toBe(0);
        const afterCount = Object.values(sim.state.collection).reduce((a, b) => a + b, 0);
        expect(afterCount - beforeCount).toBe(8);
    });
});
