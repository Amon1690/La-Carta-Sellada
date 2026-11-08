// Correcciones contrastadas con el manual local español de 2024.
// Las posiciones son del PDF que produjo manual-raw.txt, no páginas inventadas.
export const SPELLS_PER_LEVEL = [34, 64, 63, 52, 41, 48, 34, 21, 18, 16];
export const SUBCLASS_HEADINGS = {
  barbaro: [['Senda del Árbol del Mundo',56,10],['Senda del berserker',57,1],['Senda del corazón salvaje',58,4],['Senda del fanático',59,1]],
  bardo: [['Colegio de la danza',66,12],['Colegio del conocimiento',67,10],['Colegio del glamour',68,1],['Colegio del valor',69,13]],
  brujo: [['Patrón celestial',77,29],['Patrón feérico',78,3],['Patrón infernal',79,22],['Patrón primigenio',80,32]],
  clerigo: [['Dominio de la guerra',87,46],['Dominio de la luz',88,15],['Dominio de la vida',89,29],['Dominio del engaño',90,39]],
  druida: [['Círculo de la luna',98,117],['Círculo de la tierra',100,8],['Círculo de las estrellas',101,51],['Círculo del mar',102,45]],
  explorador: [['Acechador en la penumbra',108,26],['Cazador',109,27],['Errante feérico',110,20],['Señor de las bestias',112,1]],
  guerrero: [['Caballero arcano',117,7],['Campeón',119,40],['Guerrero psiónico',120,29],['Maestro del combate',121,82]],
  hechicero: [['Hechicería aberrante',131,8],['Hechicería de magia salvaje',132,59],['Hechicería dracónica',135,42],['Hechicería mecánica',136,47]],
  mago: [['Abjurador',146,10],['Adivino',147,13],['Evocador',148,1],['Ilusionista',149,1]],
  monje: [['Guerrero de la mano abierta',154,9],['Guerrero de la misericordia',154,57],['Guerrero de la sombra',156,2],['Guerrero de los elementos',156,58]],
  paladin: [['Juramento de entrega',163,17],['Juramento de gloria',164,39],['Juramento de los antiguos',165,68],['Juramento de venganza',166,32]],
  picaro: [['Asesino',172,9],['Embaucador arcano',173,1],['Ladrón',175,1],['Rebanaalmas',176,1]],
};
export const SUBCLASS_END_PAGES = {barbaro:61,bardo:71,brujo:83,clerigo:93,druida:105,explorador:115,guerrero:125,hechicero:139,mago:151,monje:159,paladin:169,picaro:178};

export function repairSpellPages(pages) {
  const result = pages.map((page) => page.replace(/\bHlusionismo\b/g, 'Ilusionismo').replace(/^ESCUPO\s*$/gmi, 'ESCUDO'));
  // PDF 256 tiene las dos columnas entrelazadas. Reconstituir sus tres
  // bloques evita atribuir los componentes y daños de un conjuro al siguiente.
  result[255] = `CASTIGO ABRUMADOR
Encantamiento de nivel 4 (paladín)
Tiempo de lanzamiento: Acción adicional inmediatamente después de acertar con un arma cuerpo a cuerpo o un ataque sin armas
Alcance: Lanzador
Componentes: V
Duración: Instantáneo
El ataque inflige 4d6 de daño psíquico adicional. El objetivo hace una salvación de Sabiduría; si falla, queda aturdido hasta el final de tu siguiente turno. El daño adicional aumenta en 1d6 por cada nivel del espacio por encima de 4.
CASTIGO BRILLANTE
Transmutación de nivel 2 (paladín)
Tiempo de lanzamiento: Acción adicional inmediatamente después de acertar con un arma cuerpo a cuerpo o un ataque sin armas
Alcance: Lanzador
Componentes: V
Duración: Concentración, hasta 1 minuto
El ataque inflige 2d6 de daño radiante adicional. Mientras dure el conjuro, el objetivo emite luz brillante en un radio de 1,5 m, los ataques contra él tienen ventaja y no puede beneficiarse de invisible. El daño aumenta en 1d6 por cada nivel del espacio por encima de 2.
CASTIGO ATRONADOR
Evocación de nivel 1 (paladín)
Tiempo de lanzamiento: Acción adicional inmediatamente después de acertar con un arma cuerpo a cuerpo o un ataque sin armas
Alcance: Lanzador
Componentes: V
Duración: Instantáneo
El golpe es audible a 90 m e inflige 2d6 de daño de trueno adicional. Si el objetivo es una criatura, hace una salvación de Fuerza; si falla, es empujada 3 m respecto a ti y queda derribada. El daño aumenta en 1d6 por cada nivel del espacio por encima de 1.`;
  return result;
}

export function cleanRuleDescription(text) {
  return text
    .split(/LISTA DE CONJUROS DE /)[0]
    .replace(/\bSUBCLASE D(?:EL|E)\s+(?:[A-ZÁÉÍÓÚÑÜ]+(?:\s+|$))+/g, '')
    .replace(/\b(\d{1,2})4(20|12|10|8|6|4)\b/g, '$1d$2')
    .trim();
}
