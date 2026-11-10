import type { BoardVisionState } from '../models/vision';

/** El avance es una decisión explícita del juego; nunca se consulta Date ni un temporizador. */
export function advanceVisionEffects(state: BoardVisionState, elapsed: { kind: 'rounds' | 'minutes'; amount: number }): BoardVisionState {
  if (!Number.isFinite(elapsed.amount) || elapsed.amount < 0 || !Number.isInteger(elapsed.amount)) throw new Error('Indica un número entero no negativo de asaltos o minutos.');
  if (elapsed.amount === 0) return structuredClone(state);
  const time = state.environment.gameTime;
  const seconds = time ? time.day * 86400 + time.minuteOfDay * 60 + (time.second ?? 0) + elapsed.amount * (elapsed.kind === 'rounds' ? 6 : 60) : undefined;
  if (seconds !== undefined && Math.floor(seconds / 86400) > 1000000) throw new Error('El reloj de juego supera el límite admitido.');
  return { ...state, environment: { ...state.environment, ...(seconds === undefined ? {} : { gameTime: {
    day: Math.floor(seconds / 86400), minuteOfDay: Math.floor(seconds % 86400 / 60), second: seconds % 60,
  } }) }, effects: state.effects.map((effect) => {
    if (!effect.active || !('remaining' in effect.duration)) return structuredClone(effect);
    // Un asalto equivale a seis segundos; mantener unidades evita redondear duraciones a cero antes de tiempo.
    const decrement = effect.duration.kind === elapsed.kind ? elapsed.amount : elapsed.kind === 'rounds' ? elapsed.amount / 10 : elapsed.amount * 10;
    const difference = effect.duration.remaining - decrement;
    const tolerance = Number.EPSILON * 16 * Math.max(effect.duration.remaining, decrement);
    const remaining = difference <= tolerance ? 0 : difference;
    return { ...effect, duration: { ...effect.duration, remaining }, active: remaining > 0 };
  }) };
}

/** Terminar concentración conserva los registros de efectos para revisión, sin afectar a otro lanzador. */
export function endVisionConcentration(state: BoardVisionState, tokenId: string): BoardVisionState {
  return { ...state, effects: state.effects.map((effect) => effect.concentrationTokenId === tokenId ? { ...effect, active: false } : structuredClone(effect)) };
}
export function endVisionEffect(state: BoardVisionState, effectId: string): BoardVisionState {
  return { ...state, effects: state.effects.map((effect) => effect.id === effectId ? { ...effect, active: false } : structuredClone(effect)) };
}
