/** Alcances en pies; coordenadas en el espacio lógico del tablero. No son reglas inferidas. */
export type VisionSense = 'normal' | 'darkvision' | 'blindsight' | 'tremorsense' | 'truesight';
export interface VisionSource { kind: 'rule' | 'director'; reference: string; }
export interface SourcedSense {
  sense: VisionSense;
  /** null solo para vista normal sin límite de alcance registrado; 0 declara ausencia. */
  rangeFeet: number | null;
  source: VisionSource;
}
/** Un perfil/sentido ausente significa desconocido, nunca alcance cero. */
export interface VisionProfile { version: 1; senses: SourcedSense[]; }
export interface VisionEnvironment {
  illumination: 'unknown' | 'bright' | 'dim' | 'darkness';
  timeOfDay: 'unknown' | 'dawn' | 'day' | 'dusk' | 'night';
  weather: 'unknown' | 'clear' | 'rain' | 'snow' | 'fog' | 'other';
  gameTime?: { day: number; minuteOfDay: number; second?: number };
  source?: VisionSource;
  /** Intensidad declarada: el nombre del clima no determina su penalización. */
  obscurement?: 'unknown' | 'none' | 'light' | 'heavy';
}
export interface VisionPoint { x: number; y: number; }
/** Segmentos del plano configurados por dirección; nunca deducidos de la imagen. */
export interface VisionObstacle {
  id: string; name: string; kind: 'wall' | 'door' | 'window' | 'door-window';
  start: VisionPoint; end: VisionPoint; source: VisionSource;
  blocksSight: boolean; blocksEffect: boolean;
  /** Obligatorio para puertas, incluidas las acristaladas; abierta no bloquea. */
  open?: boolean;
}
export interface VisionContact {
  tokenId: string;
  surfaceId?: string;
  airborne?: boolean;
  moving?: boolean;
  subjectKind?: 'creature' | 'object';
  source: VisionSource;
}
export interface VisionGroup { id: string; name: string; observerIds: string[]; }
export type VisionDuration = { kind: 'unknown' | 'until-ended' } |
  { kind: 'rounds' | 'minutes'; remaining: number };
export type VisionScope = { kind: 'tokens'; tokenIds: string[] } |
  { kind: 'circle'; x: number; y: number; radiusFeet: number };
export interface VisionEffect {
  id: string; name: string;
  kind: 'light' | 'magical-darkness' | 'obscurement' | 'blinded' | 'sense';
  source: VisionSource; scope: VisionScope; duration: VisionDuration; active: boolean;
  concentrationTokenId?: string;
  /** Una luz de objeto se desplaza con esta instancia; no implica concentración. */
  anchorTokenId?: string;
  illumination?: 'bright' | 'dim';
  obscurement?: 'light' | 'heavy';
  grantedSense?: SourcedSense;
}
export interface VisionDisk extends VisionPoint { radius: number; }
/** Máscara del terreno visto en un instante, sin tokens ni datos de fichas. */
export interface ExplorationArea extends VisionDisk {
  clip?: VisionDisk;
  exclude?: VisionDisk[];
  shadows?: VisionPoint[][];
  fog?: { x: number; y: number; width: number; height: number }[];
}
export interface ExplorationMemory { tokenId: string; cells: number[]; areas?: ExplorationArea[]; }
export interface BoardVisionState {
  version: 1;
  enabled: boolean;
  environment: VisionEnvironment;
  groups: VisionGroup[];
  activeGroupId?: string;
  effects: VisionEffect[];
  /** Ausente: geometría sin confirmar; []: plano confirmado sin obstáculos. */
  obstacles?: VisionObstacle[];
  /** Contacto confirmado por instancia y encuentro para sentidos de detección. */
  contacts?: VisionContact[];
  /** cells conserva el historial antiguo; areas guarda el contorno exacto nuevo. */
  exploration?: ExplorationMemory[];
}
