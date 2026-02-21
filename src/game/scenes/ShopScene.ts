import { GameObjects, Geom, Math as PhaserMath, Scene } from 'phaser';
import { EventBus } from '../EventBus';
import {
    loadFromStorage,
    saveToStorage,
    SAVE_KEY,
    SimGame,
    type SimAction,
    type SimSnapshot,
} from '../../sim';

type WorldPoint = { x: number; y: number };
type CustomerMode = 'entering' | 'wandering' | 'battleWaiting' | 'exiting';

type CustomerView = {
    container: GameObjects.Container;
    bg: GameObjects.Rectangle;
    sprite: GameObjects.Sprite;
    label: GameObjects.Text;
    mode: CustomerMode;
    moving: boolean;
    nextWanderAtMs: number;
    lastSeenAtMs: number;
    lastStatus?: string;
};

type ShelfView = {
    container: GameObjects.Container;
    rect: GameObjects.Rectangle;
    label: GameObjects.Text;
};

export class ShopScene extends Scene {
    private sim!: SimGame;
    private hudText!: GameObjects.Text;
    private customerViews = new Map<string, CustomerView>();
    private shelfViews = new Map<number, ShelfView>();
    private snapshotAccumulatorMs = 0;

    private shopBounds!: Geom.Rectangle;
    private floorZone!: GameObjects.Rectangle;
    private entrancePoint!: WorldPoint;
    private exitPoint!: WorldPoint;
    private checkoutPoint!: WorldPoint;
    private battlePoint!: WorldPoint;

    private player!: GameObjects.Sprite;
    private playerMoving = false;
    private playerReturnEvent?: Phaser.Time.TimerEvent;
    private updateErrorCount = 0;

    private shelfPoints: WorldPoint[] = [];

    constructor() {
        super('ShopScene');
    }

    create() {
        // World: outside + shop interior.
        this.add.tileSprite(512, 384, 1024, 768, 'outside_world_tile').setDepth(-100);

        this.shopBounds = new Geom.Rectangle(160, 110, 760, 560);
        const shopCx = this.shopBounds.centerX;
        const shopCy = this.shopBounds.centerY;

        this.add
            .tileSprite(
                shopCx,
                shopCy,
                this.shopBounds.width,
                this.shopBounds.height,
                'shop_floor_tile',
            )
            .setDepth(-50);

        this.add
            .rectangle(shopCx, shopCy, this.shopBounds.width, this.shopBounds.height, 0x000000, 0)
            .setStrokeStyle(6, 0x1f2937)
            .setDepth(-40);

        // Input zone for click-to-walk (player)
        this.floorZone = this.add
            .rectangle(
                shopCx,
                shopCy,
                this.shopBounds.width,
                this.shopBounds.height,
                0x000000,
                0.001,
            )
            .setDepth(-30)
            .setInteractive({ cursor: 'pointer' });

        this.sim = new SimGame();

        // Best-effort load on startup (storage access can throw in some environments).
        try {
            const loaded = loadFromStorage(window.localStorage, SAVE_KEY);
            if (loaded.ok) {
                this.sim.state = loaded.state;
            }
        } catch (err) {
            console.warn('[ShopScene] loadFromStorage failed (continuing)', err);
        }

        this.hudText = this.add
            .text(12, 12, '', {
                fontFamily: 'monospace',
                fontSize: 16,
                color: '#ffffff',
            })
            .setDepth(1000);

        // Key world points
        this.checkoutPoint = {
            x: this.shopBounds.left + 110,
            y: this.shopBounds.bottom - 90,
        };
        this.entrancePoint = {
            x: this.shopBounds.left - 60,
            y: this.shopBounds.bottom - 120,
        };
        this.exitPoint = {
            x: this.shopBounds.left - 90,
            y: this.shopBounds.bottom - 120,
        };
        this.battlePoint = { x: this.shopBounds.centerX + 40, y: this.shopBounds.centerY + 80 };

        // Checkout table (placeholder shape until you add a table sprite)
        this.add
            .rectangle(this.checkoutPoint.x, this.checkoutPoint.y, 170, 80, 0x3b2a1a)
            .setStrokeStyle(3, 0x1f140c)
            .setDepth(5);
        this.add
            .text(this.checkoutPoint.x, this.checkoutPoint.y, 'Checkout', {
                fontFamily: 'monospace',
                fontSize: 14,
                color: '#ffffff',
            })
            .setOrigin(0.5)
            .setDepth(6);

        // Player (shopkeeper)
        this.player = this.add
            .sprite(
                this.checkoutPoint.x + 54,
                this.checkoutPoint.y + 10,
                'player_shopkeeper_sheet',
                0,
            )
            .setDepth(20);
        this.player.anims.stop();
        this.player.setFrame(0);

        // Click-to-walk inside the shop.
        this.floorZone.on('pointerdown', (p: Phaser.Input.Pointer) => {
            const x = PhaserMath.Clamp(
                p.worldX,
                this.shopBounds.left + 20,
                this.shopBounds.right - 20,
            );
            const y = PhaserMath.Clamp(
                p.worldY,
                this.shopBounds.top + 20,
                this.shopBounds.bottom - 20,
            );
            this.movePlayerTo({ x, y }, { returnToCheckoutAfterMs: 4000 });
        });

        EventBus.on('sim:action', this.onSimAction, this);
        EventBus.on('sim:save', this.onSaveRequest, this);
        EventBus.on('sim:load', this.onLoadRequest, this);
        this.events.once('shutdown', this.shutdown, this);

        this.emitSnapshot();
        EventBus.emit('current-scene-ready', this);
    }

