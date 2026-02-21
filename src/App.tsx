import { useEffect, useMemo, useState } from 'react';
import { PhaserGame } from './PhaserGame';
import { GameFacade } from './game/GameFacade';
import { getPlayerPackDefinitions, getShopTuning, SKILLS, type PackSkuId } from './sim';
import { CARDS } from './sim/cards/cards';
import { SIM_CONFIG } from './sim/config';
import { maxSpeedTier, speedTierCost } from './sim/upgrades';
import type { SimSnapshot } from './sim/types';

type TabId = 'Shop' | 'Manage' | 'Packs' | 'Deck' | 'Battle' | 'Skills' | 'Settings';

function formatSeconds(seconds: number): string {
    const s = Math.max(0, Math.ceil(seconds));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${String(r).padStart(2, '0')}`;
}

export default function App() {
    const [tab, setTab] = useState<TabId>('Shop');
    const [snapshot, setSnapshot] = useState<SimSnapshot | null>(null);
    const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
    const [toast, setToast] = useState<string | null>(null);
    const [lastBattle, setLastBattle] = useState<string | null>(null);
    const [lastPackOpened, setLastPackOpened] = useState<string | null>(null);
    const [showCollection, setShowCollection] = useState<boolean>(false);

    const shopTuning = useMemo(() => getShopTuning(SIM_CONFIG), []);
    const playerPackDefs = useMemo(() => getPlayerPackDefinitions(SIM_CONFIG), []);

    useEffect(() => {
        const unsubSnapshot = GameFacade.onSnapshot((s) => setSnapshot(s));
        const unsubBattlePrompt = GameFacade.onBattlePrompt((customerId) => {
            setSelectedCustomerId(customerId);
            setTab('Battle');
        });
        const unsubAutosave = GameFacade.onAutosaved(() => {
            setToast('Autosaved (night started)');
            window.setTimeout(() => setToast(null), 2000);
        });
        const unsubEvents = GameFacade.onSimEvent((e) => {
            if (e.type === 'battleResolved') {
                setLastBattle(
                    `Battle vs ${e.customerId}: ${e.result.toUpperCase()} (+$${e.moneyDelta}, +${e.xpDelta}xp)`,
                );
            }
            if (e.type === 'packOpened') {
                setLastPackOpened(
                    `Opened ${e.packId} → ${e.cards
                        .map((c) => c.cardId)
                        .slice(0, 8)
                        .join(', ')}`,
                );
                setShowCollection(true);
                window.setTimeout(() => setLastPackOpened(null), 6000);
            }
        });

        return () => {
            unsubSnapshot();
            unsubBattlePrompt();
            unsubAutosave();
            unsubEvents();
        };
    }, []);

    const nextSpeedCost = useMemo(() => {
        if (!snapshot) return null;
        return speedTierCost(snapshot.speedTier, SIM_CONFIG);
    }, [snapshot]);

    const atMaxSpeedTier = useMemo(() => {
        if (!snapshot) return false;
        return snapshot.speedTier >= maxSpeedTier(SIM_CONFIG);
    }, [snapshot]);

    const cardNameById = useMemo(() => {
        const map = new Map(CARDS.map((c) => [c.id, c]));
        return (id: string) => map.get(id);
    }, []);

    const packNameById = useMemo(() => {
        const map = new Map(shopTuning.packSkus.map((s) => [s.id, s.name]));
        return (id: string) => map.get(id as PackSkuId) ?? id;
    }, [shopTuning.packSkus]);

    const allowedPackSkus = useMemo(() => {
        if (!snapshot) return shopTuning.packSkus.filter((s) => s.tier === 1);
        return shopTuning.packSkus.filter((s) => s.tier <= snapshot.unlockedCardTier);
    }, [shopTuning.packSkus, snapshot]);

    const ownedCounts = useMemo(() => {
        const map = new Map<string, number>();
        if (!snapshot) return map;
        for (const e of snapshot.collection) map.set(e.cardId, e.count);
        return map;
    }, [snapshot]);

    const deckCounts = useMemo(() => {
        const map = new Map<string, number>();
        if (!snapshot) return map;
        for (const id of snapshot.deck.cardIds) map.set(id, (map.get(id) ?? 0) + 1);
        return map;
    }, [snapshot]);

    return (
        <div id="app">
            <div className="layout">
                <div className="gamePane">
                    <PhaserGame />
                </div>

                <div className="uiPane">
                    <div className="topBar">
                        <div className="topBarLeft">
                            <div className="title">Card Shop Simulator (MVP)</div>
                            {snapshot ? (
                                <div className="stats">
                                    <div>
                                        <strong>${snapshot.money}</strong> • Day{' '}
                                        {snapshot.dayNumber} • {snapshot.phase.toUpperCase()} •{' '}
                                        {formatSeconds(snapshot.phaseTimeRemainingSeconds)} left
                                    </div>
                                    <div>
                                        Speed{' '}
                                        <strong>{snapshot.speedMultiplier.toFixed(2)}x</strong>{' '}
                                        (tier {snapshot.speedTier}) • Level{' '}
                                        <strong>{snapshot.level}</strong> • XP {snapshot.xp}/
                                        {snapshot.xpToNext} • SP {snapshot.skillPoints}
                                    </div>
                                </div>
                            ) : (
                                <div className="stats">Waiting for sim…</div>
                            )}
                        </div>
                        <div className="topBarRight">
                            {toast ? <div className="toast">{toast}</div> : null}
                            <button
                                className="button buttonPrimary"
                                onClick={() => GameFacade.dispatch({ type: 'newGame' })}
                            >
                                New Game
                            </button>
                            <button
                                className="button"
                                onClick={() => GameFacade.dispatch({ type: 'togglePause' })}
                                disabled={!snapshot}
                            >
                                {snapshot?.paused ? 'Resume' : 'Pause'}
                            </button>
                        </div>
                    </div>

                    <div className="tabs">
                        {(
                            [
                                'Shop',
                                'Manage',
                                'Packs',
                                'Deck',
                                'Battle',
                                'Skills',
                                'Settings',
                            ] as const
                        ).map((t) => (
                            <button
                                key={t}
                                className={`tab ${tab === t ? 'active' : ''}`}
                                onClick={() => setTab(t)}
                            >
                                {t}
                            </button>
                        ))}
                    </div>

                    <div className="panel">
                        {tab === 'Shop' ? (
                            <div className="stack">
                                <div className="subtle">Shelf stock</div>
                                <div className="list">
                                    {snapshot ? (
                                        snapshot.shop.shelves.slots.map((slot, idx) => (
                                            <div key={idx} className="listRow">
                                                <div>
                                                    <strong>Slot {idx + 1}</strong> •{' '}
                                                    {slot.skuId
                                                        ? packNameById(slot.skuId)
                                                        : 'Empty'}{' '}
                                                    • {slot.quantity}/{slot.capacity}
                                                </div>
                                                <div className="row">
                                                    <button
                                                        className="button"
                                                        onClick={() => setTab('Manage')}
                                                    >
                                                        Manage
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="subtle">Waiting for sim…</div>
                                    )}
                                </div>

                                <div className="row">
                                    <button
                                        className="button buttonPrimary"
                                        onClick={() =>
                                            GameFacade.dispatch({ type: 'purchaseSpeedTier' })
                                        }
                                        disabled={
                                            !snapshot ||
                                            atMaxSpeedTier ||
                                            (snapshot && snapshot.money < (nextSpeedCost ?? 0))
                                        }
                                        title={
                                            atMaxSpeedTier
                                                ? 'Max speed reached'
                                                : `Cost: $${nextSpeedCost ?? 0}`
                                        }
                                    >
                                        Buy Speed Tier{' '}
                                        {snapshot ? `(cost $${nextSpeedCost ?? 0})` : ''}
                                    </button>
                                </div>

                                <div className="subtle">Customers</div>
                                <div className="list">
                                    {snapshot?.customers.length ? (
                                        snapshot.customers.map((c) => (
                                            <div key={c.id} className="listRow">
                                                <div>
                                                    <strong>{c.name}</strong> (T{c.tier}) •{' '}
                                                    {c.intent} • {c.status}
                                                    {c.status === 'waitingBattle' &&
                                                    c.challengeExpiresInSeconds != null
                                                        ? ` • expires in ${Math.ceil(c.challengeExpiresInSeconds)}s`
                                                        : ''}
                                                </div>
                                                <div className="row">
                                                    <button
                                                        className="button"
                                                        disabled={c.status !== 'waitingBattle'}
                                                        onClick={() => {
                                                            setSelectedCustomerId(c.id);
                                                            setTab('Battle');
                                                        }}
                                                    >
                                                        Battle
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="subtle">No customers yet.</div>
                                    )}
                                </div>
                            </div>
                        ) : null}

                        {tab === 'Manage' ? (
                            <div className="stack">
                                <div className="subtle">Backroom inventory</div>
                                <div className="list">
                                    {allowedPackSkus.map((sku) => (
                                        <div key={sku.id} className="listRow">
                                            <div>
                                                <strong>{sku.name}</strong> • Tier {sku.tier} •{' '}
                                                Backroom:{' '}
                                                <strong>
                                                    {snapshot?.shop.backroom[sku.id] ?? 0}
                                                </strong>
                                            </div>
                                            <div className="row">
                                                <button
                                                    className="button"
                                                    onClick={() => setTab('Packs')}
                                                >
                                                    Buy
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="subtle">Shelves</div>
                                <div className="list">
                                    {snapshot ? (
                                        snapshot.shop.shelves.slots.map((slot, idx) => (
                                            <div key={idx} className="listRow">
                                                <div>
                                                    <strong>Slot {idx + 1}</strong> •{' '}
                                                    {slot.skuId
                                                        ? packNameById(slot.skuId)
                                                        : 'Empty'}{' '}
                                                    • {slot.quantity}/{slot.capacity}
                                                </div>
                                                <div className="row">
                                                    {allowedPackSkus.map((sku) => {
                                                        const backroom =
                                                            snapshot.shop.backroom[sku.id] ?? 0;
                                                        const space = slot.capacity - slot.quantity;
                                                        const canStock =
                                                            (slot.skuId === null ||
                                                                slot.skuId === sku.id) &&
                                                            backroom > 0 &&
                                                            space > 0;

                                                        return (
                                                            <button
                                                                key={sku.id}
                                                                className="button"
                                                                disabled={!canStock}
                                                                onClick={() =>
                                                                    GameFacade.dispatch({
                                                                        type: 'stockShelf',
                                                                        slotIndex: idx,
                                                                        skuId: sku.id,
                                                                        quantity: 1,
                                                                    })
                                                                }
                                                                title={
                                                                    canStock
                                                                        ? `Stock ${sku.name} (+1)`
                                                                        : 'Cannot stock'
                                                                }
                                                            >
                                                                Stock {sku.tier} +1
                                                            </button>
                                                        );
                                                    })}
                                                    <button
                                                        className="button"
                                                        disabled={slot.quantity <= 0}
                                                        onClick={() =>
                                                            GameFacade.dispatch({
                                                                type: 'unstockShelf',
                                                                slotIndex: idx,
                                                                quantity: 1,
                                                            })
                                                        }
                                                    >
                                                        Unstock 1
                                                    </button>
                                                    <button
                                                        className="button"
                                                        disabled={slot.quantity <= 0}
                                                        onClick={() =>
                                                            GameFacade.dispatch({
                                                                type: 'unstockShelf',
                                                                slotIndex: idx,
                                                                quantity: slot.quantity,
                                                            })
                                                        }
                                                    >
                                                        Unstock all
                                                    </button>
                                                    <button
                                                        className="button"
                                                        disabled={slot.quantity !== 0}
                                                        onClick={() =>
                                                            GameFacade.dispatch({
                                                                type: 'clearShelf',
                                                                slotIndex: idx,
                                                            })
                                                        }
                                                    >
                                                        Clear
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="subtle">Waiting for sim…</div>
                                    )}
                                </div>
                            </div>
                        ) : null}

                        {tab === 'Packs' ? (
                            <div className="stack">
                                <div className="subtle">
                                    Buy wholesale packs into backroom inventory, then stock them on
                                    shelves in Manage.
                                </div>
                                <div className="list">
                                    {allowedPackSkus.map((sku) => (
                                        <div key={sku.id} className="listRow">
                                            <div>
                                                <strong>{sku.name}</strong> • Tier {sku.tier} •
                                                Cost: ${sku.wholesaleCost} • Sell: ${sku.salePrice}
                                            </div>
                                            <div className="row">
                                                <button
                                                    className="button buttonPrimary"
                                                    disabled={
                                                        !snapshot ||
                                                        snapshot.money < sku.wholesaleCost
                                                    }
                                                    onClick={() =>
                                                        GameFacade.dispatch({
                                                            type: 'buyWholesalePack',
                                                            skuId: sku.id,
                                                            quantity: 1,
                                                        })
                                                    }
                                                >
                                                    Buy 1
                                                </button>
                                                <button
                                                    className="button"
                                                    disabled={
                                                        !snapshot ||
                                                        snapshot.money < sku.wholesaleCost * 5
                                                    }
                                                    onClick={() =>
                                                        GameFacade.dispatch({
                                                            type: 'buyWholesalePack',
                                                            skuId: sku.id,
                                                            quantity: 5,
                                                        })
                                                    }
                                                >
                                                    Buy 5
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="notice">
                                    <div>
                                        <strong>Player packs</strong> (open to grow your collection)
                                    </div>
                                    <div className="subtle">
                                        Each opened pack gives <strong>8 cards</strong> from the
                                        selected tier and rarity.
                                    </div>
                                </div>

                                {lastPackOpened ? (
                                    <div className="notice">{lastPackOpened}</div>
                                ) : null}

                                <div className="list">
                                    {playerPackDefs
                                        .filter(
                                            (p) => !snapshot || p.tier <= snapshot.unlockedCardTier,
                                        )
                                        .map((p) => {
                                            const sealed = snapshot?.sealedPacks?.[p.id] ?? 0;
                                            return (
                                                <div key={p.id} className="listRow">
                                                    <div>
                                                        <strong>{p.name}</strong> • Cost: ${p.cost}{' '}
                                                        • Owned: <strong>{sealed}</strong>
                                                    </div>
                                                    <div className="row">
                                                        <button
                                                            className="button buttonPrimary"
                                                            disabled={
                                                                !snapshot || snapshot.money < p.cost
                                                            }
                                                            onClick={() =>
                                                                GameFacade.dispatch({
                                                                    type: 'buyPlayerPack',
                                                                    packId: p.id,
                                                                    quantity: 1,
                                                                })
                                                            }
                                                        >
                                                            Buy 1
                                                        </button>
                                                        <button
                                                            className="button"
                                                            disabled={
                                                                !snapshot ||
                                                                snapshot.money < p.cost * 5
                                                            }
                                                            onClick={() =>
                                                                GameFacade.dispatch({
                                                                    type: 'buyPlayerPack',
                                                                    packId: p.id,
                                                                    quantity: 5,
                                                                })
                                                            }
                                                        >
                                                            Buy 5
                                                        </button>
                                                        <button
                                                            className="button"
                                                            disabled={!snapshot || sealed <= 0}
                                                            onClick={() =>
                                                                GameFacade.dispatch({
                                                                    type: 'openPlayerPack',
                                                                    packId: p.id,
                                                                })
                                                            }
                                                        >
                                                            Open 1
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                </div>

                                <div className="row">
                                    <button
                                        className="button"
                                        onClick={() => setShowCollection((v) => !v)}
                                        disabled={!snapshot}
                                    >
                                        {showCollection ? 'Hide' : 'Show'} Collection
                                    </button>
                                </div>

                                {showCollection ? (
                                    <div className="stack">
                                        <div className="subtle">Collection (scroll)</div>
                                        <div
                                            className="list"
                                            style={{
                                                maxHeight: 360,
                                                overflow: 'auto',
                                            }}
                                        >
                                            {snapshot?.collection.length ? (
                                                snapshot.collection
                                                    .slice()
                                                    .sort((a, b) => {
                                                        const ca = cardNameById(a.cardId);
                                                        const cb = cardNameById(b.cardId);
                                                        const ta = ca?.tier ?? 0;
                                                        const tb = cb?.tier ?? 0;
                                                        if (ta !== tb) return ta - tb;
                                                        return a.cardId.localeCompare(b.cardId);
                                                    })
                                                    .map((e) => {
                                                        const c = cardNameById(e.cardId);
                                                        return (
                                                            <div key={e.cardId} className="listRow">
                                                                <div>
                                                                    <strong>
                                                                        {c?.name ?? e.cardId}
                                                                    </strong>{' '}
                                                                    <span className="subtle">
                                                                        ({e.cardId})
                                                                    </span>
                                                                    <div className="subtle">
                                                                        T{c?.tier ?? '?'} •{' '}
                                                                        {c?.rarity ?? '?'} • ATK{' '}
                                                                        {c?.attack ?? '?'} / HP{' '}
                                                                        {c?.health ?? '?'}
                                                                    </div>
                                                                </div>
                                                                <div>
                                                                    x<strong>{e.count}</strong>
                                                                </div>
                                                            </div>
                                                        );
                                                    })
                                            ) : (
                                                <div className="subtle">
                                                    No cards collected yet.
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ) : null}

                                <div className="row">
                                    <button className="button" onClick={() => setTab('Manage')}>
                                        Go to Manage
                                    </button>
                                </div>
                            </div>
                        ) : null}

                        {tab === 'Deck' ? (
                            <div className="stack">
                                <div className="subtle">
                                    Deck ({snapshot?.deck.cardIds.length ?? 0}/
                                    {snapshot?.deck.maxSize ?? 0})
                                </div>
                                <div className="list">
                                    {snapshot?.deck.cardIds.map((id, idx) => (
                                        <div key={`${id}-${idx}`} className="listRow">
                                            <div>
                                                {idx + 1}.{' '}
                                                <strong>{cardNameById(id)?.name ?? id}</strong>{' '}
                                                <span className="subtle">({id})</span>
                                            </div>
                                            <button
                                                className="button"
                                                onClick={() =>
                                                    GameFacade.dispatch({
                                                        type: 'deckRemoveCard',
                                                        index: idx,
                                                    })
                                                }
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    )) ?? <div className="subtle">No snapshot yet.</div>}
                                </div>

                                <div className="subtle">Add cards (owned only)</div>
                                <div className="grid">
                                    {CARDS.filter(
                                        (c) =>
                                            !!snapshot &&
                                            c.tier <= snapshot.unlockedCardTier &&
                                            (ownedCounts.get(c.id) ?? 0) >
                                                (deckCounts.get(c.id) ?? 0),
                                    )
                                        .slice(0, 120)
                                        .map((c) => (
                                            <button
                                                key={c.id}
                                                className="button"
                                                disabled={!snapshot}
                                                onClick={() =>
                                                    GameFacade.dispatch({
                                                        type: 'deckAddCard',
                                                        cardId: c.id,
                                                    })
                                                }
                                            >
                                                {c.name} • T{c.tier} • {c.rarity} •{' '}
                                                {deckCounts.get(c.id) ?? 0}/
                                                {ownedCounts.get(c.id) ?? 0}
                                            </button>
                                        ))}
                                </div>
                                <div className="subtle">
                                    Showing up to 120 addable cards (expand with filters/search
                                    later).
                                </div>
                            </div>
                        ) : null}

                        {tab === 'Battle' ? (
                            <div className="stack">
                                <div className="row">
                                    <div className="subtle">
                                        Selected customer: {selectedCustomerId ?? '(none)'}
                                    </div>
                                    <button
                                        className="button"
                                        onClick={() => setSelectedCustomerId(null)}
                                    >
                                        Clear
                                    </button>
                                </div>
                                {lastBattle ? <div className="notice">{lastBattle}</div> : null}
                                <button
                                    className="button buttonPrimary"
                                    disabled={!snapshot || !selectedCustomerId}
                                    onClick={() => {
                                        if (!selectedCustomerId) return;
                                        GameFacade.dispatch({
                                            type: 'startBattle',
                                            customerId: selectedCustomerId,
                                        });
                                    }}
                                >
                                    Start Battle
                                </button>
                                <div className="subtle">
                                    Battles resolve instantly in MVP; later this becomes a proper
                                    turn-based panel.
                                </div>
                            </div>
                        ) : null}

                        {tab === 'Skills' ? (
                            <div className="stack">
                                <div>
                                    Skill points: <strong>{snapshot?.skillPoints ?? 0}</strong>
                                </div>
                                <div className="list">
                                    {(
                                        [
                                            { id: 'unlockTier2Cards', tier: 2 },
                                            { id: 'unlockTier3Cards', tier: 3 },
                                            { id: 'unlockTier4Cards', tier: 4 },
                                            { id: 'unlockTier5Cards', tier: 5 },
                                            { id: 'unlockTier6Cards', tier: 6 },
                                            { id: 'unlockTier7Cards', tier: 7 },
                                            { id: 'unlockTier8Cards', tier: 8 },
                                            { id: 'unlockTier9Cards', tier: 9 },
                                        ] as const
                                    ).map((s) => {
                                        const def = SKILLS[s.id];
                                        const unlocked =
                                            snapshot != null && snapshot.unlockedCardTier >= s.tier;
                                        const prereqOk =
                                            !def.requires ||
                                            (snapshot != null &&
                                                snapshot.unlockedCardTier >= s.tier - 1);
                                        const canBuy =
                                            snapshot != null &&
                                            !unlocked &&
                                            prereqOk &&
                                            snapshot.skillPoints >= def.cost;

                                        return (
                                            <div key={s.id} className="listRow">
                                                <div>
                                                    <strong>{def.name}</strong>
                                                    <div className="subtle">
                                                        Cost: {def.cost} SP
                                                        {def.requires
                                                            ? ' • Requires previous tier'
                                                            : ''}
                                                    </div>
                                                </div>
                                                <button
                                                    className="button buttonPrimary"
                                                    disabled={!canBuy}
                                                    onClick={() =>
                                                        GameFacade.dispatch({
                                                            type: 'unlockSkill',
                                                            skillId: s.id,
                                                        })
                                                    }
                                                >
                                                    {unlocked
                                                        ? 'Unlocked'
                                                        : `Unlock (Tier ${s.tier})`}
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ) : null}

                        {tab === 'Settings' ? (
                            <div className="stack">
                                <div className="row">
                                    <button
                                        className="button buttonPrimary"
                                        onClick={() => GameFacade.save()}
                                    >
                                        Save
                                    </button>
                                    <button className="button" onClick={() => GameFacade.load()}>
                                        Load
                                    </button>
                                </div>
                                <div className="subtle">
                                    Save data is stored in localStorage with a schema version.
                                </div>
                            </div>
                        ) : null}
                    </div>
                </div>
            </div>
        </div>
    );
}
