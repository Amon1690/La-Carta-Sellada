import { combatNarrative } from './combat-narrative';
import { emptyBoardVision } from './vision-state';
import { VisionProfile } from '../models/vision';

describe('Registro público del combate', () => {
  const source = { kind: 'director' as const, reference: 'Prueba sintética' };
  const profile: VisionProfile = { version: 1, senses: [{ sense: 'normal', rangeFeet: 60, source }] };
  const tokens = () => [{ instanceId: 'bandit', name: 'El bandido', x: 102.4, y: 51.2, size: 1, hidden: false, conditions: [] },
    { instanceId: 'hero', name: 'Valian Foregon', x: 51.2, y: 51.2, size: 1, hidden: false, conditions: [] }];
  const vision = () => ({ ...emptyBoardVision(), enabled: true, obstacles: [], environment: { illumination: 'bright' as const, timeOfDay: 'day' as const, weather: 'clear' as const, source } });
  const observers = [{ instanceId: 'hero', audience: ['player'] }];
  const profiles = new Map([['hero', profile]]);
  function narrate(hit: boolean, damage: number, values = tokens()) {
    return combatNarrative({ attackerId: 'bandit', targetId: 'hero', hit, damage }, values, observers, vision(), profiles, [], 51.2, 1536, 1024);
  }
  it('relata fallo o daño sin nombres de capacidades, tiradas ni defensas', () => {
    expect(narrate(false, 0)[0].text).toBe('El bandido ataca a Valian Foregon. Su ataque falla.');
    expect(narrate(true, 14)[0].text).toBe('El bandido ataca a Valian Foregon y le hace 14 de daño.');
    expect(narrate(true, 0)[0].text).toBe('El bandido ataca a Valian Foregon. No causa daño.');
  });
  it('oculta la identidad de un atacante oculto o fuera del alcance personal', () => {
    const values = tokens(); values[0].hidden = true;
    expect(narrate(true, 14, values)[0].text).toBe('Alguien ataca a Valian Foregon y le hace 14 de daño.');
    values[0].hidden = false; values[0].x = 1500;
    expect(narrate(false, 0, values)[0].text).toBe('Alguien ataca a Valian Foregon. Su ataque falla.');
  });
  it('no revela el objetivo ni el resultado fuera de vista ni sucesos ajenos', () => {
    const values = tokens(); values[1].x = 1500;
    const result = combatNarrative({ attackerId: 'bandit', targetId: 'hero', hit: true, damage: 14 }, values,
      [{ instanceId: 'bandit', audience: ['player'] }], vision(), new Map([['bandit', profile]]), [], 51.2, 1536, 1024);
    expect(result[0].text).toBe('El bandido realiza un ataque fuera de tu vista.');
    values.push({ ...values[0], instanceId: 'observer', x: 700 });
    expect(combatNarrative({ attackerId: 'bandit', targetId: 'hero', hit: true, damage: 14 }, values,
      [{ instanceId: 'observer', audience: ['player'] }], vision(), new Map([['observer', { ...profile, senses: [{ sense: 'normal', rangeFeet: 10, source }] }]]), [], 51.2, 1536, 1024)).toEqual([]);
  });
  it('fija la audiencia al resolver y omite visión pendiente de confirmar', () => {
    const result = narrate(true, 14); observers[0].audience.push('new-owner');
    expect(result[0].audience).toEqual(['player']); observers[0].audience.pop();
    expect(combatNarrative({ attackerId: 'bandit', targetId: 'hero', hit: true, damage: 14 }, tokens(), observers, vision(), new Map(), [], 51.2, 1536, 1024)).toEqual([]);
  });
});
