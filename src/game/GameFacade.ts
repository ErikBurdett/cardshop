import { EventBus } from './EventBus';
import type { SimAction, SimEvent, SimSnapshot } from '../sim';

export type Unsubscribe = () => void;

export const GameFacade = {
    dispatch(action: SimAction) {
        EventBus.emit('sim:action', action);
    },
    save() {
        EventBus.emit('sim:save');
    },
    load() {
        EventBus.emit('sim:load');
    },
    onSnapshot(handler: (snapshot: SimSnapshot) => void): Unsubscribe {
        EventBus.on('sim:snapshot', handler);
        return () => EventBus.off('sim:snapshot', handler);
    },
    onSimEvent(handler: (event: SimEvent) => void): Unsubscribe {
        EventBus.on('sim:event', handler);
        return () => EventBus.off('sim:event', handler);
    },
    onBattlePrompt(handler: (customerId: string) => void): Unsubscribe {
        EventBus.on('sim:battlePrompt', handler);
        return () => EventBus.off('sim:battlePrompt', handler);
    },
    onAutosaved(handler: () => void): Unsubscribe {
        EventBus.on('sim:autosaved', handler);
        return () => EventBus.off('sim:autosaved', handler);
    },
};