    shutdown() {
        EventBus.off('sim:action', this.onSimAction, this);
        EventBus.off('sim:save', this.onSaveRequest, this);
        EventBus.off('sim:load', this.onLoadRequest, this);

        // Safety: ensure no lingering movement timers/tweens can throw after shutdown.
        if (this.playerReturnEvent) {
            this.playerReturnEvent.remove(false);
            this.playerReturnEvent = undefined;
        }
        this.tweens.killAll();
    }

    update(_time: number, deltaMs: number) {
        try {
            const dtSeconds = deltaMs / 1000;
            const events = this.sim.tick(dtSeconds);

            // Autosave at night start.
            for (const e of events) {
                if (e.type === 'phaseChanged' && e.to === 'night') {
                    saveToStorage(window.localStorage, this.sim.state, SAVE_KEY);
                    EventBus.emit('sim:autosaved');
                }
            }

            this.snapshotAccumulatorMs += deltaMs;
            if (this.snapshotAccumulatorMs >= 100) {
                this.snapshotAccumulatorMs = 0;
                this.emitSnapshot();
            }

            // When paused, keep UI snapshots flowing but freeze world motion.
            if (!this.sim.state.paused) {
                this.updateWorld();
            }
        } catch (err) {
            // If anything in the frame throws, keep the game loop alive.
            this.updateErrorCount += 1;
            console.error('[ShopScene] update error (loop continues)', err);

            // Still try to emit a snapshot so UI can recover.
            try {
                this.emitSnapshot();
            } catch {
                // ignore
            }
        }
    }

    private onSimAction(action: SimAction) {
        // Visual: when stocking a shelf, have the shopkeeper walk over to it.
        if (action.type === 'stockShelf') {
            const slotCount = this.sim.snapshot().shop.shelves.slots.length;
            this.movePlayerTo(this.getShelfPoint(action.slotIndex, slotCount), {
                returnToCheckoutAfterMs: 1200,
            });
        }

        const res = this.sim.dispatch(action);

        // Keep Phaser visuals in sync with sim pause state.
        // (Otherwise tweens/timers would keep animating even while sim time is frozen.)
        if (action.type === 'togglePause') {
            if (this.sim.state.paused) {
                this.tweens.pauseAll();
                this.time.timeScale = 0;
            } else {
                this.time.timeScale = 1;
                this.tweens.resumeAll();
            }
        }

        if (res.ok && res.events) {
            for (const e of res.events) EventBus.emit('sim:event', e);
        }
        this.emitSnapshot();
    }

    private onSaveRequest() {
        try {
            saveToStorage(window.localStorage, this.sim.state, SAVE_KEY);
            EventBus.emit('sim:saved');
        } catch (err) {
            console.warn('[ShopScene] saveToStorage failed', err);
            EventBus.emit('sim:saveFailed', String(err));
        } finally {
            this.emitSnapshot();
        }
    }

