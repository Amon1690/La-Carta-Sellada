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
  gameTime?: { day: number; minuteOfDay: number };
  source?: VisionSource;
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
  illumination?: 'bright' | 'dim';
  obscurement?: 'light' | 'heavy';
  grantedSense?: SourcedSense;
}
export interface BoardVisionState {
  version: 1;
  enabled: boolean;
  environment: VisionEnvironment;
  groups: VisionGroup[];
  activeGroupId?: string;
  effects: VisionEffect[];
}
