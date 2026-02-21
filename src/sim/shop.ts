import type { CardTier, EconomyState, SimEvent } from './types';
import type { SimConfig } from './config';
import { canAfford, spendMoney } from './economy';

export const SHOP_PACK_SKU_IDS = [
    'tier1Pack',
    'tier2Pack',
    'tier3Pack',
    'tier4Pack',
    'tier5Pack',
    'tier6Pack',
    'tier7Pack',
    'tier8Pack',
    'tier9Pack',
] as const;

export type PackSkuId = (typeof SHOP_PACK_SKU_IDS)[number];

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
    // MVP: data-driven SKUs; wholesale/sale values scale by tier.
    return {
        shelfSlots: 4,
        shelfSlotCapacity: 6,
        packSkus: SHOP_PACK_SKU_IDS.map((id, idx) => {
            const tier = (idx + 1) as CardTier;
            const wholesaleCost = Math.ceil(4 + tier * tier * 2.2);
            const salePrice = Math.ceil(wholesaleCost * 1.6);
            const xpPerSale = Math.ceil(2 + tier * 1.5);
            return {
                id,
                name: `Sealed Pack (Tier ${tier})`,
                tier,
                wholesaleCost,
                salePrice,
                xpPerSale,
            } satisfies PackSkuDefinition;
        }),
    };
}

export function createInitialShop(config: SimConfig): ShopState {
    const tuning = getShopTuning(config);
    return {
        backroom: Object.fromEntries(tuning.packSkus.map((s) => [s.id, 0])),
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
