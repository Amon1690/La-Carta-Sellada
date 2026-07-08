import { RuleGenericNpc } from '../models/rules';

type CoreStats = readonly [
  armorClass: number,
  hitPoints: number,
  speed: string,
  initiative: string,
  proficiencyBonus: number,
  challenge: string,
];

type AbilityTuple = readonly [
  strength: number,
  dexterity: number,
  constitution: number,
  intelligence: number,
  wisdom: number,
  charisma: number,
];

type ProfileDetails = Pick<
  RuleGenericNpc,
  'personality' | 'saves' | 'skills' | 'traits' | 'attacks' | 'spells' | 'equipment'
>;

function profile(
  id: string,
  name: string,
  category: string,
  role: string,
  lineage: string,
  summary: string,
  tags: string[],
  stats: CoreStats,
  abilities: AbilityTuple,
  details: Partial<ProfileDetails>
): RuleGenericNpc {
  return {
    id,
    name,
    category,
    role,
    lineage,
    summary,
    tags: Array.from(new Set([category, lineage, ...tags])),
    armorClass: stats[0],
    hitPoints: stats[1],
    speed: stats[2],
    initiative: stats[3],
    proficiencyBonus: stats[4],
    challenge: stats[5],
    abilities: {
      strength: abilities[0],
      dexterity: abilities[1],
      constitution: abilities[2],
      intelligence: abilities[3],
      wisdom: abilities[4],
      charisma: abilities[5],
    },
    personality: details.personality ?? [],
    saves: details.saves ?? [],
    skills: details.skills ?? [],
    traits: details.traits ?? [],
    attacks: details.attacks ?? [],
    spells: details.spells ?? [],
    equipment: details.equipment ?? [],
  };
}

