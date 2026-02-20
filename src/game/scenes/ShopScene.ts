import { GameObjects, Geom, Scene } from 'phaser';
import { EventBus } from '../EventBus';
import {
    loadFromStorage,
    saveToStorage,
    SAVE_KEY,
    SimGame,
    type SimAction,
    type SimSnapshot,
} from '../../sim';

type CustomerView = {
    container: GameObjects.Container;
    rect: GameObjects.Rectangle;
    label: GameObjects.Text;
};

export class ShopScene extends Scene {
    private sim!: SimGame;
    private hudText!: GameObjects.Text;
    private customerViews = new Map<string, CustomerView>();
    private snapshotAccumulatorMs = 0;

    constructor() {
        super('ShopScene');
    }

    create() {
        this.add.rectangle(512, 384, 1024, 768, 0x0b1020).setDepth(-10);

        this.sim = new SimGame();

        // Best-effort load on startup.
        const loaded = loadFromStorage(window.localStorage, SAVE_KEY);
        if (loaded.ok) {
            this.sim.state = loaded.state;
        }

        this.hudText = this.add
            .text(12, 12, '', {
                fontFamily: 'monospace',
                fontSize: 16,
                color: '#ffffff',
            })
            .setDepth(1000);

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
    }

    update(_time: number, deltaMs: number) {
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
    }

    private onSimAction(action: SimAction) {
        const res = this.sim.dispatch(action);
        if (res.ok && res.events) {
            for (const e of res.events) EventBus.emit('sim:event', e);
        }
        this.emitSnapshot();
    }

    private onSaveRequest() {
        saveToStorage(window.localStorage, this.sim.state, SAVE_KEY);
        EventBus.emit('sim:saved');
        this.emitSnapshot();
    }

    private onLoadRequest() {
        const loaded = loadFromStorage(window.localStorage, SAVE_KEY);
        if (loaded.ok) {
            this.sim.state = loaded.state;
            EventBus.emit('sim:loaded');
        } else {
            EventBus.emit('sim:loadFailed', loaded.reason);
        }
        this.emitSnapshot();
    }

    private emitSnapshot() {
        const snapshot = this.sim.snapshot();
        EventBus.emit('sim:snapshot', snapshot);
        this.renderHud(snapshot);
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

        // Layout
        const startX = 120;
        const startY = 180;
        const colW = 160;
        const rowH = 90;
        const cols = 5;

        snapshot.customers.forEach((c, idx) => {
            seen.add(c.id);
            const col = idx % cols;
            const row = Math.floor(idx / cols);
            const x = startX + col * colW;
            const y = startY + row * rowH;

            let view = this.customerViews.get(c.id);
            if (!view) {
                const rect = this.add
                    .rectangle(0, 0, 130, 60, 0x1f2a44)
                    .setStrokeStyle(2, 0x6071a8);
                const label = this.add
                    .text(0, 0, '', {
                        fontFamily: 'monospace',
                        fontSize: 14,
                        color: '#ffffff',
                        align: 'center',
                    })
                    .setOrigin(0.5);

                const container = this.add.container(x, y, [rect, label]).setSize(130, 60);
                container.setInteractive(
                    new Geom.Rectangle(-65, -30, 130, 60),
                    Geom.Rectangle.Contains,
                );
                container.on('pointerdown', () => {
                    EventBus.emit('sim:customerClicked', c.id);
                    if (c.status === 'waitingBattle') {
                        EventBus.emit('sim:battlePrompt', c.id);
                    }
                });

                view = { container, rect, label };
                this.customerViews.set(c.id, view);
            }

            view.container.setPosition(x, y);

            const isBattle = c.status === 'waitingBattle';
            view.rect.setFillStyle(isBattle ? 0x3b1f2a : 0x1f2a44, 1);
            view.rect.setStrokeStyle(2, isBattle ? 0xe58a8a : 0x6071a8);

            view.label.setText(`${c.name} (T${c.tier})\n${c.intent} — ${c.status}`);
        });

        // Remove stale
        for (const [id, view] of this.customerViews) {
            if (seen.has(id)) continue;
            view.container.destroy(true);
            this.customerViews.delete(id);
        }
    }
}
