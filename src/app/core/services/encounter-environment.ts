import { VisionEnvironment } from '../models/vision';
import { assertBoardVision, emptyBoardVision } from './vision-state';

export interface EncounterWorldContext {
  version: 1;
  campaignId: string;
  groupId: string;
  runId: string;
  encounterId: string;
  environment: VisionEnvironment;
}
export const unknownWorldEnvironment = (): VisionEnvironment => ({ ...emptyBoardVision().environment, obscurement: 'unknown' });
export function assertWorldEnvironment(value: unknown): asserts value is VisionEnvironment {
  assertBoardVision({ ...emptyBoardVision(), environment: value }, new Set());
}
export function assertEncounterWorldContext(value: unknown): asserts value is EncounterWorldContext {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Contexto de encuentro no válido.');
  const c = value as Record<string, unknown>;
  if (Object.keys(c).some(k => !['version', 'campaignId', 'groupId', 'runId', 'encounterId', 'environment'].includes(k)) || c['version'] !== 1 ||
      !['campaignId', 'groupId', 'runId', 'encounterId'].every(k => typeof c[k] === 'string' && /^[a-zA-Z0-9_-]{1,120}$/.test(c[k] as string))) throw new Error('Referencias de entorno no válidas.');
  assertWorldEnvironment(c['environment']);
}
export function assertEncounterWorldReference(value: unknown, expected: Partial<Pick<EncounterWorldContext, 'campaignId' | 'groupId' | 'runId' | 'encounterId'>>): asserts value is EncounterWorldContext {
  assertEncounterWorldContext(value);
  for (const [key, target] of Object.entries(expected)) if (target !== undefined && value[key as keyof EncounterWorldContext] !== target) throw new Error('El entorno pertenece a otro grupo, campaña o encuentro.');
}
export function snapshotEncounterWorld(context: EncounterWorldContext): EncounterWorldContext {
  assertEncounterWorldContext(context);
  return structuredClone(context);
}
/** Solo el encuentro exacto de ese grupo. Los textos antiguos no se interpretan como reglas. */
export function findEncounterWorld(travel: unknown, expected: Omit<EncounterWorldContext, 'version' | 'environment'>): EncounterWorldContext | undefined {
  const state = travel as { version?: number; journeys?: Record<string, { pendingEncounter?: { context?: unknown }; logs?: { context?: unknown }[] }> } | null;
  if (!state || state.version !== 2 || !state.journeys || !Object.hasOwn(state.journeys, expected.groupId)) return undefined;
  const journey = state.journeys[expected.groupId];
  if (!journey || !Array.isArray(journey.logs)) return undefined;
  const contexts = [journey.pendingEncounter?.context, ...journey.logs.map(log => log?.context)].filter(c => c !== undefined);
  for (const candidate of contexts) {
    assertEncounterWorldContext(candidate);
    if (candidate.campaignId === expected.campaignId && candidate.groupId === expected.groupId && candidate.runId === expected.runId && candidate.encounterId === expected.encounterId) return structuredClone(candidate);
  }
  return undefined;
}