export const GENERIC_NPCS: RuleGenericNpc[] = [
  profile(
    'aldeano', 'Aldeano', 'Civil', 'Habitante común', 'Humanoide',
    'Una persona corriente que conoce las costumbres, rumores y pequeños problemas de su comunidad.',
    ['Social', 'Poblado', 'No combatiente'], [10, 4, '9 m', '+0', 2, '0'], [10, 10, 10, 10, 10, 10],
    {
      personality: ['Práctico y cauteloso ante los desconocidos.', 'Defiende a su familia y su comunidad.'],
      skills: ['Perspicacia +2', 'Una herramienta u oficio +3'],
      traits: ['Conocimiento local. Tiene ventaja para recordar personas, caminos y rumores de su asentamiento.'],
      attacks: ['Herramienta improvisada. Ataque cuerpo a cuerpo: +2; impacto 2 (1d4) de daño contundente.'],
      equipment: ['Ropa común', 'Herramientas de oficio', '1d6 monedas de cobre'],
    }
  ),
  profile(
    'campesino', 'Campesino', 'Civil', 'Trabajador rural', 'Humanoide',
    'Agricultor resistente, habituado al trabajo físico y a reconocer cambios en el clima y la tierra.',
    ['Rural', 'Poblado', 'Trabajador'], [10, 6, '9 m', '+0', 2, '0'], [12, 10, 11, 9, 12, 9],
    {
      personality: ['Directo, trabajador y poco impresionable.'], skills: ['Naturaleza +3', 'Trato con Animales +3'],
      traits: ['Manos curtidas. Tiene ventaja en pruebas para manejar animales de granja o herramientas agrícolas.'],
      attacks: ['Horca. Ataque cuerpo a cuerpo: +3; impacto 4 (1d6 + 1) de daño perforante.'],
      equipment: ['Horca o hoz', 'Ropa de trabajo', 'Provisiones para un día'],
    }
  ),
  profile(
    'nino-callejero', 'Niño callejero', 'Civil', 'Informador y recadero', 'Humanoide',
    'Menor no combatiente que conoce atajos, escondites y conversaciones que los adultos pasan por alto.',
    ['Urbano', 'Informador', 'No combatiente'], [11, 2, '9 m', '+2', 2, '0'], [6, 14, 8, 10, 12, 11],
    {
      personality: ['Curioso, veloz y desconfiado.', 'Prefiere huir antes que enfrentarse a un peligro.'],
      skills: ['Percepción +3', 'Sigilo +4', 'Juego de Manos +4'],
      traits: ['Escurridizo. Puede Destrabarse como acción adicional.', 'Red de rumores. Sabe quién compra, vende o vigila en su barrio.'],
      equipment: ['Ropa gastada', 'Tiza', 'Canicas', 'Una baratija encontrada'],
    }
  ),
  profile(
    'comerciante', 'Comerciante', 'Civil', 'Vendedor y negociador', 'Humanoide',
    'Profesional de mercados y rutas comerciales capaz de valorar mercancías y detectar tratos sospechosos.',
    ['Social', 'Urbano', 'Comercio'], [11, 9, '9 m', '+1', 2, '1/8'], [9, 12, 10, 13, 12, 14],
    {
      personality: ['Amable mientras haya negocio.', 'Recuerda cada deuda y cada favor.'],
      skills: ['Engaño +4', 'Perspicacia +3', 'Persuasión +4'],
      traits: ['Tasador. Identifica el valor aproximado y la procedencia probable de bienes corrientes.'],
      attacks: ['Daga. Ataque cuerpo a cuerpo o a distancia: +3; impacto 3 (1d4 + 1) de daño perforante.'],
      equipment: ['Daga', 'Libro de cuentas', 'Balanza', 'Bolsa con 2d10 po'],
    }
  ),
  profile(
    'mercader-influyente', 'Mercader influyente', 'Civil', 'Patrón comercial', 'Humanoide',
    'Propietario de caravanas o almacenes con contactos, escoltas y recursos para mover información.',
    ['Social', 'Urbano', 'Comercio', 'Influyente'], [12, 18, '9 m', '+1', 2, '1/2'], [10, 12, 12, 14, 13, 16],
    {
      personality: ['Cortés, calculador y acostumbrado a delegar.'], saves: ['Sab +3', 'Car +5'],
      skills: ['Engaño +5', 'Historia +4', 'Perspicacia +3', 'Persuasión +5'],
      traits: ['Contactos comerciales. Puede conseguir bienes legales comunes en 1d4 horas dentro de una ciudad.'],
      attacks: ['Bastón estoque. Ataque cuerpo a cuerpo: +3; impacto 4 (1d6 + 1) de daño perforante.'],
      equipment: ['Bastón estoque', 'Ropa de calidad', 'Sello mercantil', 'Bolsa con 5d10 po'],
    }
  ),
  profile(
    'artesano', 'Artesano', 'Civil', 'Especialista de oficio', 'Humanoide',
    'Maestro de un oficio capaz de fabricar, reparar y reconocer la calidad de objetos relacionados con su gremio.',
    ['Urbano', 'Trabajador', 'Gremio'], [11, 8, '9 m', '+1', 2, '1/8'], [11, 12, 11, 13, 11, 10],
    {
      personality: ['Orgulloso de su trabajo y exigente con los aprendices.'], skills: ['Investigación +3', 'Herramienta de artesano +5'],
      traits: ['Maestría artesanal. Duplica su bonificador por competencia con un juego de herramientas.'],
      attacks: ['Martillo ligero. Ataque cuerpo a cuerpo o a distancia: +3; impacto 3 (1d4 + 1) contundente.'],
      equipment: ['Herramientas de artesano', 'Delantal', 'Materiales por valor de 5 po'],
    }
  ),
  profile(
    'herrero', 'Herrero', 'Civil', 'Forjador y reparador', 'Humanoide',
    'Trabajador fuerte que mantiene armas, armaduras, herraduras y cerraduras para una comunidad.',
    ['Urbano', 'Trabajador', 'Gremio'], [12, 15, '9 m', '+0', 2, '1/4'], [15, 10, 14, 11, 11, 10],
    {
      personality: ['Franco, paciente y protector de su reputación.'], saves: ['Fue +4', 'Con +4'], skills: ['Atletismo +4', 'Herramientas de herrero +5'],
      traits: ['Ojo de forja. Reconoce daños, reparaciones y marcas de fabricante en metal trabajado.'],
      attacks: ['Martillo de herrero. Ataque cuerpo a cuerpo: +4; impacto 5 (1d6 + 2) contundente.'],
      equipment: ['Martillo', 'Tenazas', 'Delantal de cuero', 'Herramientas de herrero'],
    }
  ),
  profile(
    'tabernero', 'Tabernero', 'Civil', 'Anfitrión e informador', 'Humanoide',
    'Dueño o encargado de una posada, atento a conflictos, rumores y hábitos de sus clientes.',
    ['Social', 'Urbano', 'Informador'], [11, 11, '9 m', '+0', 2, '1/8'], [12, 10, 12, 11, 14, 13],
    {
      personality: ['Hospitalario con quien respeta la casa.', 'No tolera peleas cerca de su clientela.'],
      skills: ['Perspicacia +4', 'Persuasión +3', 'Percepción +4'],
      traits: ['Oído de la sala. Tiene ventaja para detectar mentiras o tensión entre clientes habituales.'],
      attacks: ['Garrote. Ataque cuerpo a cuerpo: +3; impacto 3 (1d4 + 1) contundente.'],
      equipment: ['Garrote bajo la barra', 'Llaves', 'Libro de cuentas'],
    }
  ),
  profile(
    'erudito', 'Erudito', 'Civil', 'Investigador y asesor', 'Humanoide',
    'Especialista en historia, lenguas o ciencias arcanas que puede descifrar referencias y documentos difíciles.',
    ['Académico', 'Investigación', 'Social'], [10, 7, '9 m', '+0', 2, '1/8'], [8, 10, 10, 16, 14, 11],
    {
      personality: ['Metódico, curioso y propenso a corregir imprecisiones.'], saves: ['Int +5'],
      skills: ['Arcana +5', 'Historia +5', 'Investigación +5', 'Religión +5'],
      traits: ['Campo de estudio. Tiene ventaja al investigar un tema de su especialidad.'],
      attacks: ['Bastón. Ataque cuerpo a cuerpo: +1; impacto 2 (1d6 - 1) contundente.'],
      equipment: ['Bastón', 'Cuaderno', 'Tinta', 'Lupa', 'Dos libros de referencia'],
    }
  ),
  profile(
    'curandero', 'Curandero', 'Civil', 'Sanador comunitario', 'Humanoide',
    'Practicante de medicina mundana y remedios capaz de estabilizar heridos y reconocer enfermedades comunes.',
    ['Sanador', 'Rural', 'Apoyo'], [11, 12, '9 m', '+1', 2, '1/4'], [9, 12, 11, 13, 15, 12],
    {
      personality: ['Sereno ante la sangre y firme con pacientes imprudentes.'], saves: ['Sab +4'], skills: ['Medicina +6', 'Naturaleza +3', 'Perspicacia +4'],
      traits: ['Primeros auxilios. Como acción, estabiliza automáticamente a una criatura a 0 PG que pueda tocar.'],
      attacks: ['Cuchillo. Ataque cuerpo a cuerpo: +3; impacto 3 (1d4 + 1) cortante.'],
      equipment: ['Cuchillo', 'Kit de sanador', 'Hierbas', 'Vendas'],
    }
  ),
  profile(
    'noble', 'Noble', 'Civil', 'Gobernante o heredero', 'Humanoide',
    'Miembro de una casa influyente, educado para negociar, mandar y proteger su posición.',
    ['Social', 'Urbano', 'Influyente'], [15, 16, '9 m', '+1', 2, '1/4'], [11, 12, 11, 12, 14, 16],
    {
      personality: ['Seguro de su rango, pero consciente del valor de las apariencias.'], saves: ['Sab +4', 'Car +5'],
      skills: ['Historia +3', 'Perspicacia +4', 'Persuasión +5'],
      traits: ['Autoridad social. Tiene ventaja al solicitar audiencia o cooperación de sus subordinados.'],
      attacks: ['Estoque. Ataque cuerpo a cuerpo: +3; impacto 5 (1d8 + 1) perforante.'],
      equipment: ['Coraza ligera bajo la ropa', 'Estoque', 'Sello familiar', 'Bolsa con 4d10 po'],
    }
  ),
  profile(
    'mensajero', 'Mensajero', 'Civil', 'Correo y enlace', 'Humanoide',
    'Recadero entrenado para memorizar rutas, reconocer destinatarios y conservar documentos importantes.',
    ['Viajero', 'Urbano', 'Informador'], [12, 9, '10,5 m', '+3', 2, '1/8'], [10, 16, 11, 11, 13, 11],
    {
      personality: ['Puntual, discreto y siempre pendiente de una salida.'], saves: ['Des +5'], skills: ['Acrobacias +5', 'Percepción +3', 'Supervivencia +3'],
      traits: ['Paso ligero. Puede Correr o Destrabarse como acción adicional.'],
      attacks: ['Daga. Ataque cuerpo a cuerpo o a distancia: +5; impacto 5 (1d4 + 3) perforante.'],
      equipment: ['Daga', 'Bolsa de correo impermeable', 'Mapa local', 'Silbato'],
    }
  ),
  profile(
    'guardia', 'Guardia', 'Militar', 'Vigilante profesional', 'Humanoide',
    'Defensor de puertas, calles o propiedades entrenado para contener problemas y pedir refuerzos.',
    ['Urbano', 'Ley', 'Soldado'], [16, 11, '9 m', '+1', 2, '1/4'], [13, 12, 12, 10, 11, 10],
    {
      personality: ['Profesional y atento a conductas sospechosas.'], saves: ['Fue +3'], skills: ['Atletismo +3', 'Percepción +2'],
      traits: ['Alarma. Al inicio de un combate puede alertar a aliados a 90 m que puedan oírlo.'],
      attacks: ['Lanza. Ataque cuerpo a cuerpo o a distancia: +3; impacto 4 (1d6 + 1) perforante.', 'Ballesta ligera. Ataque a distancia: +3; impacto 5 (1d8 + 1) perforante.'],
      equipment: ['Cota de malla', 'Escudo', 'Lanza', 'Ballesta ligera', 'Silbato'],
    }
  ),
  profile(
    'guardia-veterano', 'Guardia veterano', 'Militar', 'Vigilante experimentado', 'Humanoide',
    'Guardia curtido que mantiene la formación, identifica amenazas y coordina a compañeros menos expertos.',
    ['Urbano', 'Ley', 'Soldado', 'Veterano'], [17, 32, '9 m', '+2', 2, '2'], [15, 14, 14, 11, 13, 12],
    {
      personality: ['Desconfiado, disciplinado y difícil de provocar.'], saves: ['Fue +4', 'Con +4'], skills: ['Atletismo +4', 'Perspicacia +3', 'Percepción +3'],
      traits: ['Formación defensiva. Gana +1 a la CA mientras esté a 1,5 m de un aliado con escudo.'],
      attacks: ['Ataque múltiple. Realiza dos ataques con espada o ballesta.', 'Espada larga. Ataque cuerpo a cuerpo: +4; impacto 6 (1d8 + 2) cortante.', 'Ballesta pesada. Ataque a distancia: +4; impacto 7 (1d10 + 2) perforante.'],
      equipment: ['Cota de malla', 'Escudo', 'Espada larga', 'Ballesta pesada'],
    }
  ),
  profile(
    'capitan-guardia', 'Capitán de la guardia', 'Militar', 'Mando local', 'Humanoide',
    'Oficial capaz de dirigir una patrulla, negociar rendiciones y sostener una posición bajo presión.',
    ['Urbano', 'Ley', 'Soldado', 'Líder'], [18, 52, '9 m', '+2', 3, '3'], [16, 14, 15, 12, 14, 15],
    {
      personality: ['Autoritario sin ser temerario.', 'Prioriza la seguridad de la población.'], saves: ['Fue +6', 'Con +5', 'Sab +5'],
      skills: ['Atletismo +6', 'Intimidación +5', 'Percepción +5', 'Perspicacia +5'],
      traits: ['Orden táctica. Una vez por turno, un aliado a 9 m puede moverse 3 m sin provocar ataques de oportunidad.'],
      attacks: ['Ataque múltiple. Realiza dos ataques con espada larga.', 'Espada larga. Ataque cuerpo a cuerpo: +6; impacto 7 (1d8 + 3) cortante.'],
      equipment: ['Armadura de placas parcial', 'Escudo', 'Espada larga', 'Insignia de mando'],
    }
  ),
  profile(
    'soldado', 'Soldado', 'Militar', 'Infantería entrenada', 'Humanoide',
    'Combatiente disciplinado habituado a marchas, formaciones y órdenes directas.',
    ['Ejército', 'Soldado', 'Combate'], [16, 18, '9 m', '+1', 2, '1/2'], [14, 12, 14, 10, 11, 10],
    {
      personality: ['Obedece la cadena de mando y protege a su unidad.'], saves: ['Fue +4', 'Con +4'], skills: ['Atletismo +4', 'Supervivencia +2'],
      traits: ['Mantener la línea. Tiene ventaja contra efectos que intenten empujarlo o derribarlo mientras esté junto a un aliado.'],
      attacks: ['Espada corta. Ataque cuerpo a cuerpo: +4; impacto 5 (1d6 + 2) perforante.', 'Arco corto. Ataque a distancia: +3; impacto 4 (1d6 + 1) perforante.'],
      equipment: ['Cota de escamas', 'Escudo', 'Espada corta', 'Arco corto'],
    }
  ),
  profile(
    'sargento', 'Sargento', 'Militar', 'Suboficial', 'Humanoide',
    'Veterano de unidad que mantiene la disciplina y convierte órdenes generales en acciones concretas.',
    ['Ejército', 'Soldado', 'Líder'], [17, 38, '9 m', '+1', 2, '2'], [15, 12, 14, 11, 13, 13],
    {
      personality: ['Exigente, protector con su tropa y enemigo de la improvisación inútil.'], saves: ['Fue +4', 'Con +4', 'Sab +3'],
      skills: ['Atletismo +4', 'Intimidación +5', 'Percepción +3'],
      traits: ['Voz de mando. Como acción adicional, un aliado a 9 m obtiene 1d6 PG temporales.'],
      attacks: ['Ataque múltiple. Realiza dos ataques con arma.', 'Alabarda. Ataque cuerpo a cuerpo: +4, alcance 3 m; impacto 7 (1d10 + 2) cortante.'],
      equipment: ['Cota de malla', 'Alabarda', 'Espada corta', 'Cuerno de órdenes'],
    }
  ),
  profile(
    'caballero', 'Caballero', 'Militar', 'Guerrero de élite', 'Humanoide',
    'Combatiente acorazado ligado a un juramento, señor o causa, eficaz tanto a pie como a caballo.',
    ['Noble', 'Soldado', 'Élite'], [18, 58, '9 m', '+1', 3, '3'], [16, 11, 15, 11, 13, 15],
    {
      personality: ['Valiente, formal y consciente de su reputación.'], saves: ['Fue +6', 'Con +5', 'Sab +4'], skills: ['Atletismo +6', 'Persuasión +5'],
      traits: ['Desafío. Como acción adicional, una criatura a 9 m tiene desventaja al atacar a otros hasta el siguiente turno del caballero.'],
      attacks: ['Ataque múltiple. Realiza dos ataques con espada larga.', 'Espada larga. Ataque cuerpo a cuerpo: +6; impacto 8 (1d8 + 4) cortante.', 'Lanza de caballería. Ataque cuerpo a cuerpo: +6; impacto 10 (1d12 + 4) perforante.'],
      equipment: ['Armadura de placas', 'Escudo', 'Espada larga', 'Lanza de caballería', 'Caballo de guerra'],
    }
  ),
  profile(
    'veterano', 'Veterano', 'Militar', 'Combatiente curtido', 'Humanoide',
    'Superviviente de numerosas campañas, difícil de sorprender y capaz de adaptarse a casi cualquier pelea.',
    ['Soldado', 'Mercenario', 'Veterano'], [17, 65, '9 m', '+1', 3, '3'], [16, 13, 15, 11, 14, 11],
    {
      personality: ['Pragmático, observador y poco amigo de heroicidades vacías.'], saves: ['Fue +6', 'Con +5'], skills: ['Atletismo +6', 'Percepción +5', 'Supervivencia +5'],
      traits: ['Instinto de batalla. No puede ser sorprendido mientras esté consciente.'],
      attacks: ['Ataque múltiple. Realiza dos ataques con arma.', 'Espada larga. Ataque cuerpo a cuerpo: +6; impacto 8 (1d8 + 4) cortante.', 'Ballesta pesada. Ataque a distancia: +4; impacto 7 (1d10 + 2) perforante.'],
      equipment: ['Cota de bandas', 'Espada larga', 'Ballesta pesada', 'Recuerdos de campaña'],
    }
  ),
  profile(
    'mercenario', 'Mercenario', 'Militar', 'Espada de alquiler', 'Humanoide',
    'Combatiente profesional que valora objetivos claros, paga puntual y rutas de retirada.',
    ['Mercenario', 'Soldado', 'Combate'], [15, 27, '9 m', '+2', 2, '1'], [14, 14, 13, 10, 12, 11],
    {
      personality: ['Cumple el contrato, pero no muere gratis.'], saves: ['Fue +4'], skills: ['Atletismo +4', 'Intimidación +2', 'Percepción +3'],
      traits: ['Retirada calculada. Puede Destrabarse como acción adicional cuando tiene la mitad o menos de sus PG.'],
      attacks: ['Espada larga. Ataque cuerpo a cuerpo: +4; impacto 6 (1d8 + 2) cortante.', 'Ballesta ligera. Ataque a distancia: +4; impacto 6 (1d8 + 2) perforante.'],
      equipment: ['Coraza', 'Espada larga', 'Ballesta ligera', 'Contrato sellado'],
    }
  ),
  profile(
    'acolito', 'Acólito', 'Religioso', 'Servidor de templo', 'Humanoide',
    'Ayudante de una institución religiosa con formación ritual y magia curativa elemental.',
    ['Templo', 'Sanador', 'Lanzador'], [12, 9, '9 m', '+0', 2, '1/4'], [10, 10, 10, 11, 14, 13],
    {
      personality: ['Devoto, servicial y todavía inexperto fuera del templo.'], saves: ['Sab +4'], skills: ['Medicina +4', 'Religión +2'],
      traits: ['Devoción. Tiene ventaja contra efectos que causen el estado Asustado.'],
      attacks: ['Maza. Ataque cuerpo a cuerpo: +2; impacto 3 (1d6) contundente.'],
      spells: ['A voluntad: Luz, Taumaturgia.', '2/día cada uno: Curar Heridas, Santuario.'],
      equipment: ['Maza', 'Símbolo sagrado', 'Vestiduras', 'Kit de sanador'],
    }
  ),
  profile(
    'sacerdote', 'Sacerdote', 'Religioso', 'Oficiante y sanador', 'Humanoide',
    'Representante veterano de una fe, capaz de proteger, sanar y sostener a una comunidad.',
    ['Templo', 'Sanador', 'Lanzador', 'Social'], [14, 32, '9 m', '+0', 2, '2'], [11, 10, 14, 12, 16, 14],
    {
      personality: ['Compasivo, firme y atento a los juramentos.'], saves: ['Sab +5', 'Car +4'], skills: ['Medicina +5', 'Perspicacia +5', 'Religión +3'],
      traits: ['Presencia tranquilizadora. Los aliados a 3 m tienen ventaja contra el estado Asustado.'],
      attacks: ['Maza. Ataque cuerpo a cuerpo: +3; impacto 4 (1d6 + 1) contundente.'],
      spells: ['A voluntad: Luz, Taumaturgia.', '3/día: Curar Heridas, Orden Imperiosa.', '1/día: Arma Espiritual, Restablecimiento Menor.'],
      equipment: ['Cota de escamas', 'Maza', 'Símbolo sagrado', 'Kit de sanador'],
    }
  ),
  profile(
    'bandido', 'Bandido', 'Criminal', 'Saqueador común', 'Humanoide',
    'Delincuente armado que confía en la superioridad numérica, la intimidación y una salida cercana.',
    ['Criminal', 'Camino', 'Combate'], [12, 11, '9 m', '+2', 2, '1/8'], [11, 14, 12, 10, 10, 10],
    {
      personality: ['Valiente cuando lleva ventaja y prudente cuando la pierde.'], skills: ['Intimidación +2', 'Sigilo +4'],
      traits: ['Ataque en grupo. Gana +1 a las tiradas de ataque si un aliado está a 1,5 m del objetivo.'],
      attacks: ['Cimitarra. Ataque cuerpo a cuerpo: +4; impacto 5 (1d6 + 2) cortante.', 'Ballesta ligera. Ataque a distancia: +4; impacto 6 (1d8 + 2) perforante.'],
      equipment: ['Armadura de cuero', 'Cimitarra', 'Ballesta ligera', 'Pañuelo identificativo'],
    }
  ),
  profile(
    'arquero-bandido', 'Arquero bandido', 'Criminal', 'Tirador de emboscada', 'Humanoide',
    'Saqueador que dispara desde cobertura y cambia de posición antes de que el enemigo pueda alcanzarlo.',
    ['Criminal', 'Camino', 'Distancia'], [13, 16, '9 m', '+3', 2, '1/2'], [10, 16, 12, 10, 12, 9],
    {
      personality: ['Paciente, oportunista y poco dispuesto a luchar cuerpo a cuerpo.'], saves: ['Des +5'], skills: ['Percepción +3', 'Sigilo +5'],
      traits: ['Tirador oculto. Si estaba oculto al atacar, puede moverse 3 m sin provocar ataques de oportunidad.'],
      attacks: ['Arco largo. Ataque a distancia: +5; impacto 7 (1d8 + 3) perforante.', 'Daga. Ataque cuerpo a cuerpo: +5; impacto 5 (1d4 + 3) perforante.'],
      equipment: ['Armadura de cuero', 'Arco largo', '20 flechas', 'Daga'],
    }
  ),
  profile(
    'bandido-veterano', 'Bandido veterano', 'Criminal', 'Saqueador experimentado', 'Humanoide',
    'Criminal curtido que sabe cuándo presionar, tomar rehenes o abandonar un golpe fallido.',
    ['Criminal', 'Camino', 'Veterano'], [15, 36, '9 m', '+2', 2, '2'], [14, 14, 14, 11, 12, 12],
    {
      personality: ['Pragmático y desconfiado de planes demasiado perfectos.'], saves: ['Des +4', 'Con +4'], skills: ['Atletismo +4', 'Engaño +3', 'Percepción +3'],
      traits: ['Golpe sucio. Una vez por turno inflige 1d6 de daño adicional si un aliado amenaza al objetivo.'],
      attacks: ['Ataque múltiple. Realiza dos ataques.', 'Espada corta. Ataque cuerpo a cuerpo: +4; impacto 5 (1d6 + 2) perforante.', 'Ballesta ligera. Ataque a distancia: +4; impacto 6 (1d8 + 2) perforante.'],
      equipment: ['Camisa de malla', 'Espada corta', 'Ballesta ligera', 'Cuerda', 'Ganzúas'],
    }
  ),
  profile(
    'jefe-bandido', 'Jefe de bandidos', 'Criminal', 'Líder de banda', 'Humanoide',
    'Cabecilla carismático que distribuye objetivos y conserva una ruta de fuga para sí mismo.',
    ['Criminal', 'Líder', 'Camino'], [16, 58, '9 m', '+3', 3, '3'], [15, 16, 14, 12, 13, 15],
    {
      personality: ['Ambicioso, convincente y cruel cuando necesita dar ejemplo.'], saves: ['Des +6', 'Sab +4', 'Car +5'],
      skills: ['Engaño +5', 'Intimidación +5', 'Percepción +4', 'Persuasión +5'],
      traits: ['Orden de ataque. Como acción adicional, un aliado a 9 m puede realizar un ataque con su reacción.'],
      attacks: ['Ataque múltiple. Realiza dos ataques con espada.', 'Espada ropera. Ataque cuerpo a cuerpo: +6; impacto 7 (1d8 + 3) perforante.', 'Daga. Ataque a distancia: +6; impacto 5 (1d4 + 3) perforante.'],
      equipment: ['Coraza', 'Espada ropera', 'Tres dagas', 'Mapa de escondites'],
    }
  ),
  profile(
    'maton', 'Matón', 'Criminal', 'Intimidador a sueldo', 'Humanoide',
    'Musculoso cobrador o guardaespaldas que resuelve discusiones mediante presión física.',
    ['Criminal', 'Urbano', 'Combate'], [13, 30, '9 m', '+0', 2, '1'], [16, 10, 15, 9, 10, 11],
    {
      personality: ['Amenazante, territorial y obediente a quien paga.'], saves: ['Fue +5', 'Con +4'], skills: ['Atletismo +5', 'Intimidación +4'],
      traits: ['Duro de tumbar. Tiene ventaja en pruebas y salvaciones para evitar ser derribado.'],
      attacks: ['Ataque múltiple. Realiza dos ataques con garrote.', 'Garrote pesado. Ataque cuerpo a cuerpo: +5; impacto 7 (1d8 + 3) contundente.'],
      equipment: ['Armadura de cuero tachonado', 'Garrote pesado', 'Puños reforzados'],
    }
  ),
  profile(
    'ladron', 'Ladrón', 'Criminal', 'Infiltrador y carterista', 'Humanoide',
    'Delincuente ágil especializado en cerraduras, bolsillos, tejados y huidas rápidas.',
    ['Criminal', 'Urbano', 'Sigilo'], [14, 24, '9 m', '+4', 2, '1'], [9, 18, 12, 12, 11, 13],
    {
      personality: ['Encantador cuando le conviene y siempre atento a objetos valiosos.'], saves: ['Des +6'],
      skills: ['Acrobacias +6', 'Engaño +3', 'Juego de Manos +6', 'Sigilo +6'],
      traits: ['Acción astuta. Puede Correr, Destrabarse u Ocultarse como acción adicional.'],
      attacks: ['Daga. Ataque cuerpo a cuerpo o a distancia: +6; impacto 6 (1d4 + 4) perforante más 3 (1d6) si tiene ventaja.'],
      equipment: ['Armadura de cuero', 'Tres dagas', 'Herramientas de ladrón', 'Garfio y cuerda'],
    }
  ),
  profile(
    'espia', 'Espía', 'Criminal', 'Agente encubierto', 'Humanoide',
    'Observador entrenado para sostener identidades falsas, obtener secretos y desaparecer sin ruido.',
    ['Intriga', 'Urbano', 'Sigilo', 'Social'], [14, 33, '9 m', '+3', 3, '2'], [10, 16, 12, 14, 14, 16],
    {
      personality: ['Paciente, adaptable y cuidadoso con cada palabra.'], saves: ['Des +6', 'Int +5'],
      skills: ['Engaño +9', 'Investigación +5', 'Percepción +5', 'Perspicacia +5', 'Sigilo +6'],
      traits: ['Identidad falsa. Tiene ventaja para mantener una tapadera preparada.', 'Ataque furtivo. Una vez por turno inflige 2d6 de daño adicional con ventaja o un aliado cercano al objetivo.'],
      attacks: ['Espada corta. Ataque cuerpo a cuerpo: +6; impacto 7 (1d6 + 3) perforante.', 'Ballesta de mano. Ataque a distancia: +6; impacto 6 (1d6 + 3) perforante.'],
      equipment: ['Armadura de cuero', 'Espada corta', 'Ballesta de mano', 'Disfraces', 'Documentos falsos'],
    }
  ),
  profile(
    'asesino', 'Asesino', 'Criminal', 'Ejecutor profesional', 'Humanoide',
    'Especialista letal en infiltración, venenos y ataques contra objetivos aislados.',
    ['Criminal', 'Sigilo', 'Élite'], [15, 72, '9 m', '+4', 3, '6'], [11, 18, 14, 14, 13, 12],
    {
      personality: ['Frío, meticuloso y reacio a improvisar.'], saves: ['Des +7', 'Int +5'],
      skills: ['Acrobacias +7', 'Engaño +4', 'Percepción +4', 'Sigilo +10'],
      traits: ['Ataque furtivo. Una vez por turno inflige 4d6 de daño adicional.', 'Evasión. Si supera una salvación de Destreza que reduce daño a la mitad, no recibe daño.'],
      attacks: ['Ataque múltiple. Realiza dos ataques.', 'Espada corta envenenada. Ataque cuerpo a cuerpo: +7; impacto 7 (1d6 + 4) perforante más 10 (3d6) de veneno, salvación de Con CD 13 para mitad.', 'Ballesta de mano. Ataque a distancia: +7; impacto 7 (1d6 + 4) perforante.'],
      equipment: ['Armadura de cuero tachonado', 'Espada corta', 'Ballesta de mano', 'Kit de venenos', 'Disfraz'],
    }
  ),
  profile(
    'cultista', 'Cultista', 'Religioso', 'Seguidor fanático', 'Humanoide',
    'Devoto de una causa secreta que actúa en grupo y teme más a sus superiores que a la ley.',
    ['Culto', 'Criminal', 'Social'], [12, 9, '9 m', '+1', 2, '1/8'], [11, 12, 10, 10, 11, 13],
    {
      personality: ['Fervoroso, reservado y ansioso por demostrar lealtad.'], skills: ['Engaño +3', 'Religión +2'],
      traits: ['Fervor oscuro. Tiene ventaja contra el estado Asustado mientras vea a otro miembro de su culto.'],
      attacks: ['Cimitarra. Ataque cuerpo a cuerpo: +3; impacto 4 (1d6 + 1) cortante.'],
      equipment: ['Armadura de cuero', 'Cimitarra', 'Símbolo oculto', 'Túnica ceremonial'],
    }
  ),
  profile(
    'fanatico-culto', 'Fanático del culto', 'Religioso', 'Líder de célula', 'Humanoide',
    'Predicador peligroso que combina obediencia fanática, magia y una red de seguidores.',
    ['Culto', 'Lanzador', 'Líder'], [13, 36, '9 m', '+1', 2, '2'], [11, 12, 14, 12, 15, 16],
    {
      personality: ['Carismático, absoluto y convencido de que el fin justifica cualquier medio.'], saves: ['Sab +4', 'Car +5'],
      skills: ['Engaño +5', 'Persuasión +5', 'Religión +3'],
      traits: ['Celo compartido. Los cultistas aliados a 6 m obtienen +1 a sus tiradas de ataque.'],
      attacks: ['Daga ritual. Ataque cuerpo a cuerpo: +3; impacto 3 (1d4 + 1) perforante.'],
      spells: ['A voluntad: Taumaturgia.', '3/día: Orden Imperiosa, Infligir Heridas.', '1/día: Inmovilizar Persona, Arma Espiritual.'],
      equipment: ['Daga ritual', 'Símbolo del culto', 'Libro de sermones', 'Ropajes reforzados'],
    }
  ),
  profile(
    'cazador', 'Cazador', 'Especialista', 'Proveedor y tirador', 'Humanoide',
    'Habitante de las lindes que conoce presas, rastros, estaciones y peligros naturales.',
    ['Bosque', 'Rural', 'Distancia'], [13, 18, '9 m', '+3', 2, '1/2'], [11, 16, 12, 10, 14, 9],
    {
      personality: ['Paciente, autosuficiente y respetuoso con los riesgos del entorno.'], saves: ['Des +5'],
      skills: ['Naturaleza +2', 'Percepción +4', 'Sigilo +5', 'Supervivencia +4'],
      traits: ['Rastreador. Tiene ventaja al seguir bestias y humanoides por terreno natural.'],
      attacks: ['Arco largo. Ataque a distancia: +5; impacto 7 (1d8 + 3) perforante.', 'Cuchillo de caza. Ataque cuerpo a cuerpo: +5; impacto 5 (1d4 + 3) cortante.'],
      equipment: ['Armadura de cuero', 'Arco largo', 'Cuchillo', 'Trampas', 'Manta'],
    }
  ),
  profile(
    'explorador', 'Explorador', 'Especialista', 'Batidor de frontera', 'Humanoide',
    'Viajero armado que reconoce terreno, detecta emboscadas y abre una ruta segura para el grupo.',
    ['Bosque', 'Viajero', 'Distancia'], [14, 32, '10,5 m', '+3', 2, '1'], [13, 16, 14, 11, 15, 10],
    {
      personality: ['Observador, lacónico y siempre pendiente del horizonte.'], saves: ['Des +5', 'Sab +4'],
      skills: ['Atletismo +3', 'Percepción +6', 'Sigilo +5', 'Supervivencia +6'],
      traits: ['Paso del explorador. Ignora terreno difícil no mágico durante los viajes.', 'Alerta. No puede ser sorprendido mientras esté consciente.'],
      attacks: ['Ataque múltiple. Realiza dos ataques.', 'Arco largo. Ataque a distancia: +5; impacto 7 (1d8 + 3) perforante.', 'Espada corta. Ataque cuerpo a cuerpo: +5; impacto 6 (1d6 + 3) perforante.'],
      equipment: ['Cuero tachonado', 'Arco largo', 'Espada corta', 'Equipo de explorador'],
    }
  ),
  profile(
    'rastreador', 'Rastreador', 'Especialista', 'Perseguidor experto', 'Humanoide',
    'Especialista contratado para localizar personas o monstruos a partir de señales mínimas.',
    ['Bosque', 'Investigación', 'Viajero'], [14, 40, '10,5 m', '+4', 3, '2'], [13, 18, 14, 12, 16, 10],
    {
      personality: ['Metódico, perseverante y difícil de despistar.'], saves: ['Des +7', 'Sab +6'],
      skills: ['Investigación +4', 'Percepción +6', 'Sigilo +7', 'Supervivencia +9'],
      traits: ['Marca de presa. Como acción adicional elige una criatura visible; inflige 1d6 de daño adicional una vez por turno contra ella.'],
      attacks: ['Ataque múltiple. Realiza dos ataques.', 'Arco largo. Ataque a distancia: +7; impacto 8 (1d8 + 4) perforante.', 'Espada corta. Ataque cuerpo a cuerpo: +7; impacto 7 (1d6 + 4) perforante.'],
      equipment: ['Cuero tachonado', 'Arco largo', 'Espada corta', 'Kit de rastreo'],
    }
  ),
  profile(
    'guia', 'Guía', 'Especialista', 'Conductor de expediciones', 'Humanoide',
    'Conocedor de una región que organiza rutas, campamentos y provisiones para grupos inexpertos.',
    ['Viajero', 'Social', 'Supervivencia'], [12, 16, '9 m', '+2', 2, '1/2'], [12, 14, 12, 11, 15, 13],
    {
      personality: ['Paciente con quien escucha y severo con quien ignora advertencias.'], skills: ['Percepción +4', 'Persuasión +3', 'Supervivencia +6'],
      traits: ['Ruta segura. Su grupo no puede perderse por medios no mágicos en su región de especialidad.'],
      attacks: ['Bastón. Ataque cuerpo a cuerpo: +3; impacto 4 (1d6 + 1) contundente.', 'Arco corto. Ataque a distancia: +4; impacto 5 (1d6 + 2) perforante.'],
      equipment: ['Bastón', 'Arco corto', 'Mapa regional', 'Equipo de explorador'],
    }
  ),
  profile(
    'marinero', 'Marinero', 'Marítimo', 'Tripulante', 'Humanoide',
    'Trabajador de cubierta habituado a trepar, remar, reparar aparejos y conservar el equilibrio con mala mar.',
    ['Mar', 'Trabajador', 'Viajero'], [12, 13, '9 m', '+2', 2, '1/4'], [13, 14, 12, 10, 12, 10],
    {
      personality: ['Supersticioso, resistente y leal a su tripulación.'], saves: ['Des +4'], skills: ['Acrobacias +4', 'Atletismo +3', 'Percepción +3'],
      traits: ['Pie de mar. Tiene ventaja para evitar caer Derribado y al trepar por cuerdas o aparejos.'],
      attacks: ['Alfanje. Ataque cuerpo a cuerpo: +4; impacto 5 (1d6 + 2) cortante.'],
      equipment: ['Alfanje', 'Cabo de 15 m', 'Herramientas de navegación sencillas'],
    }
  ),
  profile(
    'capitan-barco', 'Capitán de barco', 'Marítimo', 'Mando naval', 'Humanoide',
    'Oficial que gobierna una tripulación, interpreta cartas náuticas y toma decisiones bajo presión.',
    ['Mar', 'Líder', 'Viajero'], [15, 42, '9 m', '+2', 3, '2'], [13, 14, 14, 14, 15, 16],
    {
      personality: ['Decidido, responsable y celoso de su autoridad a bordo.'], saves: ['Sab +5', 'Car +6'],
      skills: ['Atletismo +4', 'Percepción +5', 'Persuasión +6', 'Vehículos acuáticos +8'],
      traits: ['Orden de cubierta. Como acción adicional, un aliado a 9 m puede moverse hasta la mitad de su velocidad.'],
      attacks: ['Ataque múltiple. Realiza dos ataques con alfanje.', 'Alfanje. Ataque cuerpo a cuerpo: +5; impacto 6 (1d6 + 3) cortante.', 'Pistola de ballesta. Ataque a distancia: +5; impacto 6 (1d6 + 3) perforante.'],
      equipment: ['Coraza', 'Alfanje', 'Ballesta de mano', 'Catalejo', 'Cartas náuticas'],
    }
  ),
  profile(
    'pirata', 'Pirata', 'Marítimo', 'Saqueador naval', 'Humanoide',
    'Asaltante de cubierta que combina movilidad, amenazas y ataques rápidos.',
    ['Mar', 'Criminal', 'Combate'], [13, 22, '9 m', '+3', 2, '1'], [13, 16, 13, 10, 11, 12],
    {
      personality: ['Audaz, ruidoso y oportunista.'], saves: ['Des +5'], skills: ['Acrobacias +5', 'Atletismo +3', 'Intimidación +3'],
      traits: ['Balanceo con cuerda. Una vez por turno puede moverse 3 m adicionales sin provocar ataques de oportunidad si hay aparejos cercanos.'],
      attacks: ['Alfanje. Ataque cuerpo a cuerpo: +5; impacto 6 (1d6 + 3) cortante.', 'Ballesta de mano. Ataque a distancia: +5; impacto 6 (1d6 + 3) perforante.'],
      equipment: ['Cuero', 'Alfanje', 'Ballesta de mano', 'Garfio', 'Cuerda'],
    }
  ),
  profile(
    'minero', 'Minero', 'Civil', 'Trabajador subterráneo', 'Humanoide',
    'Trabajador robusto que reconoce vetas, derrumbes, corrientes de aire y riesgos bajo tierra.',
    ['Subterráneo', 'Trabajador', 'Rural'], [11, 14, '9 m', '+0', 2, '1/4'], [14, 10, 14, 11, 13, 9],
    {
      personality: ['Sobrio, solidario y respetuoso con la montaña.'], saves: ['Con +4'], skills: ['Atletismo +4', 'Investigación +2', 'Percepción +3'],
      traits: ['Sentido de túnel. Tiene ventaja para detectar estructuras inestables y estimar profundidad bajo tierra.'],
      attacks: ['Pico. Ataque cuerpo a cuerpo: +4; impacto 6 (1d8 + 2) perforante.'],
      equipment: ['Pico', 'Casco con lámpara', 'Cuerda', 'Martillo', 'Clavos'],
    }
  ),
  profile(
    'aprendiz-arcano', 'Aprendiz arcano', 'Arcano', 'Estudiante de magia', 'Humanoide',
    'Lanzador principiante que domina trucos útiles y unos pocos conjuros de emergencia.',
    ['Lanzador', 'Académico', 'Apoyo'], [12, 14, '9 m', '+2', 2, '1/2'], [8, 14, 11, 16, 12, 10],
    {
      personality: ['Curioso, aplicado y algo propenso a demostrar lo aprendido.'], saves: ['Int +5'], skills: ['Arcana +5', 'Investigación +5'],
      traits: ['Recuperación menor. Una vez al día recupera un uso gastado de un conjuro después de un descanso corto.'],
      attacks: ['Bastón. Ataque cuerpo a cuerpo: +1; impacto 2 (1d6 - 1) contundente.', 'Descarga ígnea. Ataque de conjuro a distancia: +5; impacto 5 (1d10) de fuego.'],
      spells: ['A voluntad: Luz, Mano de Mago, Descarga Ígnea.', '3/día: Armadura de Mago, Dormir, Escudo.', '1/día: Detectar Magia.'],
      equipment: ['Bastón', 'Libro de conjuros', 'Foco arcano', 'Bolsa de componentes'],
    }
  ),
  profile(
    'mago-batalla', 'Mago de batalla', 'Arcano', 'Lanzador militar', 'Humanoide',
    'Especialista arcano entrenado para controlar espacios y apoyar a una unidad en combate.',
    ['Lanzador', 'Soldado', 'Élite'], [15, 48, '9 m', '+3', 3, '4'], [9, 16, 14, 17, 13, 11],
    {
      personality: ['Analítico, disciplinado y atento a líneas de tiro.'], saves: ['Int +6', 'Sab +4'], skills: ['Arcana +6', 'Investigación +6'],
      traits: ['Defensa arcana. Su CA incluye una barrera mágica; puede usar Escudo tres veces al día.'],
      attacks: ['Rayo arcano. Ataque de conjuro a distancia: +6; impacto 13 (3d8) de fuerza.', 'Daga. Ataque cuerpo a cuerpo: +6; impacto 5 (1d4 + 3) perforante.'],
      spells: ['A voluntad: Luz, Mano de Mago, Rayo de Escarcha.', '3/día: Escudo, Misil Mágico, Onda Atronadora.', '2/día: Paso Brumoso, Rayo Abrasador.', '1/día: Bola de Fuego, Contrahechizo.'],
      equipment: ['Daga', 'Foco arcano', 'Libro de campaña', 'Uniforme reforzado'],
    }
  ),
  profile(
    'trovador-itinerante', 'Trovador itinerante', 'Artista', 'Músico e informador', 'Humanoide',
    'Artista viajero que reúne rumores, anima reuniones y distrae a una multitud con magia menor.',
    ['Social', 'Lanzador', 'Viajero'], [13, 24, '9 m', '+3', 2, '1'], [9, 16, 12, 12, 11, 17],
    {
      personality: ['Extrovertido, ingenioso y atento a una buena historia.'], saves: ['Des +5', 'Car +5'],
      skills: ['Engaño +5', 'Interpretación +7', 'Persuasión +5', 'Perspicacia +2'],
      traits: ['Inspiración. Como acción adicional, un aliado a 18 m añade 1d6 a una tirada durante el siguiente minuto.'],
      attacks: ['Estoque. Ataque cuerpo a cuerpo: +5; impacto 7 (1d8 + 3) perforante.'],
      spells: ['A voluntad: Burla Dañina, Ilusión Menor.', '3/día: Curar Heridas, Encantar Persona, Susurros Discordantes.', '1/día: Invisibilidad.'],
      equipment: ['Estoque', 'Instrumento musical', 'Ropa de viaje', 'Cuaderno de canciones'],
    }
  ),
  profile(
    'adepto-druidico', 'Adepto druídico', 'Primal', 'Guardián natural', 'Humanoide',
    'Custodio de un paraje natural capaz de curar, controlar plantas y convocar fuerzas elementales menores.',
    ['Bosque', 'Lanzador', 'Sanador'], [13, 30, '9 m', '+1', 2, '2'], [10, 12, 14, 12, 17, 11],
    {
      personality: ['Paciente con la naturaleza y receloso de la explotación descuidada.'], saves: ['Sab +5'], skills: ['Medicina +5', 'Naturaleza +3', 'Supervivencia +5'],
      traits: ['Paso de la floresta. Ignora terreno difícil causado por plantas no mágicas.'],
      attacks: ['Bastón nudoso. Ataque cuerpo a cuerpo: +3; impacto 4 (1d6 + 1) contundente.', 'Llama producida. Ataque de conjuro a distancia: +5; impacto 9 (2d8) de fuego.'],
      spells: ['A voluntad: Guía, Producir Llama.', '3/día: Curar Heridas, Enmarañar, Hablar con los Animales.', '1/día: Piel de Corteza, Restauración Menor.'],
      equipment: ['Bastón', 'Foco druídico', 'Kit de herborista', 'Capa de viaje'],
    }
  ),
  profile(
    'goblin-escaramuzador', 'Goblin escaramuzador', 'Humanoide hostil', 'Hostigador', 'Goblin',
    'Combatiente pequeño que ataca desde una posición ventajosa y se retira antes de quedar atrapado.',
    ['Goblin', 'Sigilo', 'Combate'], [15, 9, '9 m', '+3', 2, '1/4'], [8, 16, 10, 10, 9, 8],
    {
      personality: ['Nervioso, burlón y valiente solo con una salida disponible.'], saves: ['Des +5'], skills: ['Sigilo +7'],
      traits: ['Huida veloz. Puede Destrabarse u Ocultarse como acción adicional.', 'Visión en la oscuridad 18 m.'],
      attacks: ['Cimitarra. Ataque cuerpo a cuerpo: +5; impacto 5 (1d6 + 2) cortante.', 'Arco corto. Ataque a distancia: +5; impacto 5 (1d6 + 2) perforante.'],
      equipment: ['Armadura de cuero', 'Escudo', 'Cimitarra', 'Arco corto'],
    }
  ),
  profile(
    'goblin-arquero', 'Goblin arquero', 'Humanoide hostil', 'Tirador', 'Goblin',
    'Tirador paciente que usa altura, oscuridad y cobertura para desgastar al enemigo.',
    ['Goblin', 'Distancia', 'Sigilo'], [14, 13, '9 m', '+4', 2, '1/2'], [7, 18, 10, 10, 11, 8],
    {
      personality: ['Presumido con su puntería y aterrorizado por el cuerpo a cuerpo.'], saves: ['Des +6'], skills: ['Percepción +2', 'Sigilo +8'],
      traits: ['Huida veloz. Puede Destrabarse u Ocultarse como acción adicional.', 'Disparo desde cobertura. Ignora media cobertura.'],
      attacks: ['Arco corto. Ataque a distancia: +6; impacto 7 (1d6 + 4) perforante.', 'Daga. Ataque cuerpo a cuerpo: +6; impacto 6 (1d4 + 4) perforante.'],
      equipment: ['Armadura de cuero', 'Arco corto', 'Daga', '20 flechas'],
    }
  ),
  profile(
    'jefe-goblin', 'Jefe goblin', 'Humanoide hostil', 'Líder de guarida', 'Goblin',
    'Goblin astuto que conserva su autoridad mediante recompensas, amenazas y subordinados interpuestos.',
    ['Goblin', 'Líder', 'Combate'], [16, 36, '9 m', '+3', 2, '2'], [10, 16, 14, 13, 11, 14],
    {
      personality: ['Astuto, rencoroso y sorprendentemente buen negociador.'], saves: ['Des +5', 'Car +4'], skills: ['Engaño +4', 'Intimidación +4', 'Sigilo +7'],
      traits: ['Redirigir ataque. Como reacción, intercambia su posición con un goblin adyacente que recibe el ataque en su lugar.'],
      attacks: ['Ataque múltiple. Realiza dos ataques.', 'Cimitarra. Ataque cuerpo a cuerpo: +5; impacto 6 (1d6 + 3) cortante.', 'Jabalina. Ataque a distancia: +5; impacto 6 (1d6 + 3) perforante.'],
      equipment: ['Camisa de malla', 'Escudo', 'Cimitarra', 'Tres jabalinas', 'Llaves del botín'],
    }
  ),
  profile(
    'hobgoblin-soldado', 'Hobgoblin soldado', 'Humanoide hostil', 'Infantería disciplinada', 'Hobgoblin',
    'Guerrero organizado que combate en formación y explota cualquier apertura creada por sus aliados.',
    ['Hobgoblin', 'Soldado', 'Combate'], [18, 22, '9 m', '+1', 2, '1'], [15, 12, 14, 11, 11, 10],
    {
      personality: ['Disciplinado, orgulloso y respetuoso con una cadena de mando fuerte.'], saves: ['Fue +4', 'Con +4'], skills: ['Atletismo +4'],
      traits: ['Ventaja marcial. Una vez por turno inflige 2d6 de daño adicional si un aliado está a 1,5 m del objetivo.'],
      attacks: ['Espada larga. Ataque cuerpo a cuerpo: +4; impacto 6 (1d8 + 2) cortante.', 'Arco largo. Ataque a distancia: +3; impacto 5 (1d8 + 1) perforante.'],
      equipment: ['Cota de malla', 'Escudo', 'Espada larga', 'Arco largo'],
    }
  ),
  profile(
    'bugbear-emboscador', 'Bugbear emboscador', 'Humanoide hostil', 'Bruto sigiloso', 'Bugbear',
    'Cazador grande y sorprendentemente silencioso que intenta decidir el combate con el primer golpe.',
    ['Bugbear', 'Sigilo', 'Emboscada'], [14, 36, '9 m', '+2', 2, '2'], [17, 14, 14, 10, 11, 9],
    {
      personality: ['Perezoso hasta que huele una presa vulnerable.'], saves: ['Fue +5'], skills: ['Sigilo +6', 'Supervivencia +2'],
      traits: ['Ataque sorpresa. Durante el primer asalto inflige 2d6 de daño adicional a una criatura que aún no haya actuado.', 'Alcance largo. Sus ataques cuerpo a cuerpo tienen alcance de 3 m.'],
      attacks: ['Mangual. Ataque cuerpo a cuerpo: +5, alcance 3 m; impacto 8 (1d10 + 3) contundente.', 'Jabalina. Ataque a distancia: +5; impacto 6 (1d6 + 3) perforante.'],
      equipment: ['Armadura de pieles', 'Mangual', 'Tres jabalinas'],
    }
  ),
  profile(
    'kobold-trampero', 'Kobold trampero', 'Humanoide hostil', 'Ingeniero de guarida', 'Kobold',
    'Pequeño defensor que prepara pasillos, alarmas y trampas para compensar su fragilidad.',
    ['Kobold', 'Trampas', 'Sigilo'], [13, 10, '9 m', '+3', 2, '1/4'], [7, 16, 10, 12, 12, 9],
    {
      personality: ['Nervioso, ingenioso y orgulloso de sus mecanismos.'], saves: ['Des +5'], skills: ['Investigación +3', 'Sigilo +5'],
      traits: ['Tácticas de manada. Tiene ventaja al atacar si un aliado está a 1,5 m del objetivo.', 'Trampa rápida. Una vez por combate coloca abrojos o un lazo en una casilla adyacente.'],
      attacks: ['Honda. Ataque a distancia: +5; impacto 5 (1d4 + 3) contundente.', 'Daga. Ataque cuerpo a cuerpo: +5; impacto 5 (1d4 + 3) perforante.'],
      equipment: ['Honda', 'Daga', 'Herramientas de trampero', 'Abrojos'],
    }
  ),
  profile(
    'orco-saqueador', 'Orco saqueador', 'Humanoide hostil', 'Combatiente agresivo', 'Orco',
    'Guerrero poderoso que acorta distancias con rapidez y busca romper la línea enemiga.',
    ['Orco', 'Combate', 'Bruto'], [14, 30, '9 m', '+1', 2, '1'], [17, 12, 16, 8, 11, 10],
    {
      personality: ['Audaz, competitivo y respetuoso con la fuerza demostrada.'], saves: ['Fue +5', 'Con +5'], skills: ['Atletismo +5', 'Intimidación +2'],
      traits: ['Avance agresivo. Como acción adicional se mueve hasta su velocidad hacia un enemigo visible.'],
      attacks: ['Hacha grande. Ataque cuerpo a cuerpo: +5; impacto 9 (1d12 + 3) cortante.', 'Jabalina. Ataque a distancia: +5; impacto 6 (1d6 + 3) perforante.'],
      equipment: ['Armadura de pieles', 'Hacha grande', 'Tres jabalinas'],
    }
  ),
  profile(
    'orco-arquero', 'Orco arquero', 'Humanoide hostil', 'Tirador robusto', 'Orco',
    'Cazador de guerra que usa un arco pesado para debilitar objetivos antes de cargar.',
    ['Orco', 'Distancia', 'Cazador'], [14, 27, '9 m', '+2', 2, '1'], [15, 14, 15, 9, 13, 9],
    {
      personality: ['Paciente hasta localizar una debilidad, feroz al explotarla.'], saves: ['Con +4'], skills: ['Percepción +3', 'Supervivencia +3'],
      traits: ['Disparo poderoso. Si no se mueve en su turno, el siguiente impacto con arco inflige 1d6 adicional.'],
      attacks: ['Arco largo. Ataque a distancia: +4; impacto 6 (1d8 + 2) perforante.', 'Hacha de mano. Ataque cuerpo a cuerpo: +4; impacto 5 (1d6 + 2) cortante.'],
      equipment: ['Cuero tachonado', 'Arco largo', 'Hacha de mano', '20 flechas'],
    }
  ),
  profile(
    'jefe-orco', 'Jefe orco', 'Humanoide hostil', 'Campeón de guerra', 'Orco',
    'Líder imponente que dirige cargas y mantiene unida a su partida de guerra mediante ejemplo personal.',
    ['Orco', 'Líder', 'Élite'], [17, 76, '9 m', '+1', 3, '4'], [19, 12, 18, 10, 13, 15],
    {
      personality: ['Dominante, orgulloso y dispuesto a escuchar a un rival digno.'], saves: ['Fue +7', 'Con +7', 'Sab +4'], skills: ['Atletismo +7', 'Intimidación +5', 'Percepción +4'],
      traits: ['Grito de guerra. Una vez al día, aliados a 9 m obtienen 8 PG temporales y pueden moverse 3 m.', 'Tenacidad. Una vez al día, al caer a 0 PG queda a 1 PG.'],
      attacks: ['Ataque múltiple. Realiza dos ataques con hacha.', 'Hacha grande. Ataque cuerpo a cuerpo: +7; impacto 11 (1d12 + 5) cortante.', 'Jabalina. Ataque a distancia: +7; impacto 8 (1d6 + 5) perforante.'],
      equipment: ['Cota de malla', 'Hacha grande', 'Cuatro jabalinas', 'Trofeo de mando'],
    }
  ),
  profile(
    'gnoll-cazador', 'Gnoll cazador', 'Humanoide hostil', 'Perseguidor de manada', 'Gnoll',
    'Cazador incansable que rodea a sus presas y se envalentona cuando alguien cae.',
    ['Gnoll', 'Cazador', 'Combate'], [14, 26, '9 m', '+2', 2, '1'], [14, 14, 13, 8, 12, 8],
    {
      personality: ['Hambriento, inquieto y subordinado a la fuerza de la manada.'], skills: ['Percepción +3', 'Supervivencia +3'],
      traits: ['Frenesí. Cuando reduce a una criatura a 0 PG, puede moverse hasta la mitad de su velocidad y realizar un ataque de mordisco como acción adicional.'],
      attacks: ['Lanza. Ataque cuerpo a cuerpo o a distancia: +4; impacto 5 (1d6 + 2) perforante.', 'Mordisco. Ataque cuerpo a cuerpo: +4; impacto 5 (1d6 + 2) perforante.', 'Arco largo. Ataque a distancia: +4; impacto 6 (1d8 + 2) perforante.'],
      equipment: ['Armadura de pieles', 'Lanza', 'Arco largo'],
    }
  ),
  profile(
    'esqueleto', 'Esqueleto', 'No muerto', 'Guardián animado', 'No muerto',
    'Restos óseos animados que obedecen órdenes sencillas y combaten sin miedo ni cansancio.',
    ['No muerto', 'Guardián', 'Combate'], [13, 13, '9 m', '+2', 2, '1/4'], [10, 14, 15, 6, 8, 5],
    {
      personality: ['Sin personalidad; ejecuta la última orden recibida.'], saves: ['Con +4'],
      traits: ['Naturaleza no muerta. No necesita comer, beber, respirar ni dormir.', 'Vulnerable al daño contundente; inmune al veneno y al estado Envenenado.'],
      attacks: ['Espada corta. Ataque cuerpo a cuerpo: +4; impacto 5 (1d6 + 2) perforante.', 'Arco corto. Ataque a distancia: +4; impacto 5 (1d6 + 2) perforante.'],
      equipment: ['Armadura rota', 'Espada corta', 'Arco corto'],
    }
  ),
  profile(
    'zombi', 'Zombi', 'No muerto', 'Cadáver animado', 'No muerto',
    'Cadáver lento y resistente que avanza hacia la criatura viva más cercana.',
    ['No muerto', 'Bruto', 'Combate'], [8, 22, '6 m', '-2', 2, '1/4'], [13, 6, 16, 3, 6, 5],
    {
      personality: ['Sin personalidad; persigue vida y ruido.'], saves: ['Sab +0'],
      traits: ['Fortaleza no muerta. Al caer a 0 PG realiza una salvación de Con CD 5 + daño recibido; con éxito queda a 1 PG, salvo daño radiante o crítico.', 'Inmune al veneno y al estado Envenenado.'],
      attacks: ['Golpe. Ataque cuerpo a cuerpo: +3; impacto 4 (1d6 + 1) contundente.'],
      equipment: ['Restos de ropa o armadura'],
    }
  ),
  profile(
    'necrofago', 'Necrófago', 'No muerto', 'Depredador paralizante', 'No muerto',
    'Carroñero sobrenatural rápido cuyas garras entumecen a las criaturas vivas.',
    ['No muerto', 'Depredador', 'Combate'], [12, 27, '9 m', '+2', 2, '1'], [13, 15, 10, 7, 10, 6],
    {
      personality: ['Hambriento y astuto de una forma animal.'], saves: ['Con +2'], skills: ['Percepción +2'],
      traits: ['Inmune al veneno, al estado Envenenado y al agotamiento.'],
      attacks: ['Mordisco. Ataque cuerpo a cuerpo: +4; impacto 9 (2d6 + 2) perforante.', 'Garras. Ataque cuerpo a cuerpo: +4; impacto 7 (2d4 + 2) cortante; salvación de Con CD 10 o queda Paralizado hasta el final de su siguiente turno.'],
    }
  ),
  profile(
    'lobo', 'Lobo', 'Bestia', 'Cazador de manada', 'Bestia',
    'Depredador veloz que derriba a una presa para que la manada pueda rodearla.',
    ['Bestia', 'Bosque', 'Manada'], [13, 11, '12 m', '+2', 2, '1/4'], [12, 15, 12, 3, 12, 6],
    {
      personality: ['Animal cauteloso que protege su territorio y su manada.'], skills: ['Percepción +3', 'Sigilo +4'],
      traits: ['Oído y olfato agudos. Ventaja en Percepción basada en oído u olfato.', 'Tácticas de manada. Ventaja al atacar si un aliado está junto al objetivo.'],
      attacks: ['Mordisco. Ataque cuerpo a cuerpo: +4; impacto 7 (2d4 + 2) perforante; salvación de Fue CD 11 o el objetivo cae Derribado.'],
    }
  ),
  profile(
    'lobo-terrible', 'Lobo terrible', 'Bestia', 'Depredador grande', 'Bestia',
    'Lobo enorme capaz de arrastrar al suelo incluso a combatientes acorazados.',
    ['Bestia', 'Bosque', 'Manada'], [14, 42, '15 m', '+2', 2, '1'], [17, 15, 15, 3, 12, 7],
    {
      personality: ['Territorial, persistente y feroz al defender a la manada.'], skills: ['Percepción +3', 'Sigilo +4'],
      traits: ['Oído y olfato agudos.', 'Tácticas de manada. Ventaja al atacar si un aliado está junto al objetivo.'],
      attacks: ['Mordisco. Ataque cuerpo a cuerpo: +5; impacto 10 (2d6 + 3) perforante; salvación de Fue CD 13 o el objetivo cae Derribado.'],
    }
  ),
  profile(
    'oso-pardo', 'Oso pardo', 'Bestia', 'Bruto territorial', 'Bestia',
    'Bestia grande y poderosa que puede cargar, sujetar y destrozar con garras y mandíbulas.',
    ['Bestia', 'Bosque', 'Bruto'], [12, 38, '12 m, trepar 9 m', '+0', 2, '1'], [19, 10, 16, 2, 13, 7],
    {
      personality: ['Evita problemas salvo cuando tiene hambre, crías o territorio que defender.'], skills: ['Percepción +3'],
      traits: ['Olfato agudo. Ventaja en pruebas de Percepción basadas en el olfato.'],
      attacks: ['Ataque múltiple. Realiza un mordisco y un ataque de garras.', 'Mordisco. Ataque cuerpo a cuerpo: +6; impacto 8 (1d8 + 4) perforante.', 'Garras. Ataque cuerpo a cuerpo: +6; impacto 11 (2d6 + 4) cortante.'],
    }
  ),
  profile(
    'rata-gigante', 'Rata gigante', 'Bestia', 'Carroñero', 'Bestia',
    'Roedor agresivo de túneles y alcantarillas que ataca con más confianza en grupo.',
    ['Bestia', 'Subterráneo', 'Manada'], [12, 7, '9 m', '+2', 2, '1/8'], [7, 15, 11, 2, 10, 4],
    {
      personality: ['Hambrienta y fácil de ahuyentar con fuego o ruido intenso.'], skills: ['Percepción +2', 'Sigilo +4'],
      traits: ['Olfato agudo.', 'Tácticas de manada. Ventaja al atacar si un aliado está junto al objetivo.'],
      attacks: ['Mordisco. Ataque cuerpo a cuerpo: +4; impacto 4 (1d4 + 2) perforante.'],
    }
  ),
  profile(
    'arana-gigante', 'Araña gigante', 'Bestia', 'Depredador de emboscada', 'Bestia',
    'Arácnido enorme que inmoviliza a sus presas con redes antes de acercarse.',
    ['Bestia', 'Subterráneo', 'Emboscada'], [14, 26, '9 m, trepar 9 m', '+3', 2, '1'], [14, 16, 12, 2, 11, 4],
    {
      personality: ['Paciente y sensible a cualquier vibración en su red.'], skills: ['Sigilo +7'],
      traits: ['Trepar como araña. Puede trepar por superficies difíciles y techos.', 'Sentido de la telaraña. Conoce la ubicación de criaturas que toquen su red.'],
      attacks: ['Mordisco. Ataque cuerpo a cuerpo: +5; impacto 7 (1d8 + 3) perforante más 7 (2d6) veneno, salvación de Con CD 11 para mitad.', 'Telaraña (recarga 5-6). Ataque a distancia: +5; el objetivo queda Apresado, escapatoria CD 12.'],
    }
  ),
  profile(
    'enjambre-ratas', 'Enjambre de ratas', 'Bestia', 'Masa de alimañas', 'Enjambre',
    'Una masa chillona de roedores que ocupa el espacio de otras criaturas y se cuela por aberturas estrechas.',
    ['Bestia', 'Urbano', 'Enjambre'], [10, 24, '9 m', '+2', 2, '1/4'], [9, 14, 11, 2, 10, 3],
    {
      personality: ['Impulsado por hambre, miedo y el movimiento del grupo.'],
      traits: ['Enjambre. Puede ocupar el espacio de otra criatura y atravesar aberturas diminutas.', 'Resiste daño contundente, perforante y cortante de ataques no mágicos.'],
      attacks: ['Mordiscos. Ataque cuerpo a cuerpo: +4; impacto 7 (2d6) perforante, o 3 (1d6) si el enjambre tiene la mitad o menos de sus PG.'],
    }
  ),
  profile(
    'caballo-guerra', 'Caballo de guerra', 'Bestia', 'Montura entrenada', 'Bestia',
    'Montura fuerte y disciplinada preparada para cargar entre ruido, armas y multitudes.',
    ['Bestia', 'Montura', 'Militar'], [11, 24, '18 m', '+1', 2, '1/2'], [18, 12, 13, 2, 12, 7],
    {
      personality: ['Leal a un jinete conocido y nervioso sin entrenamiento adecuado.'], skills: ['Percepción +3'],
      traits: ['Carga. Si se mueve al menos 6 m en línea recta antes de impactar con cascos, inflige 2d6 contundente adicional y puede derribar con salvación de Fue CD 14.'],
      attacks: ['Cascos. Ataque cuerpo a cuerpo: +6; impacto 11 (2d6 + 4) contundente.'],
      equipment: ['Silla militar', 'Brida', 'Alforjas'],
    }
  ),
];