    private onLoadRequest() {
        try {
            const loaded = loadFromStorage(window.localStorage, SAVE_KEY);
            if (loaded.ok) {
                this.sim.state = loaded.state;
                EventBus.emit('sim:loaded');
            } else {
                EventBus.emit('sim:loadFailed', loaded.reason);
            }
        } catch (err) {
            console.warn('[ShopScene] loadFromStorage failed', err);
            EventBus.emit('sim:loadFailed', 'storage_error');
        } finally {
            this.emitSnapshot();
        }
    }

    private emitSnapshot() {
        const snapshot = this.sim.snapshot();
        EventBus.emit('sim:snapshot', snapshot);
        this.renderHud(snapshot);
        this.syncShelves(snapshot);
        this.syncCustomers(snapshot);
    }

    private renderHud(snapshot: SimSnapshot) {
        const phase = snapshot.phase.toUpperCase();
        const t = Math.ceil(snapshot.phaseTimeRemainingSeconds);

        this.hudText.setText([
            `Day ${snapshot.dayNumber} — ${phase} (${t}s left)`,
            `Money: $${snapshot.money}`,
            `Speed: ${snapshot.speedMultiplier.toFixed(2)}x (tier ${snapshot.speedTier})`,
            `Level: ${snapshot.level} — XP: ${snapshot.xp}/${snapshot.xpToNext} — SP: ${snapshot.skillPoints}`,
            `Unlocked card tier: ${snapshot.unlockedCardTier}`,
            snapshot.paused ? '[PAUSED]' : '',
        ]);
    }

    private syncCustomers(snapshot: SimSnapshot) {
        const seen = new Set<string>();
        const now = this.time.now;

        snapshot.customers.forEach((c) => {
            seen.add(c.id);

            let view = this.customerViews.get(c.id);
            if (!view) {
                const bg = this.add
                    .rectangle(0, 6, 62, 52, 0x000000, 0)
                    .setStrokeStyle(0, 0x000000)
                    .setDepth(12);

                const sprite = this.add.sprite(0, 6, 'knight_walking_sheet', 0).setOrigin(0.5, 0.5);
                sprite.anims.stop();
                sprite.setFrame(0);
                sprite.setDepth(13);

                const label = this.add
                    .text(0, 0, '', {
                        fontFamily: 'monospace',
                        fontSize: 12,
                        color: '#ffffff',
                        align: 'center',
                    })
                    .setOrigin(0.5, 0.5);
                label.setPosition(0, -28);
                label.setDepth(14);

                const container = this.add
                    .container(this.entrancePoint.x, this.entrancePoint.y, [bg, sprite, label])
                    .setSize(70, 70);
                container.setInteractive(
                    new Geom.Rectangle(-35, -35, 70, 70),
                    Geom.Rectangle.Contains,
                );
                container.setDataEnabled();
                container.on('pointerdown', () => {
                    EventBus.emit('sim:customerClicked', c.id);
                    const status = container.getData('status') as string | undefined;
                    if (status === 'waitingBattle') {
                        EventBus.emit('sim:battlePrompt', c.id);
                    }
                });

                view = {
                    container,
                    bg,
                    sprite,
                    label,
                    mode: 'entering',
                    moving: false,
                    nextWanderAtMs: now + PhaserMath.Between(800, 1600),
                    lastSeenAtMs: now,
                    lastStatus: c.status,
                };
                this.customerViews.set(c.id, view);

                // Walk into the shop, then begin wandering.
                const firstDest = this.randomInteriorPoint();
                this.moveCustomerTo(view, firstDest, () => {
                    view.mode = c.status === 'waitingBattle' ? 'battleWaiting' : 'wandering';
                    view.nextWanderAtMs = this.time.now + PhaserMath.Between(900, 2500);
                });
            }

            view.lastSeenAtMs = now;

            const isBattle = c.status === 'waitingBattle';
            if (isBattle) {
                view.bg.setFillStyle(0x3b1f2a, 0.2);
                view.bg.setStrokeStyle(2, 0xe58a8a);
            } else {
                view.bg.setFillStyle(0x000000, 0);
                view.bg.setStrokeStyle(0, 0x000000);
            }
            view.container.setData('status', c.status);

            if (view.lastStatus !== c.status) {
                view.lastStatus = c.status;
                if (c.status === 'waitingBattle') {
                    view.mode = 'battleWaiting';
                } else if (view.mode === 'battleWaiting') {
                    view.mode = 'wandering';
                }
            }

            view.label.setText(c.name);
        });

        // Despawn visuals: walk out instead of popping off-screen.
        for (const [id, view] of this.customerViews) {
            if (seen.has(id)) continue;
            if (view.mode === 'exiting') continue;
            view.mode = 'exiting';
            // If they were mid-walk (e.g. a sale completed), cancel the old tween first.
            this.tweens.killTweensOf(view.container);
            view.moving = false;
            this.moveCustomerTo(view, this.exitPoint, () => {
                view.container.destroy(true);
                this.customerViews.delete(id);
            });
        }
    }

