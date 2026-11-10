export const TRAVEL_MAP_REFERENCE = {
  id: 'faerun-atlas-v3', coordinates: 'percent', width: 7990, height: 5635,
  kmPerXPercent: 61.1, kmPerYPercent: 43.1,
} as const;
export interface RoutePoint { x: number; y: number; }
export interface RouteSource {
  id: string; name: string; kind: 'own' | 'external' | 'synthetic';
  reference: string; attribution: string; license: string; usageConfirmed: boolean;
}
export interface RouteCoverage {
  id: string; name: string; sourceId: string;
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
}
export interface RouteNode extends RoutePoint {
  id: string; name: string; sourceId: string; boarding: boolean;
}
export interface RouteEdge {
  id: string; from: string; to: string; sourceId: string; geometry: RoutePoint[];
  modes: ('foot' | 'boat')[]; direction: 'both' | 'forward';
  kind: 'road' | 'trail' | 'off-road' | 'water';
  crossing: 'none' | 'bridge' | 'ford';
  terrain: 'plain' | 'forest' | 'hills' | 'mountain' | 'swamp' | 'water';
}
export interface TravelNetwork {
  format: 'la-carta-sellada:travel-network'; version: 1; id: string; name: string; revision: number;
  dataKind: 'own' | 'external' | 'synthetic'; map: typeof TRAVEL_MAP_REFERENCE;
  sources: RouteSource[]; coverage: RouteCoverage[]; nodes: RouteNode[]; edges: RouteEdge[];
}
export const networkStorageKey=(campaign:string):string=>`la-carta-sellada:travel-network:v1:campaign:${campaign}`;

/** Plantilla vacía: no inventa carreteras, conexiones ni zonas cubiertas. */
export function emptyTravelNetwork(): TravelNetwork {
  return { format: 'la-carta-sellada:travel-network', version: 1, id: 'red-propia', name: 'Red propia', revision: 1,
    dataKind: 'own', map: {...TRAVEL_MAP_REFERENCE}, sources: [{id:'director',name:'Configuración del director',kind:'own',
      reference:'Trazado manual del director',attribution:'Director de la campaña',license:'Uso propio de la campaña',usageConfirmed:true}],
    coverage: [], nodes: [], edges: [] };
}
