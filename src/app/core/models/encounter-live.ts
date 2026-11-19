import type { BoardVisionState } from './vision';
import type { CombatCondition, CombatSide, TurnAction } from './combat';

export interface LiveToken {
  instanceId: string; actorId: string; name: string; image: string;
  x: number; y: number; size: number; hp: number; maxHp: number; initiative: number; hidden: boolean;
  conditions?: CombatCondition[]; side?: CombatSide;
}
export interface LiveBoardState {
  tokens: LiveToken[]; fogRects: { id: string; x: number; y: number; width: number; height: number }[];
  layers: { grid: boolean; fog: boolean; tokens: boolean; labels: boolean };
  vision?: BoardVisionState; combat?: unknown; activeTurnId?: string; zoom: number;
}
export interface PlayerTarget { id: string; name: string; x: number; y: number; size: number; }
export interface PlayerAttack { source: string; name: string; targetIds: string[]; area?: { radius: number; cells: number[] }; }
export interface PlayerControls {
  position: { x: number; y: number; size: number }; canMove: boolean; canAttack: boolean;
  cells: number[]; targets: PlayerTarget[]; attacks: PlayerAttack[];
  movement?: { active: boolean; speed?: number; spent: number; remaining?: number; actionUsed: boolean; bonusUsed: boolean; disengaged: boolean; message: string; options: TurnAction[]; routes: { cell: number; path: number[]; cost: number }[] };
}
export interface EncounterCommand {
  id: string; userId: string; observerId: string; type: 'move' | 'attack' | 'turn'; expiresAt: number; sheetRevision: number;
  cell?: number; source?: string; targetId?: string; path?: number[];
}
export interface CommandReceipt { id: string; status: 'applied' | 'rejected'; message: string; }
export interface DirectorEncounter {
  shared: boolean; revision?: number; sheetRevision?: number; state?: LiveBoardState; pendingCommand?: EncounterCommand; changed?: boolean;
}