    private syncShelves(snapshot: SimSnapshot) {
        const slotCount = snapshot.shop.shelves.slots.length;
        if (this.shelfPoints.length !== slotCount) {
            this.shelfPoints = Array.from({ length: slotCount }, (_, idx) =>
                this.getShelfPoint(idx, slotCount),
            );
        }

        const slotH = 56;

        snapshot.shop.shelves.slots.forEach((slot, idx) => {
            const p = this.shelfPoints[idx] ?? this.getShelfPoint(idx, slotCount);
            let view = this.shelfViews.get(idx);
            if (!view) {
                const rect = this.add
                    .rectangle(0, 0, 170, slotH, 0x0f172a)
                    .setStrokeStyle(2, 0x334155)
                    .setDepth(10);
                const label = this.add
                    .text(0, 0, '', {
                        fontFamily: 'monospace',
                        fontSize: 14,
                        color: '#ffffff',
                        align: 'center',
                    })
                    .setOrigin(0.5)
                    .setDepth(11);
                const container = this.add.container(p.x, p.y, [rect, label]).setSize(170, slotH);
                view = { container, rect, label };
                this.shelfViews.set(idx, view);
            }

            view.container.setPosition(p.x, p.y);
            const isEmpty = !slot.skuId || slot.quantity <= 0;
            view.rect.setFillStyle(isEmpty ? 0x0f172a : 0x12304b, 1);
            view.rect.setStrokeStyle(2, isEmpty ? 0x334155 : 0x60a5fa);

            const sku = slot.skuId ?? 'empty';
            view.label.setText(`Shelf ${idx + 1}\n${sku} ${slot.quantity}/${slot.capacity}`);
        });
    }

    private updateWorld() {
        const now = this.time.now;

        // Customers: wander between shelves while present in snapshot.
        for (const view of this.customerViews.values()) {
            if (view.mode === 'exiting' || view.moving) continue;

            if (view.mode === 'battleWaiting') {
                const dx = view.container.x - this.battlePoint.x;
                const dy = view.container.y - this.battlePoint.y;
                if (Math.hypot(dx, dy) > 18) {
                    this.moveCustomerTo(view, this.jitterPoint(this.battlePoint, 24), () => {
                        view.nextWanderAtMs = now + PhaserMath.Between(1200, 2200);
                    });
                }
                continue;
            }

            if (view.mode !== 'wandering') continue;
            if (now < view.nextWanderAtMs) continue;

            const dest = this.pickCustomerWanderDestination();
            this.moveCustomerTo(view, dest, () => {
                view.nextWanderAtMs = now + PhaserMath.Between(900, 2600);
            });
        }

        // Player: (idle return handled by delayedCall)
        void this.playerMoving;
    }

    private pickCustomerWanderDestination(): WorldPoint {
        if (this.shelfPoints.length > 0 && PhaserMath.Between(0, 99) < 80) {
            const i = PhaserMath.Between(0, this.shelfPoints.length - 1);
            return this.jitterPoint(this.shelfPoints[i]!, 38);
        }
        return this.randomInteriorPoint();
    }

