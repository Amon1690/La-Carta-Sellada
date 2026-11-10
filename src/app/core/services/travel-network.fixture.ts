import { emptyTravelNetwork, TravelNetwork } from '../models/travel-network';
/** Geometría arbitraria de pruebas. No representa caminos ni lugares de Faerûn. */
export function syntheticNetwork():TravelNetwork {
  return {...emptyTravelNetwork(),id:'fixture',name:'Red sintética de pruebas',dataKind:'synthetic',
    sources:[{id:'test',name:'Fixture sintética',kind:'synthetic',reference:'Coordenadas arbitrarias para pruebas',attribution:'Pruebas del proyecto',license:'Solo datos sintéticos',usageConfirmed:true}],
    coverage:[{id:'test-area',name:'Zona de prueba',sourceId:'test',bounds:{minX:0,minY:0,maxX:10,maxY:10}}],
    nodes:[{id:'a',name:'A',x:1,y:1,sourceId:'test',boarding:false},{id:'b',name:'B',x:3,y:1,sourceId:'test',boarding:true},{id:'c',name:'C',x:3,y:3,sourceId:'test',boarding:true}],
    edges:[{id:'road',from:'a',to:'b',sourceId:'test',geometry:[{x:1,y:1},{x:2,y:1},{x:3,y:1}],modes:['foot'],direction:'both',kind:'road',terrain:'plain',crossing:'none'},
      {id:'river',from:'b',to:'c',sourceId:'test',geometry:[{x:3,y:1},{x:3,y:3}],modes:['boat'],direction:'forward',kind:'water',terrain:'water',crossing:'none'}]};
}
