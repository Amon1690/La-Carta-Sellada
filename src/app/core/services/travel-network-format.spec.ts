import { assertTravelNetwork, networkCoversPoint, networkEdgeDistance, parseTravelNetwork } from './travel-network-format';
import { emptyTravelNetwork } from '../models/travel-network';
import { syntheticNetwork } from './travel-network.fixture';

describe('Contrato de redes de viaje',()=>{
  it('parte sin geometría inventada y conserva medios, dirección y polilínea al importar',()=>{
    expect(()=>assertTravelNetwork(emptyTravelNetwork())).not.toThrow();
    const n=syntheticNetwork(),copy=parseTravelNetwork(JSON.stringify(n));expect(copy).toEqual(n);
    expect(networkEdgeDistance(copy.edges[0])).toBeCloseTo(122.2,10);expect(networkEdgeDistance(copy.edges[1])).toBeCloseTo(86.2,10);
    expect(networkCoversPoint(copy,{x:50,y:50})).toBeFalse();
  });
  for(const [name,mutate] of [
    ['versión futura',(n:any)=>n.version=2],['escala incompatible',(n:any)=>n.map.kmPerXPercent=1],
    ['coordenadas no finitas',(n:any)=>n.nodes[0].x=Infinity],['fuente inexistente',(n:any)=>n.edges[0].sourceId='missing'],
    ['nodo inexistente',(n:any)=>n.edges[0].to='missing'],['identificador duplicado',(n:any)=>n.nodes.push({...n.nodes[0]})],
    ['polilínea incompleta',(n:any)=>n.edges[0].geometry.pop()],['polilínea vacía',(n:any)=>n.edges[0].geometry=[]],
    ['caminar sobre agua',(n:any)=>n.edges[1].modes=['foot']],['transbordo implícito',(n:any)=>n.nodes[1].boarding=false],
    ['fixture presentada como real',(n:any)=>n.dataKind='external'],['licencia externa pendiente',(n:any)=>{n.sources[0].kind='external';n.dataKind='external';n.sources[0].usageConfirmed=false;}],
  ] as [string,(n:any)=>void][])it(`rechaza ${name}`,()=>{const n=syntheticNetwork();mutate(n);expect(()=>assertTravelNetwork(n)).toThrow();});
  it('exige puentes o vados explícitos y no añade enlaces por proximidad',()=>{
    const n=syntheticNetwork();n.edges=n.edges.slice(0,1);n.edges[0].terrain='water';
    expect(()=>assertTravelNetwork(n)).toThrow();
    for(const crossing of ['bridge','ford'] as const){n.edges[0].crossing=crossing;expect(()=>assertTravelNetwork(n)).not.toThrow();}
    const copy=parseTravelNetwork(JSON.stringify(n));expect(copy.edges.length).toBe(1);expect(copy.nodes.length).toBe(3);
  });
  it('mide la polilínea completa, no solo la recta entre sus extremos',()=>{
    const n=syntheticNetwork();n.edges[0].geometry[1]={x:2,y:2};assertTravelNetwork(n);
    expect(networkEdgeDistance(n.edges[0])).toBeCloseTo(2*Math.hypot(61.1,43.1),10);
    expect(networkEdgeDistance(n.edges[0])).toBeGreaterThan(122.2);
  });
  it('rechaza un hueco sin cobertura aunque todos los vértices estén cubiertos',()=>{
    const n=syntheticNetwork();n.edges=n.edges.slice(0,1);n.nodes=n.nodes.slice(0,2);n.edges[0].geometry=[n.nodes[0],n.nodes[1]].map(({x,y})=>({x,y}));
    n.coverage=[{...n.coverage[0],bounds:{minX:0,minY:0,maxX:1.5,maxY:10}},{...n.coverage[0],id:'right',bounds:{minX:2.5,minY:0,maxX:4,maxY:10}}];
    expect(()=>assertTravelNetwork(n)).toThrowError(/cobertura/);
    n.coverage[1].bounds.minX=1.5;expect(()=>assertTravelNetwork(n)).not.toThrow();
  });
  it('rechaza campos reservados, JSON inválido y un archivo excesivo',()=>{
    const n=syntheticNetwork();expect(()=>parseTravelNetwork(JSON.stringify(n).replace('"revision":1','"__proto__":{},"revision":1'))).toThrow();
    expect(()=>parseTravelNetwork('{')).toThrow();expect(()=>parseTravelNetwork(' '.repeat(1024*1024+1))).toThrow();
  });
});