    private jitterPoint(p: WorldPoint, radius: number): WorldPoint {
        const angle = PhaserMath.FloatBetween(0, Math.PI * 2);
        const r = PhaserMath.FloatBetween(0, radius);
        const x = PhaserMath.Clamp(
            p.x + Math.cos(angle) * r,
            this.shopBounds.left + 24,
            this.shopBounds.right - 24,
        );
        const y = PhaserMath.Clamp(
            p.y + Math.sin(angle) * r,
            this.shopBounds.top + 24,
            this.shopBounds.bottom - 24,
        );
        return { x, y };
    }

    private randomInteriorPoint(): WorldPoint {
        const x = PhaserMath.Between(this.shopBounds.left + 40, this.shopBounds.right - 40);
        const y = PhaserMath.Between(this.shopBounds.top + 80, this.shopBounds.bottom - 60);
        return { x, y };
    }

    private getShelfPoint(slotIndex: number, slotCount: number): WorldPoint {
        const idx = Math.max(0, Math.min(slotCount - 1, Math.floor(slotIndex)));

        // Place shelves along the top interior wall.
        const left = this.shopBounds.left + 210;
        const right = this.shopBounds.right - 80;
        const t = slotCount <= 1 ? 0 : idx / (slotCount - 1);
        const x = left + (right - left) * t;
        const y = this.shopBounds.top + 86;
        return { x, y };
    }

    private moveCustomerTo(view: CustomerView, dest: WorldPoint, onArrive?: () => void) {
        if (!view.container.active) {
            view.moving = false;
            return;
        }

        // Prevent tween stacking (a common source of eventual lockups / errors).
        this.tweens.killTweensOf(view.container);

        view.moving = true;
        const from = { x: view.container.x, y: view.container.y };
        const dx = dest.x - from.x;
        const dy = dest.y - from.y;
        const animKey = this.pickWalkAnim('knight', dx, dy);
        if (this.anims.exists(animKey)) view.sprite.play(animKey, true);

        const speed = 120; // px/sec
        const duration = Math.max(250, (Math.hypot(dx, dy) / speed) * 1000);
        this.tweens.add({
            targets: view.container,
            x: dest.x,
            y: dest.y,
            duration,
            ease: 'Sine.easeInOut',
            onComplete: () => {
                view.moving = false;
                if (view.sprite.active) {
                    view.sprite.anims.stop();
                    view.sprite.setFrame(0);
                }
                onArrive?.();
            },
        });
    }

    private movePlayerTo(dest: WorldPoint, opts?: { returnToCheckoutAfterMs?: number }) {
        if (this.playerReturnEvent) {
            this.playerReturnEvent.remove(false);
            this.playerReturnEvent = undefined;
        }

        // Prevent tween stacking on the player.
        this.tweens.killTweensOf(this.player);

        const from = { x: this.player.x, y: this.player.y };
        const dx = dest.x - from.x;
        const dy = dest.y - from.y;
        const animKey = this.pickWalkAnim('player_shopkeeper', dx, dy);
        if (this.anims.exists(animKey)) this.player.play(animKey, true);
        this.playerMoving = true;

        const speed = 150; // px/sec
        const duration = Math.max(200, (Math.hypot(dx, dy) / speed) * 1000);
        this.tweens.add({
            targets: this.player,
            x: dest.x,
            y: dest.y,
            duration,
            ease: 'Sine.easeInOut',
            onComplete: () => {
                this.playerMoving = false;
                this.player.anims.stop();
                this.player.setFrame(0);

                const returnDelay = opts?.returnToCheckoutAfterMs;
                if (returnDelay != null) {
                    this.playerReturnEvent = this.time.delayedCall(returnDelay, () => {
                        this.movePlayerTo(
                            { x: this.checkoutPoint.x + 54, y: this.checkoutPoint.y + 10 },
                            undefined,
                        );
                    });
                }
            },
        });
    }

    private pickWalkAnim(kind: 'knight' | 'player_shopkeeper', dx: number, dy: number): string {
        const ax = Math.abs(dx);
        const ay = Math.abs(dy);
        if (ax >= ay) {
            return dx < 0 ? `${kind}_walk_left` : `${kind}_walk_right`;
        }
        return dy < 0 ? `${kind}_walk_up` : `${kind}_walk_down`;
    }
}
