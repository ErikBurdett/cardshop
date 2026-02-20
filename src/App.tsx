import { useEffect, useMemo, useState } from 'react';
import { PhaserGame } from './PhaserGame';
import { GameFacade } from './game/GameFacade';
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
        const map = new Map(CARDS.map((c) => [c.id, c.name]));
        return (id: string) => map.get(id) ?? id;
    }, []);

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
                                <div className="subtle">
                                    MVP placeholder. Decor/customization and shop upgrades will live
                                    here.
                                </div>
                            </div>
                        ) : null}

                        {tab === 'Packs' ? (
                            <div className="stack">
                                <div className="subtle">
                                    MVP placeholder. Pack opening and card acquisition will live
                                    here.
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
                                                {idx + 1}. <strong>{cardNameById(id)}</strong>{' '}
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

                                <div className="subtle">Add cards</div>
                                <div className="grid">
                                    {CARDS.filter(
                                        (c) => !snapshot || c.tier <= snapshot.unlockedCardTier,
                                    ).map((c) => (
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
                                            {c.name} (T{c.tier})
                                        </button>
                                    ))}
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
                                    <div className="listRow">
                                        <div>
                                            <strong>Unlock Tier 2 Cards</strong>
                                            <div className="subtle">
                                                Grants access to tier 2 cards (gated feature).
                                            </div>
                                        </div>
                                        <button
                                            className="button buttonPrimary"
                                            disabled={
                                                !snapshot ||
                                                snapshot.skillPoints <= 0 ||
                                                snapshot.unlockedCardTier >= 2
                                            }
                                            onClick={() =>
                                                GameFacade.dispatch({
                                                    type: 'unlockSkill',
                                                    skillId: 'unlockTier2Cards',
                                                })
                                            }
                                        >
                                            {snapshot?.unlockedCardTier >= 2
                                                ? 'Unlocked'
                                                : 'Unlock (1 SP)'}
                                        </button>
                                    </div>
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
