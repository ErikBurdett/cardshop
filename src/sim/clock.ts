import type { ClockState, GamePhase, SimEvent } from './types';
import type { SimConfig } from './config';

export function createInitialClock(config: SimConfig): ClockState {
    return {
        phase: 'day',
        timeInPhaseSeconds: 0,
        dayNumber: 1,
        phaseDurationSeconds: config.daySeconds,
    };
}

function durationForPhase(phase: GamePhase, config: SimConfig): number {
    return phase === 'day' ? config.daySeconds : config.nightSeconds;
}

export function tickClock(
    clock: ClockState,
    dtSimSeconds: number,
    config: SimConfig,
): { clock: ClockState; events: SimEvent[] } {
    const events: SimEvent[] = [];
    let phase = clock.phase;
    let time = clock.timeInPhaseSeconds + dtSimSeconds;
    let dayNumber = clock.dayNumber;
    let duration = clock.phaseDurationSeconds;

    // Handle multiple transitions if dt is large (still deterministic).
    while (time >= duration) {
        time -= duration;
        const from = phase;
        const to: GamePhase = from === 'day' ? 'night' : 'day';
        phase = to;
        if (from === 'night' && to === 'day') {
            dayNumber += 1;
        }
        duration = durationForPhase(phase, config);
        events.push({ type: 'phaseChanged', from, to, dayNumber });
    }

    return {
        clock: {
            phase,
            timeInPhaseSeconds: time,
            dayNumber,
            phaseDurationSeconds: duration,
        },
        events,
    };
}

export function getPhaseTimeRemainingSeconds(clock: ClockState): number {
    return Math.max(0, clock.phaseDurationSeconds - clock.timeInPhaseSeconds);
}
