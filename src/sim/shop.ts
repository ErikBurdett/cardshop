import type { CardTier, EconomyState, SimEvent } from './types';
import type { SimConfig } from './config';
import { canAfford, spendMoney } from './economy';

export type PackSkuId = 'tier1Pack' | 'tier2Pack';

export type PackSkuDefinition = {
    id: PackSkuId;
    name: string;
    tier: CardTier;
    wholesaleCost: number;
    salePrice: number;
    xpPerSale: number;
};

export type ShelfSlot = {
    skuId: PackSkuId | null;
    quantity: number;
    capacity: number;
};

export type ShopState = {
    backroom: Partial<Record<PackSkuId, number>>;
    shelves: {
        slots: ShelfSlot[];
    };
};

export type ShopTuning = {
    shelfSlots: number;
    shelfSlotCapacity: number;
    packSkus: readonly PackSkuDefinition[];
};

export function getShopTuning(config: SimConfig): ShopTuning {
    void config;
    // MVP: hard-coded SKUs; can later be data-driven via config.
    return {
        shelfSlots: 4,
        shelfSlotCapacity: 6,
        packSkus: [
            {
                id: 'tier1Pack',
                name: 'Starter Pack',
                tier: 1,
                wholesaleCost: 6,
                salePrice: 10,
                xpPerSale: 3,
            },
            {
                id: 'tier2Pack',
                name: 'Advanced Pack',
                tier: 2,
                wholesaleCost: 14,
                salePrice: 22,
                xpPerSale: 6,
            },
        ],
    };
}

export function createInitialShop(config: SimConfig): ShopState {
    const tuning = getShopTuning(config);
    return {
        backroom: {
            tier1Pack: 0,
            tier2Pack: 0,
        },
        shelves: {
            slots: Array.from({ length: tuning.shelfSlots }, () => ({
                skuId: null,
                quantity: 0,
                capacity: tuning.shelfSlotCapacity,
            })),
        },
    };
}

export function getPackSku(skuId: PackSkuId, config: SimConfig): PackSkuDefinition | undefined {
    const tuning = getShopTuning(config);
    return tuning.packSkus.find((s) => s.id === skuId);
}

export function getBackroomCount(shop: ShopState, skuId: PackSkuId): number {
    return Math.max(0, shop.backroom[skuId] ?? 0);
}

export function buyWholesalePacks(
    shop: ShopState,
    economy: EconomyState,
    skuId: PackSkuId,
    quantity: number,
    config: SimConfig,
): { ok: true; shop: ShopState; economy: EconomyState } | { ok: false; reason: string } {
    const sku = getPackSku(skuId, config);
    if (!sku) return { ok: false, reason: 'unknown_sku' };
    const qty = Math.floor(quantity);
    if (qty <= 0) return { ok: false, reason: 'invalid_quantity' };

    const totalCost = sku.wholesaleCost * qty;
    if (!canAfford(economy, totalCost)) return { ok: false, reason: 'insufficient_funds' };

    const nextShop: ShopState = {
        ...shop,
        backroom: {
            ...shop.backroom,
            [skuId]: getBackroomCount(shop, skuId) + qty,
        },
    };
    return { ok: true, shop: nextShop, economy: spendMoney(economy, totalCost) };
}

export function stockShelfSlot(
    shop: ShopState,
    slotIndex: number,
    skuId: PackSkuId,
    quantity: number,
): { ok: true; shop: ShopState } | { ok: false; reason: string } {
    const idx = Math.floor(slotIndex);
    if (idx < 0 || idx >= shop.shelves.slots.length) return { ok: false, reason: 'bad_slot' };
    const qty = Math.floor(quantity);
    if (qty <= 0) return { ok: false, reason: 'invalid_quantity' };

    const slot = shop.shelves.slots[idx];
    if (slot.skuId !== null && slot.skuId !== skuId)
        return { ok: false, reason: 'slot_has_other_sku' };

    const available = getBackroomCount(shop, skuId);
    if (available <= 0) return { ok: false, reason: 'no_backroom_stock' };

    const space = slot.capacity - slot.quantity;
    if (space <= 0) return { ok: false, reason: 'slot_full' };

    const move = Math.min(available, space, qty);
    const nextSlots = shop.shelves.slots.slice();
    nextSlots[idx] = {
        ...slot,
        skuId,
        quantity: slot.quantity + move,
    };

    return {
        ok: true,
        shop: {
            ...shop,
            backroom: {
                ...shop.backroom,
                [skuId]: available - move,
            },
            shelves: { slots: nextSlots },
        },
    };
}

export function unstockShelfSlot(
    shop: ShopState,
    slotIndex: number,
    quantity: number,
): { ok: true; shop: ShopState } | { ok: false; reason: string } {
    const idx = Math.floor(slotIndex);
    if (idx < 0 || idx >= shop.shelves.slots.length) return { ok: false, reason: 'bad_slot' };
    const qty = Math.floor(quantity);
    if (qty <= 0) return { ok: false, reason: 'invalid_quantity' };

    const slot = shop.shelves.slots[idx];
    if (!slot.skuId || slot.quantity <= 0) return { ok: false, reason: 'slot_empty' };

    const move = Math.min(slot.quantity, qty);
    const skuId = slot.skuId;

    const nextSlots = shop.shelves.slots.slice();
    const remaining = slot.quantity - move;
    nextSlots[idx] = {
        ...slot,
        quantity: remaining,
        skuId: remaining === 0 ? null : slot.skuId,
    };

    return {
        ok: true,
        shop: {
            ...shop,
            backroom: {
                ...shop.backroom,
                [skuId]: getBackroomCount(shop, skuId) + move,
            },
            shelves: { slots: nextSlots },
        },
    };
}

export function clearShelfSlot(
    shop: ShopState,
    slotIndex: number,
): { ok: true; shop: ShopState } | { ok: false; reason: string } {
    const idx = Math.floor(slotIndex);
    if (idx < 0 || idx >= shop.shelves.slots.length) return { ok: false, reason: 'bad_slot' };
    const slot = shop.shelves.slots[idx];
    if (!slot.skuId || slot.quantity <= 0) {
        const nextSlots = shop.shelves.slots.slice();
        nextSlots[idx] = { ...slot, skuId: null, quantity: 0 };
        return { ok: true, shop: { ...shop, shelves: { slots: nextSlots } } };
    }
    return { ok: false, reason: 'slot_not_empty' };
}

export function sellOneFromShelves(
    shop: ShopState,
    config: SimConfig,
):
    | {
          ok: true;
          shop: ShopState;
          event: Omit<Extract<SimEvent, { type: 'saleCompleted' }>, 'customerId'>;
      }
    | { ok: false; reason: string } {
    for (let i = 0; i < shop.shelves.slots.length; i += 1) {
        const slot = shop.shelves.slots[i];
        if (!slot.skuId || slot.quantity <= 0) continue;
        const sku = getPackSku(slot.skuId, config);
        if (!sku) return { ok: false, reason: 'unknown_sku' };

        const nextSlots = shop.shelves.slots.slice();
        const remaining = slot.quantity - 1;
        nextSlots[i] = {
            ...slot,
            quantity: remaining,
            skuId: remaining === 0 ? null : slot.skuId,
        };

        return {
            ok: true,
            shop: { ...shop, shelves: { slots: nextSlots } },
            event: {
                type: 'saleCompleted',
                skuId: sku.id,
                value: sku.salePrice,
                xp: sku.xpPerSale,
            },
        };
    }
    return { ok: false, reason: 'out_of_stock' };
}
