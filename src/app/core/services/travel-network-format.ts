import { RouteCoverage, RouteEdge, RoutePoint, TravelNetwork, TRAVEL_MAP_REFERENCE } from '../models/travel-network';

export const NETWORK_MAX_BYTES = 1024 * 1024;
const fail = (message: string): never => { throw new Error(`Red no válida: ${message}. No se han cambiado datos.`); };
type Data = Record<string, unknown>;
function object(value: unknown, keys: string[], path: string): Data {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fail(path);
  const data = value as Data;
  if (Object.keys(data).some((key) => !keys.includes(key))) fail(`${path}: campo desconocido`);
  return data;
}
function text(value: unknown, path: string, max = 2000): string {
  return typeof value === 'string' && !!value.trim() && value.length <= max ? value : fail(path);
}
function id(value: unknown, path: string): string {
  const result = text(value, path, 120);
  if (!/^[a-zA-Z0-9_-]+$/.test(result) || ['__proto__','constructor','prototype'].includes(result)) fail(path);
  return result;
}
function list(value: unknown, path: string, max: number): unknown[] {
  return Array.isArray(value) && value.length <= max ? value : fail(path);
}
function number(value: unknown, path: string, min = 0, max = 100): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max ? value : fail(path);
}
function boolean(value: unknown, path: string): void { if (typeof value !== 'boolean') fail(path); }
function choice(value: unknown, choices: readonly string[], path: string): void { if (!choices.includes(value as string)) fail(path); }
function point(value: unknown): void {
  const p=object(value,['x','y'],'coordenadas'); number(p['x'],'coordenada X'); number(p['y'],'coordenada Y');
}
const contains = (p: RoutePoint, area: RouteCoverage): boolean => p.x >= area.bounds.minX && p.x <= area.bounds.maxX && p.y >= area.bounds.minY && p.y <= area.bounds.maxY;
export const networkCoversPoint = (network: TravelNetwork, p: RoutePoint): boolean => network.coverage.some((area) => contains(p,area));

