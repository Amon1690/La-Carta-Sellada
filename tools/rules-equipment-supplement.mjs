// Inventario del Manual 2024 (PDF 222-225). Los pesos de aventura se
// contrastan con la tabla limpia del SRD 5.2.1 español, página 103.
const tools = [
  ['Herramientas de albañil','10 po','4 kg',222],['Herramientas de alfarero','10 po','1,5 kg',222],
  ['Herramientas de curtidor','5 po','2,5 kg',222],['Herramientas de ebanista','1 po','2,5 kg',222],
  ['Herramientas de joyero','25 po','1 kg',222],['Herramientas de manitas','50 po','5 kg',222],
  ['Herramientas de soplador de vidrio','30 po','2,5 kg',223],['Herramientas de tejedor','1 po','2,5 kg',223],
  ['Herramientas de zapatero','5 po','2,5 kg',223],['Suministros de alquimista','50 po','4 kg',223],
  ['Suministros de calígrafo','10 po','2,5 kg',223],['Suministros de cervecero','20 po','4,5 kg',223],
  ['Suministros de pintor','10 po','2,5 kg',223],['Útiles de cocinero','1 po','4 kg',223],['Juego','Variable','—',223],
];
const adventure = [
  ['Ácido','25 po','0,5 kg'],['Aljaba','1 po','0,5 kg'],['Antitoxina','50 po','—'],
  ['Ariete portátil','4 po','17,5 kg'],['Barril','2 po','35 kg'],['Bolas de metal','1 po','1 kg'],
  ['Bolsa','5 pp','0,5 kg'],['Botella de cristal','2 po','1 kg'],['Cadena','5 po','5 kg'],
  ['Catalejo','1000 po','0,5 kg'],['Cerradura','10 po','0,5 kg'],['Cesta','4 pp','1 kg'],
  ['Cofre','5 po','12,5 kg'],['Cordel','1 pp','—'],['Cubo','5 pc','1 kg'],['Disfraz','5 po','2 kg'],
  ['Escalera','1 pp','12,5 kg'],['Espejo','5 po','250 g'],['Estuche para mapas o pergaminos','1 po','0,5 kg'],
  ['Estuche para virotes de ballesta','1 po','0,5 kg'],['Frasco','2 pc','0,5 kg'],['Fuego de alquimista','50 po','0,5 kg'],
  ['Jarro','2 pc','2 kg'],['Lámpara','5 pp','0,5 kg'],['Libro','25 po','2,5 kg'],['Linterna de ojo de buey','10 po','1 kg'],
  ['Linterna sorda','5 po','1 kg'],['Lupa','100 po','—'],['Manta','5 pp','1,5 kg'],['Munición','Variable','Variable'],
  ['Olla de hierro','2 po','5 kg'],['Pala','2 po','2,5 kg'],['Paquete de artista','40 po','29,25 kg'],
  ['Paquete de diplomático','39 po','19,5 kg'],['Paquete de erudito','40 po','11 kg'],['Paquete de explorador','10 po','27,5 kg'],
  ['Paquete de explorador de mazmorras','12 po','27,5 kg'],['Paquete de ladrón','16 po','21 kg'],['Paquete de sacerdote','33 po','14,5 kg'],
  ['Perfume','5 po','—'],['Pergamino','1 pp','—'],['Pergamino de conjuro (nivel 1)','50 po','—'],
  ['Pergamino de conjuro (truco)','30 po','—'],['Pluma','2 pc','—'],['Poción de curación','50 po','250 g'],
  ['Polipasto','1 po','2,5 kg'],['Puntas de hierro','1 po','2,5 kg'],['Red','1 po','1,5 kg'],
  ['Ropas de calidad','15 po','3 kg'],['Ropas de viaje','2 po','2 kg'],['Saco','1 pc','250 g'],
  ['Silbato de supervivencia','5 pc','—'],['Trampa para cazar','5 po','12,5 kg'],['Túnica','1 po','2 kg'],
  ['Útiles de escalada','25 po','6 kg'],['Vara','5 pc','3,5 kg'],['Vela','1 pc','—'],['Veneno básico','100 po','—'],['Vial','1 po','—'],
];
const slug = (text) => text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
export function completeEquipment(existing) {
  const entries = new Map(existing.map((item) => [item.id, {...item}]));
  const add = ([name,cost,weight,page=225],category) => {
    const id = slug(name);
    if (entries.has(id)) return;
    entries.set(id, {id,name,summary:`${category} del Manual del Jugador 2024.`,category,cost,
      ...(weight !== '—' ? {weight} : {}), properties:[],tags:['Equipo',category],sourcePage:page-2,
      sourceUrl:'https://media.dndbeyond.com/compendium-images/srd/5.2/SP_SRD_CC_v5.2.1.pdf',
      description:`${name}. Precio: ${cost}. ${weight === '—' ? 'Peso no indicado en la tabla.' : `Peso: ${weight}.`} Consulta el manual para sus usos y las variantes.`});
  };
  for (const row of tools) add(row,row[0] === 'Juego' ? 'Herramienta' : 'Herramienta de artesano');
  for (const row of adventure) add(row,'Equipo de aventura');
  const rope = entries.get('cuerda');
  if (rope) {rope.weight='2,5 kg';rope.description=rope.description.replace('5 kg','2,5 kg');}
  for (const id of ['foco-arcano','foco-druidico','simbolo-sagrado']) {
    const item = entries.get(id);
    if (item) {item.cost='Variable';item.weight='Variable';item.description=`${item.name}: precio y peso variables según el tipo de canalizador elegido. Consulta los tipos del manual.`;}
  }
  const lance = entries.get('lanza-de-caballeria');
  if (lance) {lance.properties=lance.properties.map((p)=>p.startsWith('Pesada')?'Pesada, gran alcance, a dos manos (salvo montado)':p);lance.description='Arma marcial cuerpo a cuerpo. 1d10 de daño perforante; pesada, gran alcance y a dos manos, salvo mientras estás montado. Precio: 10 po. Peso: 3 kg.';}
  return [...entries.values()].sort((a,b)=>a.name.localeCompare(b.name,'es'));
}
