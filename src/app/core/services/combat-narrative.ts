import { CombatNarrativeMessage, CombatResolution } from '../models/combat';
import { BoardVisionState, VisionProfile } from '../models/vision';
import { PreviewFog, PreviewToken, previewSight, previewTokenVisible } from './vision-preview';

/** Visibilidad y audiencia fijadas al resolver la acción, sin leer el registro privado. */
export function combatNarrative(result: CombatResolution, tokens: (PreviewToken & { name: string })[],
  observers: { instanceId: string; audience: string[] }[], vision: BoardVisionState,
  profiles: Map<string, VisionProfile | undefined>, fog: PreviewFog[], grid: number, width: number, height: number
): CombatNarrativeMessage[] {
  const attacker = tokens.find((token) => token.instanceId === result.attackerId);
  const target = tokens.find((token) => token.instanceId === result.targetId);
  if (!attacker || !target || !vision.enabled) return [];
  return observers.flatMap(({ instanceId, audience }) => {
    const observer = tokens.find((token) => token.instanceId === instanceId);
    if (!observer || observer.hidden || !audience.length) return [];
    const personal = { ...vision, groups: [{ id: 'personal', name: 'Personal', observerIds: [instanceId] }], activeGroupId: 'personal' };
    const geometry = previewSight(personal, tokens, profiles, grid, width, height);
    if (geometry.pending) return [];
    const sees = (token: PreviewToken) => token.instanceId === instanceId || previewTokenVisible(token, geometry.circles, fog, grid);
    const seesAttacker = sees(attacker), seesTarget = sees(target);
    if (!seesAttacker && !seesTarget) return [];
    const subject = seesAttacker ? attacker.name : 'Alguien';
    const text = !seesTarget ? `${subject} realiza un ataque fuera de tu vista.`
      : result.damage > 0 ? `${subject} ataca a ${target.name} y le hace ${result.damage} de daño.`
      : !result.hit ? `${subject} ataca a ${target.name}. Su ataque falla.`
      : `${subject} ataca a ${target.name}. No causa daño.`;
    return [{ observerId: instanceId, audience: [...audience], text }];
  });
}