/** Comprueba todo el segmento contra la unión de coberturas, incluidos huecos entre áreas. */
function segmentCovered(a: RoutePoint, b: RoutePoint, coverage: RouteCoverage[]): boolean {
  const intervals: [number,number][] = [];
  for (const {bounds} of coverage) {
    let start=0, end=1;
    for (const [origin,delta,min,max] of [[a.x,b.x-a.x,bounds.minX,bounds.maxX],[a.y,b.y-a.y,bounds.minY,bounds.maxY]]) {
      if (delta===0) { if (origin<min||origin>max) {start=1;end=0;} }
      else { const t1=(min-origin)/delta,t2=(max-origin)/delta;start=Math.max(start,Math.min(t1,t2));end=Math.min(end,Math.max(t1,t2)); }
    }
    if (start<=end) intervals.push([start,end]);
  }
  let covered=0;
  for (const [start,end] of intervals.sort((a,b)=>a[0]-b[0])) {
    if (start>covered) return false;
    covered=Math.max(covered,end); if (covered>=1) return true;
  }
  return false;
}
export function networkEdgeDistance(edge: RouteEdge): number {
  return edge.geometry.slice(1).reduce((sum,p,i)=>sum+Math.hypot((p.x-edge.geometry[i].x)*TRAVEL_MAP_REFERENCE.kmPerXPercent,(p.y-edge.geometry[i].y)*TRAVEL_MAP_REFERENCE.kmPerYPercent),0);
}
export function assertTravelNetwork(value: unknown): asserts value is TravelNetwork {
  if (new TextEncoder().encode(JSON.stringify(value)).byteLength>NETWORK_MAX_BYTES) fail('archivo mayor de 1 MiB');
  const n=object(value,['format','version','id','name','revision','dataKind','map','sources','coverage','nodes','edges'],'documento');
  if(n['format']!=='la-carta-sellada:travel-network'||n['version']!==1)fail('formato o versión no admitidos');
  id(n['id'],'identificador de red');text(n['name'],'nombre');
  const revision=number(n['revision'],'revisión',1,1e9);if(!Number.isInteger(revision))fail('revisión');
  choice(n['dataKind'],['own','external','synthetic'],'procedencia de red');
  const map=object(n['map'],Object.keys(TRAVEL_MAP_REFERENCE),'referencia del mapa');
  for(const [key,expected] of Object.entries(TRAVEL_MAP_REFERENCE))if(map[key]!==expected)fail(`mapa o escala incompatibles: ${key}`);
  const sourceIds=new Set<string>();
  for(const raw of list(n['sources'],'fuentes',100)) {
    const s=object(raw,['id','name','kind','reference','attribution','license','usageConfirmed'],'fuente');
    const key=id(s['id'],'identificador de fuente');if(sourceIds.has(key))fail('fuentes duplicadas');sourceIds.add(key);
    for(const field of ['name','reference','attribution','license'])text(s[field],`fuente: ${field}`);
    choice(s['kind'],['own','external','synthetic'],'tipo de fuente');boolean(s['usageConfirmed'],'uso de fuente confirmado');
    if(s['kind']==='external'&&s['usageConfirmed']!==true)fail('uso externo pendiente de verificar por el director');
    if(s['kind']==='synthetic'&&n['dataKind']!=='synthetic'||s['kind']==='external'&&n['dataKind']==='own')fail('la procedencia no permite presentar estos datos como propios o reales');
  }
  const source=(v:unknown):void=>{if(!sourceIds.has(id(v,'referencia de fuente')))fail('fuente inexistente');};
  const areaIds=new Set<string>();
  for(const raw of list(n['coverage'],'cobertura',100)) {
    const area=object(raw,['id','name','sourceId','bounds'],'zona de cobertura'),key=id(area['id'],'identificador de zona');
    if(areaIds.has(key))fail('zonas duplicadas');areaIds.add(key);text(area['name'],'nombre de zona');source(area['sourceId']);
    const bounds=object(area['bounds'],['minX','minY','maxX','maxY'],'límites de cobertura');
    const x=number(bounds['minX'],'mínimo X'),y=number(bounds['minY'],'mínimo Y');
    if(number(bounds['maxX'],'máximo X')<=x||number(bounds['maxY'],'máximo Y')<=y)fail('zona de cobertura sin superficie');
  }
  const nodes=new Map<string,unknown>();
  for(const raw of list(n['nodes'],'nodos',2000)) {
    const node=object(raw,['id','name','x','y','sourceId','boarding'],'nodo'),key=id(node['id'],'identificador de nodo');
    if(nodes.has(key))fail('nodos duplicados');nodes.set(key,node);text(node['name'],'nombre de nodo');source(node['sourceId']);
    number(node['x'],'coordenada X de nodo');number(node['y'],'coordenada Y de nodo');boolean(node['boarding'],'embarque');
  }
  const edgeIds=new Set<string>();let points=0;
  for(const raw of list(n['edges'],'aristas',4000)) {
    const edge=object(raw,['id','from','to','sourceId','geometry','modes','direction','kind','crossing','terrain'],'arista'),key=id(edge['id'],'identificador de arista');
    if(edgeIds.has(key))fail('aristas duplicadas');edgeIds.add(key);source(edge['sourceId']);
    const from=id(edge['from'],'origen'),to=id(edge['to'],'destino');if(from===to||!nodes.has(from)||!nodes.has(to))fail('extremo de arista inexistente o repetido');
    const geometry=list(edge['geometry'],'geometría',1000);if(geometry.length<2||(points+=geometry.length)>20000)fail('cantidad de puntos de geometría');geometry.forEach(point);
    const modes=list(edge['modes'],'medios',2);if(!modes.length||new Set(modes).size!==modes.length)fail('medios vacíos o repetidos');modes.forEach((m)=>choice(m,['foot','boat'],'medio'));
    choice(edge['direction'],['both','forward'],'dirección');choice(edge['kind'],['road','trail','off-road','water'],'vía');
    choice(edge['crossing'],['none','bridge','ford'],'paso acuático');choice(edge['terrain'],['plain','forest','hills','mountain','swamp','water'],'terreno');
    if(edge['kind']==='water' ? modes.length!==1||modes[0]!=='boat'||edge['terrain']!=='water'||edge['crossing']!=='none' : modes.length!==1||modes[0]!=='foot'||(edge['terrain']==='water')!==(edge['crossing']!=='none'))fail('medio, vía o paso acuático incompatibles');
  }
  const network=value as TravelNetwork,typedNodes=new Map(network.nodes.map((node)=>[node.id,node])),nodeModes=new Map<string,Set<string>>();
  for(const node of network.nodes)if(!networkCoversPoint(network,node))fail('nodo fuera de cobertura declarada');
  for(const edge of network.edges) {
    const first=edge.geometry[0],last=edge.geometry.at(-1)!,from=typedNodes.get(edge.from)!,to=typedNodes.get(edge.to)!;
    if(first.x!==from.x||first.y!==from.y||last.x!==to.x||last.y!==to.y)fail('la polilínea no coincide con sus extremos');
    if(networkEdgeDistance(edge)<=0)fail('arista de longitud nula');
    for(let i=1;i<edge.geometry.length;i++)if(!segmentCovered(edge.geometry[i-1],edge.geometry[i],network.coverage))fail('tramo fuera de cobertura declarada');
    for(const endpoint of [edge.from,edge.to]) {const modes=nodeModes.get(endpoint)??new Set<string>();edge.modes.forEach((m)=>modes.add(m));nodeModes.set(endpoint,modes);}
  }
  for(const [node,modes] of nodeModes)if(modes.size>1&&!typedNodes.get(node)!.boarding)fail('transbordo sin punto de embarque explícito');
}
export function parseTravelNetwork(raw: string): TravelNetwork {
  if(new TextEncoder().encode(raw).byteLength>NETWORK_MAX_BYTES)fail('archivo mayor de 1 MiB');
  let value:unknown;try{value=JSON.parse(raw);}catch{fail('JSON ilegible');}
  assertTravelNetwork(value);return value;
}
