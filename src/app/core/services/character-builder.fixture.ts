import { RulesCompendium } from '../models/rules';
import { CharacterBuild } from '../models/character-build';
import { initialBuild } from './character-builder';
export const rules: RulesCompendium = {
  "source": "Manual del Jugador 2024 (edicion en espanol)",
  "edition": "D&D 5.5 (2024)",
  "spells": [
    {
      "id": "crear-llama",
      "name": "Crear llama",
      "summary": "Truco de conjuración disponible para Druida.",
      "tags": [
        "Hechizo",
        "Truco",
        "Conjuración",
        "Druida"
      ],
      "sourcePage": 266,
      "level": 0,
      "school": "Conjuración",
      "classes": [
        "Druida"
      ],
      "castingTime": "Acción adicional",
      "range": "Lanzador",
      "components": "V, S",
      "duration": "10 minutos",
      "description": "Crear llama"
    },
    {
      "id": "descarga-de-fuego",
      "name": "Descarga de fuego",
      "summary": "Truco de evocación disponible para Hechicero, Mago.",
      "tags": [
        "Hechizo",
        "Truco",
        "Evocación",
        "Hechicero",
        "Mago"
      ],
      "sourcePage": 268,
      "level": 0,
      "school": "Evocación",
      "classes": [
        "Hechicero",
        "Mago"
      ],
      "castingTime": "Acción",
      "range": "36 m",
      "components": "V, S",
      "duration": "Instantáneo",
      "description": "Descarga de fuego"
    },
    {
      "id": "luz",
      "name": "Luz",
      "summary": "Truco de evocación disponible para Bardo, Clérigo, Hechicero, Mago.",
      "tags": [
        "Hechizo",
        "Truco",
        "Evocación",
        "Bardo",
        "Clérigo",
        "Hechicero",
        "Mago"
      ],
      "sourcePage": 306,
      "level": 0,
      "school": "Evocación",
      "classes": [
        "Bardo",
        "Clérigo",
        "Hechicero",
        "Mago"
      ],
      "castingTime": "Acción",
      "range": "Toque",
      "components": "V, M (una luciérnaga o musgo fosforescente)",
      "duration": "1 hora",
      "description": "Luz"
    },
    {
      "id": "mano-de-mago",
      "name": "Mano de mago",
      "summary": "Truco de conjuración disponible para Bardo, Brujo, Hechicero, Mago.",
      "tags": [
        "Hechizo",
        "Truco",
        "Conjuración",
        "Bardo",
        "Brujo",
        "Hechicero",
        "Mago"
      ],
      "sourcePage": 308,
      "level": 0,
      "school": "Conjuración",
      "classes": [
        "Bardo",
        "Brujo",
        "Hechicero",
        "Mago"
      ],
      "castingTime": "Acción",
      "range": "9 m",
      "components": "V, S",
      "duration": "1 minuto",
      "description": "Mano de mago"
    },
    {
      "id": "saber-druidico",
      "name": "Saber druídico",
      "summary": "Truco de transmutación disponible para Druida.",
      "tags": [
        "Hechizo",
        "Truco",
        "Transmutación",
        "Druida"
      ],
      "sourcePage": 330,
      "level": 0,
      "school": "Transmutación",
      "classes": [
        "Druida"
      ],
      "castingTime": "Acción",
      "range": "9 m",
      "components": "V, S",
      "duration": "Instantáneo",
      "description": "Saber druídico"
    },
    {
      "id": "taumaturgia",
      "name": "Taumaturgia",
      "summary": "Truco de transmutación disponible para Clérigo.",
      "tags": [
        "Hechizo",
        "Truco",
        "Transmutación",
        "Clérigo"
      ],
      "sourcePage": 335,
      "level": 0,
      "school": "Transmutación",
      "classes": [
        "Clérigo"
      ],
      "castingTime": "Acción",
      "range": "9 m",
      "components": "V",
      "duration": "Hasta 1 minuto",
      "description": "Taumaturgia"
    },
    {
      "id": "castigo-divino",
      "name": "Castigo divino",
      "summary": "Conjuro de evocación de nivel 1 disponible para Paladín.",
      "tags": [
        "Hechizo",
        "Nivel 1",
        "Evocación",
        "Paladín"
      ],
      "sourcePage": 255,
      "level": 1,
      "school": "Evocación",
      "classes": [
        "Paladín"
      ],
      "castingTime": "Acción adicionál, que realizas",
      "range": "Lanzador",
      "components": "V",
      "duration": "Instantáneo",
      "description": "Castigo divino"
    },
    {
      "id": "detectar-magia",
      "name": "Detectar magia",
      "summary": "Conjuro de adivinación de nivel 1 disponible para Bardo, Brujo, Clérigo, Druida, Explorador, Hechicero, Mago, Paladín.",
      "tags": [
        "Hechizo",
        "Nivel 1",
        "Adivinación",
        "Bardo",
        "Brujo",
        "Clérigo",
        "Druida",
        "Explorador",
        "Hechicero",
        "Mago",
        "Paladín"
      ],
      "sourcePage": 270,
      "level": 1,
      "school": "Adivinación",
      "classes": [
        "Bardo",
        "Brujo",
        "Clérigo",
        "Druida",
        "Explorador",
        "Hechicero",
        "Mago",
        "Paladín"
      ],
      "castingTime": "Acción o ritual",
      "range": "Lanzador",
      "components": "V, S",
      "duration": "Concentración, hasta 10 minutos",
      "description": "Detectar magia"
    },
    {
      "id": "marca-del-cazador",
      "name": "Marca del cazador",
      "summary": "Conjuro de adivinación de nivel 1 disponible para Explorador.",
      "tags": [
        "Hechizo",
        "Nivel 1",
        "Adivinación",
        "Explorador"
      ],
      "sourcePage": 310,
      "level": 1,
      "school": "Adivinación",
      "classes": [
        "Explorador"
      ],
      "castingTime": "Acción adicional",
      "range": "27 m",
      "components": "V",
      "duration": "Concentración, hasta 1 hora",
      "description": "Marca del cazador"
    },
    {
      "id": "proyectil-magico",
      "name": "Proyectil mágico",
      "summary": "Conjuro de evocación de nivel 1 disponible para Hechicero, Mago.",
      "tags": [
        "Hechizo",
        "Nivel 1",
        "Evocación",
        "Hechicero",
        "Mago"
      ],
      "sourcePage": 323,
      "level": 1,
      "school": "Evocación",
      "classes": [
        "Hechicero",
        "Mago"
      ],
      "castingTime": "Acción",
      "range": "36 m",
      "components": "V, S",
      "duration": "Instantáneo",
      "description": "Proyectil mágico"
    },
    {
      "id": "reprension-infernal",
      "name": "Reprensión infernal",
      "summary": "Conjuro de evocación de nivel 1 disponible para Brujo.",
      "tags": [
        "Hechizo",
        "Nivel 1",
        "Evocación",
        "Brujo"
      ],
      "sourcePage": 328,
      "level": 1,
      "school": "Evocación",
      "classes": [
        "Brujo"
      ],
      "castingTime": "Reacción, que llevas a cabo en",
      "range": "18 m",
      "components": "V, S",
      "duration": "Instantáneo",
      "description": "Reprensión infernal"
    },
    {
      "id": "zancada-prodigiosa",
      "name": "Zancada prodigiosa",
      "summary": "Conjuro de transmutación de nivel 1 disponible para Bardo, Druida, Explorador, Mago.",
      "tags": [
        "Hechizo",
        "Nivel 1",
        "Transmutación",
        "Bardo",
        "Druida",
        "Explorador",
        "Mago"
      ],
      "sourcePage": 343,
      "level": 1,
      "school": "Transmutación",
      "classes": [
        "Bardo",
        "Druida",
        "Explorador",
        "Mago"
      ],
      "castingTime": "Acción",
      "range": "Toque",
      "components": "V, S, M (una pizca de tierra)",
      "duration": "",
      "description": "Zancada prodigiosa"
    },
    {
      "id": "oscuridad",
      "name": "Oscuridad",
      "summary": "Conjuro de evocación de nivel 2 disponible para Brujo, Hechicero, Mago.",
      "tags": [
        "Hechizo",
        "Nivel 2",
        "Evocación",
        "Brujo",
        "Hechicero",
        "Mago"
      ],
      "sourcePage": 316,
      "level": 2,
      "school": "Evocación",
      "classes": [
        "Brujo",
        "Hechicero",
        "Mago"
      ],
      "castingTime": "Acción",
      "range": "18 m",
      "components": "V, M (pelaje de murciélago y un trozo",
      "duration": "Concentración, hasta 10 minutos",
      "description": "Oscuridad"
    },
    {
      "id": "pasar-sin-rastro",
      "name": "Pasar sin rastro",
      "summary": "Conjuro de abjuración de nivel 2 disponible para Druida, Explorador.",
      "tags": [
        "Hechizo",
        "Nivel 2",
        "Abjuración",
        "Druida",
        "Explorador"
      ],
      "sourcePage": 318,
      "level": 2,
      "school": "Abjuración",
      "classes": [
        "Druida",
        "Explorador"
      ],
      "castingTime": "Acción",
      "range": "Lanzador",
      "components": "V, S, M (cenizas de muérdago quemado)",
      "duration": "Concentración, hasta 1 hora",
      "description": "Pasar sin rastro"
    },
    {
      "id": "paso-brumoso",
      "name": "Paso brumoso",
      "summary": "Conjuro de conjuración de nivel 2 disponible para Brujo, Hechicero, Mago.",
      "tags": [
        "Hechizo",
        "Nivel 2",
        "Conjuración",
        "Brujo",
        "Hechicero",
        "Mago"
      ],
      "sourcePage": 318,
      "level": 2,
      "school": "Conjuración",
      "classes": [
        "Brujo",
        "Hechicero",
        "Mago"
      ],
      "castingTime": "Acción adicional",
      "range": "Lanzador",
      "components": "V",
      "duration": "Instantáneo",
      "description": "Paso brumoso"
    },
    {
      "id": "bola-de-fuego",
      "name": "Bola de fuego",
      "summary": "Conjuro de evocación de nivel 3 disponible para Hechicero, Mago.",
      "tags": [
        "Hechizo",
        "Nivel 3",
        "Evocación",
        "Hechicero",
        "Mago"
      ],
      "sourcePage": 249,
      "level": 3,
      "school": "Evocación",
      "classes": [
        "Hechicero",
        "Mago"
      ],
      "castingTime": "Acción",
      "range": "45 m",
      "components": "V, S, M (una pelota de guano de murciélago",
      "duration": "Instantáneo",
      "description": "Bola de fuego"
    },
    {
      "id": "escudo",
      "name": "Escudo",
      "summary": "Reacción defensiva que aumenta la CA hasta tu siguiente turno.",
      "description": "Al recibir un impacto de una tirada de ataque o ser objetivo de proyectil mágico, puedes usar tu reacción. Tu CA aumenta en 5, también contra el ataque desencadenante, hasta el principio de tu siguiente turno. Durante ese tiempo no recibes daño de proyectil mágico.",
      "tags": [
        "Hechizo",
        "Nivel 1",
        "Abjuración",
        "Hechicero",
        "Mago"
      ],
      "sourcePage": 0,
      "sourceUrl": "https://www.dndbeyond.com/sources/dnd/br-2024/spell-descriptions#Shield",
      "level": 1,
      "school": "Abjuración",
      "classes": [
        "Hechicero",
        "Mago"
      ],
      "castingTime": "Reacción al recibir un impacto o ser objetivo de proyectil mágico",
      "range": "Personal",
      "components": "V, S",
      "duration": "1 asalto"
    },
    {
      "id": "rociada-venenosa",
      "name": "Rociada venenosa",
      "summary": "Truco de ataque a distancia que inflige daño de veneno.",
      "description": "Realiza un ataque de conjuro a distancia contra una criatura a 9 m o menos. Un impacto causa 1d12 de daño de veneno. El daño aumenta a 2d12 a nivel 5, 3d12 a nivel 11 y 4d12 a nivel 17.",
      "tags": [
        "Hechizo",
        "Truco",
        "Nigromancia",
        "Druida",
        "Hechicero",
        "Brujo",
        "Mago"
      ],
      "sourcePage": 0,
      "sourceUrl": "https://www.dndbeyond.com/sources/dnd/br-2024/spell-descriptions#PoisonSpray",
      "level": 0,
      "school": "Nigromancia",
      "classes": [
        "Druida",
        "Hechicero",
        "Brujo",
        "Mago"
      ],
      "castingTime": "Acción",
      "range": "9 m",
      "components": "V, S",
      "duration": "Instantáneo"
    },
    {
      "id": "maleficio",
      "name": "Maleficio",
      "summary": "Conjuro de encantamiento de nivel 1 disponible para Brujo.",
      "tags": [
        "Hechizo",
        "Nivel 1",
        "Encantamiento",
        "Brujo"
      ],
      "sourcePage": 307,
      "level": 1,
      "school": "Encantamiento",
      "classes": [
        "Brujo"
      ],
      "castingTime": "Acción adicional",
      "range": "27 m",
      "components": "V, S, M (el ojo petrificado de un tritón)",
      "duration": "Concentración, hasta 1 hora",
      "description": "Impones una maldición a una criatura que puedas ver dentro del alcance. Hasta que el conjuro termine, infliges 1d6 de daño necrótico adicional al objetivo siempre que le aciertes con una tirada de ataque. Además, elige una característica cuando lances el conjuro. El objetivo tendrá desventaja en las pruebas que haga con la característica elegida. Silos puntos de golpe del objetivo se reducen a O antes de que el conjuro termine, puedes usar una acción adicional en un turno posterior para maldecir a una nueva criatura. Con un espacio de conjuro de nivel superior. Tu concen- tración puede durar más si usas un espacio de conjuro de nivel 2 (hasta 4 horas), 3 o 4 (hasta 8 horas) o 5 o más (24 horas)."
    }
  ],
  "feats": [
    {
      "id": "afortunado",
      "name": "Afortunado",
      "summary": "Dote de origen para personalizar las capacidades del personaje. Consulta sus beneficios en la pagina indicada.",
      "tags": [
        "Dote",
        "Dote de origen"
      ],
      "sourcePage": 200,
      "category": "Dote de origen",
      "repeatable": false,
      "description": "Afortunado"
    },
    {
      "id": "alerta",
      "name": "Alerta",
      "summary": "Dote de origen para personalizar las capacidades del personaje. Consulta sus beneficios en la pagina indicada.",
      "tags": [
        "Dote",
        "Dote de origen"
      ],
      "sourcePage": 200,
      "category": "Dote de origen",
      "repeatable": false,
      "description": "Alerta"
    },
    {
      "id": "atacante-salvaje",
      "name": "Atacante salvaje",
      "summary": "Dote de origen para personalizar las capacidades del personaje. Consulta sus beneficios en la pagina indicada.",
      "tags": [
        "Dote",
        "Dote de origen"
      ],
      "sourcePage": 201,
      "category": "Dote de origen",
      "repeatable": false,
      "description": "Atacante salvaje"
    },
    {
      "id": "duro",
      "name": "Duro",
      "summary": "Dote de origen para personalizar las capacidades del personaje. Consulta sus beneficios en la pagina indicada.",
      "tags": [
        "Dote",
        "Dote de origen"
      ],
      "sourcePage": 201,
      "category": "Dote de origen",
      "repeatable": false,
      "description": "Duro"
    },
    {
      "id": "fabricante",
      "name": "Fabricante",
      "summary": "Dote de origen para personalizar las capacidades del personaje. Consulta sus beneficios en la pagina indicada.",
      "tags": [
        "Dote",
        "Dote de origen"
      ],
      "sourcePage": 201,
      "category": "Dote de origen",
      "repeatable": false,
      "description": "Fabricante"
    },
    {
      "id": "habilidoso",
      "name": "Habilidoso",
      "summary": "Dote de origen para personalizar las capacidades del personaje. Consulta sus beneficios en la pagina indicada.",
      "tags": [
        "Dote",
        "Dote de origen"
      ],
      "sourcePage": 201,
      "category": "Dote de origen",
      "repeatable": true,
      "description": "Habilidoso"
    },
    {
      "id": "iniciado-en-la-magia",
      "name": "Iniciado en la magia",
      "summary": "Dote de origen para personalizar las capacidades del personaje. Consulta sus beneficios en la pagina indicada.",
      "tags": [
        "Dote",
        "Dote de origen"
      ],
      "sourcePage": 201,
      "category": "Dote de origen",
      "repeatable": true,
      "description": "Iniciado en la magia"
    },
    {
      "id": "maton-de-taberna",
      "name": "Matón de taberna",
      "summary": "Dote de origen para personalizar las capacidades del personaje. Consulta sus beneficios en la pagina indicada.",
      "tags": [
        "Dote",
        "Dote de origen"
      ],
      "sourcePage": 202,
      "category": "Dote de origen",
      "repeatable": false,
      "description": "Matón de taberna"
    },
    {
      "id": "musico",
      "name": "Músico",
      "summary": "Dote de origen para personalizar las capacidades del personaje. Consulta sus beneficios en la pagina indicada.",
      "tags": [
        "Dote",
        "Dote de origen"
      ],
      "sourcePage": 202,
      "category": "Dote de origen",
      "repeatable": false,
      "description": "Músico"
    },
    {
      "id": "sanador",
      "name": "Sanador",
      "summary": "Dote de origen para personalizar las capacidades del personaje. Consulta sus beneficios en la pagina indicada.",
      "tags": [
        "Dote",
        "Dote de origen"
      ],
      "sourcePage": 202,
      "category": "Dote de origen",
      "repeatable": false,
      "description": "Sanador"
    }
  ],
  "skills": [
    {
      "id": "acrobacias",
      "name": "Acrobacias",
      "summary": "Habilidad de Destreza para mantener el equilibrio.",
      "tags": [
        "Habilidad",
        "Destreza"
      ],
      "sourcePage": 14,
      "ability": "Destreza",
      "uses": [
        "Mantener el equilibrio",
        "Realizar maniobras acrobaticas"
      ],
      "description": "Acrobacias representa la capacidad de mantener el equilibrio y de realizar maniobras acrobaticas. El DM puede pedir una prueba de Destreza (Acrobacias) cuando el resultado sea incierto y exista una consecuencia relevante."
    },
    {
      "id": "atletismo",
      "name": "Atletismo",
      "summary": "Habilidad de Fuerza para trepar, saltar o nadar.",
      "tags": [
        "Habilidad",
        "Fuerza"
      ],
      "sourcePage": 14,
      "ability": "Fuerza",
      "uses": [
        "Trepar, saltar o nadar",
        "Forzar movimiento fisico"
      ],
      "description": "Atletismo representa la capacidad de trepar, saltar o nadar y de forzar movimiento fisico. El DM puede pedir una prueba de Fuerza (Atletismo) cuando el resultado sea incierto y exista una consecuencia relevante."
    },
    {
      "id": "conocimiento-arcano",
      "name": "Conocimiento arcano",
      "summary": "Habilidad de Inteligencia para recordar saber magico.",
      "tags": [
        "Habilidad",
        "Inteligencia"
      ],
      "sourcePage": 14,
      "ability": "Inteligencia",
      "uses": [
        "Recordar saber magico",
        "Identificar efectos arcanos"
      ],
      "description": "Conocimiento arcano representa la capacidad de recordar saber magico y de identificar efectos arcanos. El DM puede pedir una prueba de Inteligencia (Conocimiento arcano) cuando el resultado sea incierto y exista una consecuencia relevante."
    },
    {
      "id": "engano",
      "name": "Engaño",
      "summary": "Habilidad de Carisma para ocultar la verdad.",
      "tags": [
        "Habilidad",
        "Carisma"
      ],
      "sourcePage": 14,
      "ability": "Carisma",
      "uses": [
        "Ocultar la verdad",
        "Mantener una identidad falsa"
      ],
      "description": "Engaño representa la capacidad de ocultar la verdad y de mantener una identidad falsa. El DM puede pedir una prueba de Carisma (Engaño) cuando el resultado sea incierto y exista una consecuencia relevante."
    },
    {
      "id": "historia",
      "name": "Historia",
      "summary": "Habilidad de Inteligencia para recordar hechos historicos.",
      "tags": [
        "Habilidad",
        "Inteligencia"
      ],
      "sourcePage": 14,
      "ability": "Inteligencia",
      "uses": [
        "Recordar hechos historicos",
        "Reconocer culturas y conflictos"
      ],
      "description": "Historia representa la capacidad de recordar hechos historicos y de reconocer culturas y conflictos. El DM puede pedir una prueba de Inteligencia (Historia) cuando el resultado sea incierto y exista una consecuencia relevante."
    },
    {
      "id": "interpretacion",
      "name": "Interpretación",
      "summary": "Habilidad de Carisma para actuar ante un publico.",
      "tags": [
        "Habilidad",
        "Carisma"
      ],
      "sourcePage": 14,
      "ability": "Carisma",
      "uses": [
        "Actuar ante un publico",
        "Entretener o emocionar"
      ],
      "description": "Interpretación representa la capacidad de actuar ante un publico y de entretener o emocionar. El DM puede pedir una prueba de Carisma (Interpretación) cuando el resultado sea incierto y exista una consecuencia relevante."
    },
    {
      "id": "intimidacion",
      "name": "Intimidación",
      "summary": "Habilidad de Carisma para presionar mediante amenazas.",
      "tags": [
        "Habilidad",
        "Carisma"
      ],
      "sourcePage": 14,
      "ability": "Carisma",
      "uses": [
        "Presionar mediante amenazas",
        "Forzar una concesion"
      ],
      "description": "Intimidación representa la capacidad de presionar mediante amenazas y de forzar una concesion. El DM puede pedir una prueba de Carisma (Intimidación) cuando el resultado sea incierto y exista una consecuencia relevante."
    },
    {
      "id": "investigacion",
      "name": "Investigación",
      "summary": "Habilidad de Inteligencia para deducir a partir de pistas.",
      "tags": [
        "Habilidad",
        "Inteligencia"
      ],
      "sourcePage": 14,
      "ability": "Inteligencia",
      "uses": [
        "Deducir a partir de pistas",
        "Registrar una escena"
      ],
      "description": "Investigación representa la capacidad de deducir a partir de pistas y de registrar una escena. El DM puede pedir una prueba de Inteligencia (Investigación) cuando el resultado sea incierto y exista una consecuencia relevante."
    },
    {
      "id": "juego-de-manos",
      "name": "Juego de Manos",
      "summary": "Habilidad de Destreza para manipular objetos discretamente.",
      "tags": [
        "Habilidad",
        "Destreza"
      ],
      "sourcePage": 14,
      "ability": "Destreza",
      "uses": [
        "Manipular objetos discretamente",
        "Robar o esconder algo"
      ],
      "description": "Juego de Manos representa la capacidad de manipular objetos discretamente y de robar o esconder algo. El DM puede pedir una prueba de Destreza (Juego de Manos) cuando el resultado sea incierto y exista una consecuencia relevante."
    },
    {
      "id": "medicina",
      "name": "Medicina",
      "summary": "Habilidad de Sabiduría para estabilizar a una criatura.",
      "tags": [
        "Habilidad",
        "Sabiduría"
      ],
      "sourcePage": 14,
      "ability": "Sabiduría",
      "uses": [
        "Estabilizar a una criatura",
        "Diagnosticar heridas o enfermedades"
      ],
      "description": "Medicina representa la capacidad de estabilizar a una criatura y de diagnosticar heridas o enfermedades. El DM puede pedir una prueba de Sabiduría (Medicina) cuando el resultado sea incierto y exista una consecuencia relevante."
    },
    {
      "id": "naturaleza",
      "name": "Naturaleza",
      "summary": "Habilidad de Inteligencia para recordar saber natural.",
      "tags": [
        "Habilidad",
        "Inteligencia"
      ],
      "sourcePage": 14,
      "ability": "Inteligencia",
      "uses": [
        "Recordar saber natural",
        "Reconocer fauna, flora y terreno"
      ],
      "description": "Naturaleza representa la capacidad de recordar saber natural y de reconocer fauna, flora y terreno. El DM puede pedir una prueba de Inteligencia (Naturaleza) cuando el resultado sea incierto y exista una consecuencia relevante."
    },
    {
      "id": "percepcion",
      "name": "Percepción",
      "summary": "Habilidad de Sabiduría para advertir detalles del entorno.",
      "tags": [
        "Habilidad",
        "Sabiduría"
      ],
      "sourcePage": 14,
      "ability": "Sabiduría",
      "uses": [
        "Advertir detalles del entorno",
        "Detectar una presencia oculta"
      ],
      "description": "Percepción representa la capacidad de advertir detalles del entorno y de detectar una presencia oculta. El DM puede pedir una prueba de Sabiduría (Percepción) cuando el resultado sea incierto y exista una consecuencia relevante."
    },
    {
      "id": "perspicacia",
      "name": "Perspicacia",
      "summary": "Habilidad de Sabiduría para leer intenciones.",
      "tags": [
        "Habilidad",
        "Sabiduría"
      ],
      "sourcePage": 14,
      "ability": "Sabiduría",
      "uses": [
        "Leer intenciones",
        "Reconocer mentiras o cambios de animo"
      ],
      "description": "Perspicacia representa la capacidad de leer intenciones y de reconocer mentiras o cambios de animo. El DM puede pedir una prueba de Sabiduría (Perspicacia) cuando el resultado sea incierto y exista una consecuencia relevante."
    },
    {
      "id": "persuasion",
      "name": "Persuasión",
      "summary": "Habilidad de Carisma para influir con buena fe.",
      "tags": [
        "Habilidad",
        "Carisma"
      ],
      "sourcePage": 14,
      "ability": "Carisma",
      "uses": [
        "Influir con buena fe",
        "Negociar o solicitar ayuda"
      ],
      "description": "Persuasión representa la capacidad de influir con buena fe y de negociar o solicitar ayuda. El DM puede pedir una prueba de Carisma (Persuasión) cuando el resultado sea incierto y exista una consecuencia relevante."
    },
    {
      "id": "religion",
      "name": "Religión",
      "summary": "Habilidad de Inteligencia para recordar saber religioso.",
      "tags": [
        "Habilidad",
        "Inteligencia"
      ],
      "sourcePage": 14,
      "ability": "Inteligencia",
      "uses": [
        "Recordar saber religioso",
        "Reconocer ritos, dioses y simbolos"
      ],
      "description": "Religión representa la capacidad de recordar saber religioso y de reconocer ritos, dioses y simbolos. El DM puede pedir una prueba de Inteligencia (Religión) cuando el resultado sea incierto y exista una consecuencia relevante."
    },
    {
      "id": "sigilo",
      "name": "Sigilo",
      "summary": "Habilidad de Destreza para moverse sin ser detectado.",
      "tags": [
        "Habilidad",
        "Destreza"
      ],
      "sourcePage": 14,
      "ability": "Destreza",
      "uses": [
        "Moverse sin ser detectado",
        "Ocultarse"
      ],
      "description": "Sigilo representa la capacidad de moverse sin ser detectado y de ocultarse. El DM puede pedir una prueba de Destreza (Sigilo) cuando el resultado sea incierto y exista una consecuencia relevante."
    },
    {
      "id": "supervivencia",
      "name": "Supervivencia",
      "summary": "Habilidad de Sabiduría para seguir rastros.",
      "tags": [
        "Habilidad",
        "Sabiduría"
      ],
      "sourcePage": 14,
      "ability": "Sabiduría",
      "uses": [
        "Seguir rastros",
        "Orientarse y buscar recursos"
      ],
      "description": "Supervivencia representa la capacidad de seguir rastros y de orientarse y buscar recursos. El DM puede pedir una prueba de Sabiduría (Supervivencia) cuando el resultado sea incierto y exista una consecuencia relevante."
    },
    {
      "id": "trato-con-animales",
      "name": "Trato con Animales",
      "summary": "Habilidad de Sabiduría para calmar o guiar animales.",
      "tags": [
        "Habilidad",
        "Sabiduría"
      ],
      "sourcePage": 14,
      "ability": "Sabiduría",
      "uses": [
        "Calmar o guiar animales",
        "Interpretar su conducta"
      ],
      "description": "Trato con Animales representa la capacidad de calmar o guiar animales y de interpretar su conducta. El DM puede pedir una prueba de Sabiduría (Trato con Animales) cuando el resultado sea incierto y exista una consecuencia relevante."
    }
  ],
  "equipment": [
    {
      "id": "baston",
      "name": "Bastón",
      "summary": "Sencilla cuerpo a cuerpo del Manual del Jugador 2024.",
      "tags": [
        "Equipo",
        "Sencilla cuerpo a cuerpo"
      ],
      "sourcePage": 215,
      "category": "Sencilla cuerpo a cuerpo",
      "cost": "2 pp",
      "weight": "2 kg",
      "properties": [
        "1d6 contundente",
        "Versatil (1d8)"
      ],
      "description": "Bastón"
    },
    {
      "id": "daga",
      "name": "Daga",
      "summary": "Sencilla cuerpo a cuerpo del Manual del Jugador 2024.",
      "tags": [
        "Equipo",
        "Sencilla cuerpo a cuerpo"
      ],
      "sourcePage": 215,
      "category": "Sencilla cuerpo a cuerpo",
      "cost": "2 po",
      "weight": "0,5 kg",
      "properties": [
        "1d4 perforante",
        "Arrojadiza, ligera, sutil"
      ],
      "description": "Daga"
    },
    {
      "id": "garrote",
      "name": "Garrote",
      "summary": "Sencilla cuerpo a cuerpo del Manual del Jugador 2024.",
      "tags": [
        "Equipo",
        "Sencilla cuerpo a cuerpo"
      ],
      "sourcePage": 215,
      "category": "Sencilla cuerpo a cuerpo",
      "cost": "1 pp",
      "weight": "1 kg",
      "properties": [
        "1d4 contundente",
        "Ligera"
      ],
      "description": "Garrote"
    },
    {
      "id": "garrote-grande",
      "name": "Garrote grande",
      "summary": "Sencilla cuerpo a cuerpo del Manual del Jugador 2024.",
      "tags": [
        "Equipo",
        "Sencilla cuerpo a cuerpo"
      ],
      "sourcePage": 215,
      "category": "Sencilla cuerpo a cuerpo",
      "cost": "2 pp",
      "weight": "5 kg",
      "properties": [
        "1d8 contundente",
        "A dos manos"
      ],
      "description": "Garrote grande"
    },
    {
      "id": "hacha-de-mano",
      "name": "Hacha de mano",
      "summary": "Sencilla cuerpo a cuerpo del Manual del Jugador 2024.",
      "tags": [
        "Equipo",
        "Sencilla cuerpo a cuerpo"
      ],
      "sourcePage": 215,
      "category": "Sencilla cuerpo a cuerpo",
      "cost": "5 po",
      "weight": "1 kg",
      "properties": [
        "1d6 cortante",
        "Arrojadiza, ligera"
      ],
      "description": "Hacha de mano"
    },
    {
      "id": "hoz",
      "name": "Hoz",
      "summary": "Sencilla cuerpo a cuerpo del Manual del Jugador 2024.",
      "tags": [
        "Equipo",
        "Sencilla cuerpo a cuerpo"
      ],
      "sourcePage": 215,
      "category": "Sencilla cuerpo a cuerpo",
      "cost": "1 po",
      "weight": "1 kg",
      "properties": [
        "1d4 cortante",
        "Ligera"
      ],
      "description": "Hoz"
    },
    {
      "id": "jabalina",
      "name": "Jabalina",
      "summary": "Sencilla cuerpo a cuerpo del Manual del Jugador 2024.",
      "tags": [
        "Equipo",
        "Sencilla cuerpo a cuerpo"
      ],
      "sourcePage": 215,
      "category": "Sencilla cuerpo a cuerpo",
      "cost": "5 pp",
      "weight": "1 kg",
      "properties": [
        "1d6 perforante",
        "Arrojadiza"
      ],
      "description": "Jabalina"
    },
    {
      "id": "lanza",
      "name": "Lanza",
      "summary": "Sencilla cuerpo a cuerpo del Manual del Jugador 2024.",
      "tags": [
        "Equipo",
        "Sencilla cuerpo a cuerpo"
      ],
      "sourcePage": 215,
      "category": "Sencilla cuerpo a cuerpo",
      "cost": "1 po",
      "weight": "1,5 kg",
      "properties": [
        "1d6 perforante",
        "Arrojadiza, versatil (1d8)"
      ],
      "description": "Lanza"
    },
    {
      "id": "martillo-ligero",
      "name": "Martillo ligero",
      "summary": "Sencilla cuerpo a cuerpo del Manual del Jugador 2024.",
      "tags": [
        "Equipo",
        "Sencilla cuerpo a cuerpo"
      ],
      "sourcePage": 215,
      "category": "Sencilla cuerpo a cuerpo",
      "cost": "2 po",
      "weight": "1 kg",
      "properties": [
        "1d4 contundente",
        "Arrojadiza, ligera"
      ],
      "description": "Martillo ligero"
    },
    {
      "id": "maza",
      "name": "Maza",
      "summary": "Sencilla cuerpo a cuerpo del Manual del Jugador 2024.",
      "tags": [
        "Equipo",
        "Sencilla cuerpo a cuerpo"
      ],
      "sourcePage": 215,
      "category": "Sencilla cuerpo a cuerpo",
      "cost": "5 po",
      "weight": "2 kg",
      "properties": [
        "1d6 contundente",
        "Debilitar"
      ],
      "description": "Maza"
    },
    {
      "id": "arco-corto",
      "name": "Arco corto",
      "summary": "Sencilla a distancia del Manual del Jugador 2024.",
      "tags": [
        "Equipo",
        "Sencilla a distancia"
      ],
      "sourcePage": 215,
      "category": "Sencilla a distancia",
      "cost": "25 po",
      "weight": "1 kg",
      "properties": [
        "1d6 perforante",
        "Municion, a dos manos"
      ],
      "description": "Arco corto"
    },
    {
      "id": "ballesta-ligera",
      "name": "Ballesta ligera",
      "summary": "Sencilla a distancia del Manual del Jugador 2024.",
      "tags": [
        "Equipo",
        "Sencilla a distancia"
      ],
      "sourcePage": 215,
      "category": "Sencilla a distancia",
      "cost": "25 po",
      "weight": "2,5 kg",
      "properties": [
        "1d8 perforante",
        "Municion, recarga, a dos manos"
      ],
      "description": "Ballesta ligera"
    },
    {
      "id": "dardo",
      "name": "Dardo",
      "summary": "Sencilla a distancia del Manual del Jugador 2024.",
      "tags": [
        "Equipo",
        "Sencilla a distancia"
      ],
      "sourcePage": 215,
      "category": "Sencilla a distancia",
      "cost": "5 pc",
      "weight": "0,125 kg",
      "properties": [
        "1d4 perforante",
        "Arrojadizo, sutil"
      ],
      "description": "Dardo"
    },
    {
      "id": "honda",
      "name": "Honda",
      "summary": "Sencilla a distancia del Manual del Jugador 2024.",
      "tags": [
        "Equipo",
        "Sencilla a distancia"
      ],
      "sourcePage": 215,
      "category": "Sencilla a distancia",
      "cost": "1 pp",
      "properties": [
        "1d4 contundente",
        "Municion"
      ],
      "description": "Honda"
    },
    {
      "id": "alabarda",
      "name": "Alabarda",
      "summary": "Marcial cuerpo a cuerpo del Manual del Jugador 2024.",
      "tags": [
        "Equipo",
        "Marcial cuerpo a cuerpo"
      ],
      "sourcePage": 215,
      "category": "Marcial cuerpo a cuerpo",
      "cost": "20 po",
      "weight": "3 kg",
      "properties": [
        "1d10 cortante",
        "Pesada, gran alcance, a dos manos"
      ],
      "description": "Alabarda"
    },
    {
      "id": "cimitarra",
      "name": "Cimitarra",
      "summary": "Marcial cuerpo a cuerpo del Manual del Jugador 2024.",
      "tags": [
        "Equipo",
        "Marcial cuerpo a cuerpo"
      ],
      "sourcePage": 215,
      "category": "Marcial cuerpo a cuerpo",
      "cost": "25 po",
      "weight": "1,5 kg",
      "properties": [
        "1d6 cortante",
        "Ligera, sutil"
      ],
      "description": "Cimitarra"
    },
    {
      "id": "espada-corta",
      "name": "Espada corta",
      "summary": "Marcial cuerpo a cuerpo del Manual del Jugador 2024.",
      "tags": [
        "Equipo",
        "Marcial cuerpo a cuerpo"
      ],
      "sourcePage": 215,
      "category": "Marcial cuerpo a cuerpo",
      "cost": "10 po",
      "weight": "1 kg",
      "properties": [
        "1d6 perforante",
        "Ligera, sutil"
      ],
      "description": "Espada corta"
    },
    {
      "id": "espada-larga",
      "name": "Espada larga",
      "summary": "Marcial cuerpo a cuerpo del Manual del Jugador 2024.",
      "tags": [
        "Equipo",
        "Marcial cuerpo a cuerpo"
      ],
      "sourcePage": 215,
      "category": "Marcial cuerpo a cuerpo",
      "cost": "15 po",
      "weight": "1,5 kg",
      "properties": [
        "1d8 cortante",
        "Versatil (1d10)"
      ],
      "description": "Espada larga"
    },
    {
      "id": "espadon",
      "name": "Espadón",
      "summary": "Marcial cuerpo a cuerpo del Manual del Jugador 2024.",
      "tags": [
        "Equipo",
        "Marcial cuerpo a cuerpo"
      ],
      "sourcePage": 215,
      "category": "Marcial cuerpo a cuerpo",
      "cost": "50 po",
      "weight": "3 kg",
      "properties": [
        "2d6 cortante",
        "Pesada, a dos manos"
      ],
      "description": "Espadón"
    },
    {
      "id": "estoque",
      "name": "Estoque",
      "summary": "Marcial cuerpo a cuerpo del Manual del Jugador 2024.",
      "tags": [
        "Equipo",
        "Marcial cuerpo a cuerpo"
      ],
      "sourcePage": 215,
      "category": "Marcial cuerpo a cuerpo",
      "cost": "25 po",
      "weight": "1 kg",
      "properties": [
        "1d8 perforante",
        "Sutil"
      ],
      "description": "Estoque"
    },
    {
      "id": "guja",
      "name": "Guja",
      "summary": "Marcial cuerpo a cuerpo del Manual del Jugador 2024.",
      "tags": [
        "Equipo",
        "Marcial cuerpo a cuerpo"
      ],
      "sourcePage": 215,
      "category": "Marcial cuerpo a cuerpo",
      "cost": "20 po",
      "weight": "3 kg",
      "properties": [
        "1d10 cortante",
        "Pesada, gran alcance, a dos manos"
      ],
      "description": "Guja"
    },
    {
      "id": "hacha-a-dos-manos",
      "name": "Hacha a dos manos",
      "summary": "Marcial cuerpo a cuerpo del Manual del Jugador 2024.",
      "tags": [
        "Equipo",
        "Marcial cuerpo a cuerpo"
      ],
      "sourcePage": 215,
      "category": "Marcial cuerpo a cuerpo",
      "cost": "30 po",
      "weight": "3,5 kg",
      "properties": [
        "1d12 cortante",
        "Pesada, a dos manos"
      ],
      "description": "Hacha a dos manos"
    },
    {
      "id": "hacha-de-guerra",
      "name": "Hacha de guerra",
      "summary": "Marcial cuerpo a cuerpo del Manual del Jugador 2024.",
      "tags": [
        "Equipo",
        "Marcial cuerpo a cuerpo"
      ],
      "sourcePage": 215,
      "category": "Marcial cuerpo a cuerpo",
      "cost": "10 po",
      "weight": "2 kg",
      "properties": [
        "1d8 cortante",
        "Versatil (1d10)"
      ],
      "description": "Hacha de guerra"
    },
    {
      "id": "lanza-de-caballeria",
      "name": "Lanza de caballería",
      "summary": "Marcial cuerpo a cuerpo del Manual del Jugador 2024.",
      "tags": [
        "Equipo",
        "Marcial cuerpo a cuerpo"
      ],
      "sourcePage": 215,
      "category": "Marcial cuerpo a cuerpo",
      "cost": "10 po",
      "weight": "3 kg",
      "properties": [
        "1d10 perforante",
        "Pesada, gran alcance"
      ],
      "description": "Lanza de caballería"
    },
    {
      "id": "latigo",
      "name": "Látigo",
      "summary": "Marcial cuerpo a cuerpo del Manual del Jugador 2024.",
      "tags": [
        "Equipo",
        "Marcial cuerpo a cuerpo"
      ],
      "sourcePage": 215,
      "category": "Marcial cuerpo a cuerpo",
      "cost": "2 po",
      "weight": "1,5 kg",
      "properties": [
        "1d4 cortante",
        "Gran alcance, sutil"
      ],
      "description": "Látigo"
    },
    {
      "id": "lucero-del-alba",
      "name": "Lucero del alba",
      "summary": "Marcial cuerpo a cuerpo del Manual del Jugador 2024.",
      "tags": [
        "Equipo",
        "Marcial cuerpo a cuerpo"
      ],
      "sourcePage": 215,
      "category": "Marcial cuerpo a cuerpo",
      "cost": "15 po",
      "weight": "2 kg",
      "properties": [
        "1d8 perforante",
        "Debilitar"
      ],
      "description": "Lucero del alba"
    },
    {
      "id": "mangual",
      "name": "Mangual",
      "summary": "Marcial cuerpo a cuerpo del Manual del Jugador 2024.",
      "tags": [
        "Equipo",
        "Marcial cuerpo a cuerpo"
      ],
      "sourcePage": 215,
      "category": "Marcial cuerpo a cuerpo",
      "cost": "10 po",
      "weight": "1 kg",
      "properties": [
        "1d8 contundente",
        "Debilitar"
      ],
      "description": "Mangual"
    },
    {
      "id": "martillo-de-guerra",
      "name": "Martillo de guerra",
      "summary": "Marcial cuerpo a cuerpo del Manual del Jugador 2024.",
      "tags": [
        "Equipo",
        "Marcial cuerpo a cuerpo"
      ],
      "sourcePage": 215,
      "category": "Marcial cuerpo a cuerpo",
      "cost": "15 po",
      "weight": "2,5 kg",
      "properties": [
        "1d8 contundente",
        "Versatil (1d10)"
      ],
      "description": "Martillo de guerra"
    },
    {
      "id": "maza-a-dos-manos",
      "name": "Maza a dos manos",
      "summary": "Marcial cuerpo a cuerpo del Manual del Jugador 2024.",
      "tags": [
        "Equipo",
        "Marcial cuerpo a cuerpo"
      ],
      "sourcePage": 215,
      "category": "Marcial cuerpo a cuerpo",
      "cost": "10 po",
      "weight": "5 kg",
      "properties": [
        "2d6 contundente",
        "Pesada, a dos manos"
      ],
      "description": "Maza a dos manos"
    },
    {
      "id": "pica",
      "name": "Pica",
      "summary": "Marcial cuerpo a cuerpo del Manual del Jugador 2024.",
      "tags": [
        "Equipo",
        "Marcial cuerpo a cuerpo"
      ],
      "sourcePage": 215,
      "category": "Marcial cuerpo a cuerpo",
      "cost": "5 po",
      "weight": "9 kg",
      "properties": [
        "1d10 perforante",
        "Pesada, gran alcance, a dos manos"
      ],
      "description": "Pica"
    },
    {
      "id": "pico-de-guerra",
      "name": "Pico de guerra",
      "summary": "Marcial cuerpo a cuerpo del Manual del Jugador 2024.",
      "tags": [
        "Equipo",
        "Marcial cuerpo a cuerpo"
      ],
      "sourcePage": 215,
      "category": "Marcial cuerpo a cuerpo",
      "cost": "5 po",
      "weight": "1 kg",
      "properties": [
        "1d8 perforante",
        "Debilitar"
      ],
      "description": "Pico de guerra"
    },
    {
      "id": "tridente",
      "name": "Tridente",
      "summary": "Marcial cuerpo a cuerpo del Manual del Jugador 2024.",
      "tags": [
        "Equipo",
        "Marcial cuerpo a cuerpo"
      ],
      "sourcePage": 215,
      "category": "Marcial cuerpo a cuerpo",
      "cost": "5 po",
      "weight": "2 kg",
      "properties": [
        "1d8 perforante",
        "Arrojadizo, versatil (1d10)"
      ],
      "description": "Tridente"
    },
    {
      "id": "arco-largo",
      "name": "Arco largo",
      "summary": "Marcial a distancia del Manual del Jugador 2024.",
      "tags": [
        "Equipo",
        "Marcial a distancia"
      ],
      "sourcePage": 215,
      "category": "Marcial a distancia",
      "cost": "50 po",
      "weight": "1 kg",
      "properties": [
        "1d8 perforante",
        "Municion, pesada, a dos manos"
      ],
      "description": "Arco largo"
    },
    {
      "id": "ballesta-de-mano",
      "name": "Ballesta de mano",
      "summary": "Marcial a distancia del Manual del Jugador 2024.",
      "tags": [
        "Equipo",
        "Marcial a distancia"
      ],
      "sourcePage": 215,
      "category": "Marcial a distancia",
      "cost": "75 po",
      "weight": "1,5 kg",
      "properties": [
        "1d6 perforante",
        "Ligera, municion, recarga"
      ],
      "description": "Ballesta de mano"
    },
    {
      "id": "ballesta-pesada",
      "name": "Ballesta pesada",
      "summary": "Marcial a distancia del Manual del Jugador 2024.",
      "tags": [
        "Equipo",
        "Marcial a distancia"
      ],
      "sourcePage": 215,
      "category": "Marcial a distancia",
      "cost": "50 po",
      "weight": "9 kg",
      "properties": [
        "1d10 perforante",
        "Municion, pesada, recarga, a dos manos"
      ],
      "description": "Ballesta pesada"
    },
    {
      "id": "cerbatana",
      "name": "Cerbatana",
      "summary": "Marcial a distancia del Manual del Jugador 2024.",
      "tags": [
        "Equipo",
        "Marcial a distancia"
      ],
      "sourcePage": 215,
      "category": "Marcial a distancia",
      "cost": "10 po",
      "weight": "0,5 kg",
      "properties": [
        "1 perforante",
        "Municion, recarga"
      ],
      "description": "Cerbatana"
    },
    {
      "id": "mosquete",
      "name": "Mosquete",
      "summary": "Marcial a distancia del Manual del Jugador 2024.",
      "tags": [
        "Equipo",
        "Marcial a distancia"
      ],
      "sourcePage": 215,
      "category": "Marcial a distancia",
      "cost": "500 po",
      "weight": "5 kg",
      "properties": [
        "1d12 perforante",
        "Municion, recarga, a dos manos"
      ],
      "description": "Mosquete"
    },
    {
      "id": "pistola",
      "name": "Pistola",
      "summary": "Marcial a distancia del Manual del Jugador 2024.",
      "tags": [
        "Equipo",
        "Marcial a distancia"
      ],
      "sourcePage": 215,
      "category": "Marcial a distancia",
      "cost": "250 po",
      "weight": "1,5 kg",
      "properties": [
        "1d10 perforante",
        "Municion, recarga"
      ],
      "description": "Pistola"
    },
    {
      "id": "armadura-acolchada",
      "name": "Armadura acolchada",
      "summary": "Armadura ligera del Manual del Jugador 2024.",
      "tags": [
        "Equipo",
        "Armadura ligera"
      ],
      "sourcePage": 215,
      "category": "Armadura ligera",
      "cost": "5 po",
      "weight": "4 kg",
      "properties": [
        "CA 11 + Des",
        "Desventaja en Sigilo"
      ],
      "description": "Armadura acolchada"
    },
    {
      "id": "armadura-de-cuero",
      "name": "Armadura de cuero",
      "summary": "Armadura ligera del Manual del Jugador 2024.",
      "tags": [
        "Equipo",
        "Armadura ligera"
      ],
      "sourcePage": 215,
      "category": "Armadura ligera",
      "cost": "10 po",
      "weight": "5 kg",
      "properties": [
        "CA 11 + Des"
      ],
      "description": "Armadura de cuero"
    },
    {
      "id": "armadura-de-cuero-tachonado",
      "name": "Armadura de cuero tachonado",
      "summary": "Armadura ligera del Manual del Jugador 2024.",
      "tags": [
        "Equipo",
        "Armadura ligera"
      ],
      "sourcePage": 215,
      "category": "Armadura ligera",
      "cost": "45 po",
      "weight": "6,5 kg",
      "properties": [
        "CA 12 + Des"
      ],
      "description": "Armadura de cuero tachonado"
    },
    {
      "id": "armadura-de-pieles",
      "name": "Armadura de pieles",
      "summary": "Armadura media del Manual del Jugador 2024.",
      "tags": [
        "Equipo",
        "Armadura media"
      ],
      "sourcePage": 215,
      "category": "Armadura media",
      "cost": "10 po",
      "weight": "6 kg",
      "properties": [
        "CA 12 + Des (max. 2)"
      ],
      "description": "Armadura de pieles"
    },
    {
      "id": "camisa-de-malla",
      "name": "Camisa de malla",
      "summary": "Armadura media del Manual del Jugador 2024.",
      "tags": [
        "Equipo",
        "Armadura media"
      ],
      "sourcePage": 215,
      "category": "Armadura media",
      "cost": "50 po",
      "weight": "10 kg",
      "properties": [
        "CA 13 + Des (max. 2)"
      ],
      "description": "Camisa de malla"
    },
    {
      "id": "cota-de-escamas",
      "name": "Cota de escamas",
      "summary": "Armadura media del Manual del Jugador 2024.",
      "tags": [
        "Equipo",
        "Armadura media"
      ],
      "sourcePage": 215,
      "category": "Armadura media",
      "cost": "50 po",
      "weight": "22,5 kg",
      "properties": [
        "CA 14 + Des (max. 2)",
        "Desventaja en Sigilo"
      ],
      "description": "Cota de escamas"
    },
    {
      "id": "coraza",
      "name": "Coraza",
      "summary": "Armadura media del Manual del Jugador 2024.",
      "tags": [
        "Equipo",
        "Armadura media"
      ],
      "sourcePage": 215,
      "category": "Armadura media",
      "cost": "400 po",
      "weight": "10 kg",
      "properties": [
        "CA 14 + Des (max. 2)"
      ],
      "description": "Coraza"
    },
    {
      "id": "media-armadura",
      "name": "Media armadura",
      "summary": "Armadura media del Manual del Jugador 2024.",
      "tags": [
        "Equipo",
        "Armadura media"
      ],
      "sourcePage": 215,
      "category": "Armadura media",
      "cost": "750 po",
      "weight": "20 kg",
      "properties": [
        "CA 15 + Des (max. 2)",
        "Desventaja en Sigilo"
      ],
      "description": "Media armadura"
    },
    {
      "id": "cota-guarnecida",
      "name": "Cota guarnecida",
      "summary": "Armadura pesada del Manual del Jugador 2024.",
      "tags": [
        "Equipo",
        "Armadura pesada"
      ],
      "sourcePage": 215,
      "category": "Armadura pesada",
      "cost": "30 po",
      "weight": "20 kg",
      "properties": [
        "CA 14",
        "Desventaja en Sigilo"
      ],
      "description": "Cota guarnecida"
    },
    {
      "id": "cota-de-malla",
      "name": "Cota de malla",
      "summary": "Armadura pesada del Manual del Jugador 2024.",
      "tags": [
        "Equipo",
        "Armadura pesada"
      ],
      "sourcePage": 215,
      "category": "Armadura pesada",
      "cost": "75 po",
      "weight": "27,5 kg",
      "properties": [
        "CA 16",
        "Fue 13; desventaja en Sigilo"
      ],
      "description": "Cota de malla"
    },
    {
      "id": "armadura-de-bandas",
      "name": "Armadura de bandas",
      "summary": "Armadura pesada del Manual del Jugador 2024.",
      "tags": [
        "Equipo",
        "Armadura pesada"
      ],
      "sourcePage": 215,
      "category": "Armadura pesada",
      "cost": "200 po",
      "weight": "30 kg",
      "properties": [
        "CA 17",
        "Fue 15; desventaja en Sigilo"
      ],
      "description": "Armadura de bandas"
    },
    {
      "id": "armadura-de-placas",
      "name": "Armadura de placas",
      "summary": "Armadura pesada del Manual del Jugador 2024.",
      "tags": [
        "Equipo",
        "Armadura pesada"
      ],
      "sourcePage": 215,
      "category": "Armadura pesada",
      "cost": "1500 po",
      "weight": "32,5 kg",
      "properties": [
        "CA 18",
        "Fue 15; desventaja en Sigilo"
      ],
      "description": "Armadura de placas"
    },
    {
      "id": "escudo",
      "name": "Escudo",
      "summary": "Escudo del Manual del Jugador 2024.",
      "tags": [
        "Equipo",
        "Escudo"
      ],
      "sourcePage": 219,
      "category": "Escudo",
      "cost": "10 po",
      "weight": "3 kg",
      "properties": [
        "+2 a la CA",
        "Requiere entrenamiento con escudos"
      ],
      "description": "Escudo"
    },
    {
      "id": "abrojos",
      "name": "Abrojos",
      "summary": "Equipo de aventura del Manual del Jugador 2024.",
      "tags": [
        "Equipo",
        "Equipo de aventura"
      ],
      "sourcePage": 224,
      "category": "Equipo de aventura",
      "cost": "1 po",
      "weight": "1 kg",
      "properties": [
        "Controlan una casilla y pueden reducir el movimiento"
      ],
      "description": "Abrojos"
    },
    {
      "id": "antorcha",
      "name": "Antorcha",
      "summary": "Equipo de aventura del Manual del Jugador 2024.",
      "tags": [
        "Equipo",
        "Equipo de aventura"
      ],
      "sourcePage": 224,
      "category": "Equipo de aventura",
      "cost": "1 pc",
      "weight": "0,5 kg",
      "properties": [
        "Ilumina y puede usarse como arma improvisada"
      ],
      "description": "Antorcha"
    },
    {
      "id": "cuerda",
      "name": "Cuerda",
      "summary": "Equipo de aventura del Manual del Jugador 2024.",
      "tags": [
        "Equipo",
        "Equipo de aventura"
      ],
      "sourcePage": 224,
      "category": "Equipo de aventura",
      "cost": "1 po",
      "weight": "5 kg",
      "properties": [
        "15 m de cuerda"
      ],
      "description": "Cuerda"
    },
    {
      "id": "mochila",
      "name": "Mochila",
      "summary": "Equipo de aventura del Manual del Jugador 2024.",
      "tags": [
        "Equipo",
        "Equipo de aventura"
      ],
      "sourcePage": 224,
      "category": "Equipo de aventura",
      "cost": "2 po",
      "weight": "2,5 kg",
      "properties": [
        "Contenedor para provisiones"
      ],
      "description": "Mochila"
    },
    {
      "id": "petate",
      "name": "Petate",
      "summary": "Equipo de aventura del Manual del Jugador 2024.",
      "tags": [
        "Equipo",
        "Equipo de aventura"
      ],
      "sourcePage": 224,
      "category": "Equipo de aventura",
      "cost": "1 po",
      "weight": "3,5 kg",
      "properties": [
        "Equipo para descansar durante un viaje"
      ],
      "description": "Petate"
    },
    {
      "id": "raciones",
      "name": "Raciones",
      "summary": "Equipo de aventura del Manual del Jugador 2024.",
      "tags": [
        "Equipo",
        "Equipo de aventura"
      ],
      "sourcePage": 224,
      "category": "Equipo de aventura",
      "cost": "5 pp",
      "weight": "1 kg",
      "properties": [
        "Alimento para un dia"
      ],
      "description": "Raciones"
    },
    {
      "id": "tienda",
      "name": "Tienda",
      "summary": "Equipo de aventura del Manual del Jugador 2024.",
      "tags": [
        "Equipo",
        "Equipo de aventura"
      ],
      "sourcePage": 224,
      "category": "Equipo de aventura",
      "cost": "2 po",
      "weight": "10 kg",
      "properties": [
        "Refugio para dos criaturas"
      ],
      "description": "Tienda"
    },
    {
      "id": "yesca",
      "name": "Yesca",
      "summary": "Equipo de aventura del Manual del Jugador 2024.",
      "tags": [
        "Equipo",
        "Equipo de aventura"
      ],
      "sourcePage": 224,
      "category": "Equipo de aventura",
      "cost": "5 pp",
      "weight": "0,5 kg",
      "properties": [
        "Permite encender fuego"
      ],
      "description": "Yesca"
    },
    {
      "id": "cantimplora",
      "name": "Cantimplora",
      "summary": "Equipo de aventura del Manual del Jugador 2024.",
      "tags": [
        "Equipo",
        "Equipo de aventura"
      ],
      "sourcePage": 224,
      "category": "Equipo de aventura",
      "cost": "2 pp",
      "weight": "2,5 kg",
      "properties": [
        "Transporta agua"
      ],
      "description": "Cantimplora"
    },
    {
      "id": "garfio-de-escalada",
      "name": "Garfio de escalada",
      "summary": "Equipo de aventura del Manual del Jugador 2024.",
      "tags": [
        "Equipo",
        "Equipo de aventura"
      ],
      "sourcePage": 224,
      "category": "Equipo de aventura",
      "cost": "2 po",
      "weight": "2 kg",
      "properties": [
        "Ayuda a fijar una cuerda"
      ],
      "description": "Garfio de escalada"
    },
    {
      "id": "palanca",
      "name": "Palanca",
      "summary": "Equipo de aventura del Manual del Jugador 2024.",
      "tags": [
        "Equipo",
        "Equipo de aventura"
      ],
      "sourcePage": 224,
      "category": "Equipo de aventura",
      "cost": "2 po",
      "weight": "2,5 kg",
      "properties": [
        "Ayuda a forzar objetos"
      ],
      "description": "Palanca"
    },
    {
      "id": "linterna",
      "name": "Linterna",
      "summary": "Equipo de aventura del Manual del Jugador 2024.",
      "tags": [
        "Equipo",
        "Equipo de aventura"
      ],
      "sourcePage": 224,
      "category": "Equipo de aventura",
      "cost": "5 po",
      "weight": "1 kg",
      "properties": [
        "Proporciona iluminacion dirigida"
      ],
      "description": "Linterna"
    },
    {
      "id": "aceite",
      "name": "Aceite",
      "summary": "Equipo de aventura del Manual del Jugador 2024.",
      "tags": [
        "Equipo",
        "Equipo de aventura"
      ],
      "sourcePage": 224,
      "category": "Equipo de aventura",
      "cost": "1 pp",
      "weight": "0,5 kg",
      "properties": [
        "Combustible inflamable"
      ],
      "description": "Aceite"
    },
    {
      "id": "esposas",
      "name": "Esposas",
      "summary": "Equipo de aventura del Manual del Jugador 2024.",
      "tags": [
        "Equipo",
        "Equipo de aventura"
      ],
      "sourcePage": 224,
      "category": "Equipo de aventura",
      "cost": "2 po",
      "weight": "3 kg",
      "properties": [
        "Restringen a una criatura Pequeña o Mediana"
      ],
      "description": "Esposas"
    },
    {
      "id": "utiles-de-sanador",
      "name": "Útiles de sanador",
      "summary": "Equipo de aventura del Manual del Jugador 2024.",
      "tags": [
        "Equipo",
        "Equipo de aventura"
      ],
      "sourcePage": 224,
      "category": "Equipo de aventura",
      "cost": "5 po",
      "weight": "1,5 kg",
      "properties": [
        "Diez usos para estabilizar o aplicar la dote Sanador"
      ],
      "description": "Útiles de sanador"
    },
    {
      "id": "agua-bendita",
      "name": "Agua bendita",
      "summary": "Equipo de aventura del Manual del Jugador 2024.",
      "tags": [
        "Equipo",
        "Equipo de aventura"
      ],
      "sourcePage": 224,
      "category": "Equipo de aventura",
      "cost": "25 po",
      "weight": "0,5 kg",
      "properties": [
        "Daña a ciertos infernales y muertos vivientes"
      ],
      "description": "Agua bendita"
    },
    {
      "id": "simbolo-sagrado",
      "name": "Símbolo sagrado",
      "summary": "Canalizador mágico del Manual del Jugador 2024.",
      "tags": [
        "Equipo",
        "Canalizador mágico"
      ],
      "sourcePage": 224,
      "category": "Canalizador mágico",
      "cost": "5 po",
      "weight": "0,5 kg",
      "properties": [
        "Canalizador para conjuros divinos"
      ],
      "description": "Símbolo sagrado"
    },
    {
      "id": "foco-arcano",
      "name": "Foco arcano",
      "summary": "Canalizador mágico del Manual del Jugador 2024.",
      "tags": [
        "Equipo",
        "Canalizador mágico"
      ],
      "sourcePage": 224,
      "category": "Canalizador mágico",
      "cost": "10 po",
      "weight": "0,5 kg",
      "properties": [
        "Canalizador para conjuros arcanos"
      ],
      "description": "Foco arcano"
    },
    {
      "id": "foco-druidico",
      "name": "Foco druídico",
      "summary": "Canalizador mágico del Manual del Jugador 2024.",
      "tags": [
        "Equipo",
        "Canalizador mágico"
      ],
      "sourcePage": 224,
      "category": "Canalizador mágico",
      "cost": "5 po",
      "weight": "0,5 kg",
      "properties": [
        "Canalizador para conjuros primigenios"
      ],
      "description": "Foco druídico"
    },
    {
      "id": "libro-de-conjuros",
      "name": "Libro de conjuros",
      "summary": "Equipo de aventura del Manual del Jugador 2024.",
      "tags": [
        "Equipo",
        "Equipo de aventura"
      ],
      "sourcePage": 224,
      "category": "Equipo de aventura",
      "cost": "50 po",
      "weight": "1,5 kg",
      "properties": [
        "Contiene los conjuros de un mago"
      ],
      "description": "Libro de conjuros"
    },
    {
      "id": "saquito-de-componentes",
      "name": "Saquito de componentes",
      "summary": "Canalizador mágico del Manual del Jugador 2024.",
      "tags": [
        "Equipo",
        "Canalizador mágico"
      ],
      "sourcePage": 224,
      "category": "Canalizador mágico",
      "cost": "25 po",
      "weight": "1 kg",
      "properties": [
        "Sustituye componentes materiales sin coste indicado"
      ],
      "description": "Saquito de componentes"
    },
    {
      "id": "mapa",
      "name": "Mapa",
      "summary": "Equipo de aventura del Manual del Jugador 2024.",
      "tags": [
        "Equipo",
        "Equipo de aventura"
      ],
      "sourcePage": 224,
      "category": "Equipo de aventura",
      "cost": "1 po",
      "properties": [
        "Representacion de una zona o ruta"
      ],
      "description": "Mapa"
    },
    {
      "id": "papel",
      "name": "Papel",
      "summary": "Equipo de aventura del Manual del Jugador 2024.",
      "tags": [
        "Equipo",
        "Equipo de aventura"
      ],
      "sourcePage": 224,
      "category": "Equipo de aventura",
      "cost": "2 pp",
      "properties": [
        "Hoja para notas y documentos"
      ],
      "description": "Papel"
    },
    {
      "id": "tinta",
      "name": "Tinta",
      "summary": "Equipo de aventura del Manual del Jugador 2024.",
      "tags": [
        "Equipo",
        "Equipo de aventura"
      ],
      "sourcePage": 224,
      "category": "Equipo de aventura",
      "cost": "10 po",
      "properties": [
        "Frasco para escritura"
      ],
      "description": "Tinta"
    },
    {
      "id": "campana",
      "name": "Campana",
      "summary": "Equipo de aventura del Manual del Jugador 2024.",
      "tags": [
        "Equipo",
        "Equipo de aventura"
      ],
      "sourcePage": 224,
      "category": "Equipo de aventura",
      "cost": "1 po",
      "properties": [
        "Produce una señal audible"
      ],
      "description": "Campana"
    },
    {
      "id": "herramientas-de-ladron",
      "name": "Herramientas de ladrón",
      "summary": "Herramienta del Manual del Jugador 2024.",
      "tags": [
        "Equipo",
        "Herramienta"
      ],
      "sourcePage": 220,
      "category": "Herramienta",
      "cost": "25 po",
      "weight": "0,5 kg",
      "properties": [
        "Abrir cerraduras y desactivar trampas"
      ],
      "description": "Herramientas de ladrón"
    },
    {
      "id": "kit-de-disfraz",
      "name": "Kit de disfraz",
      "summary": "Herramienta del Manual del Jugador 2024.",
      "tags": [
        "Equipo",
        "Herramienta"
      ],
      "sourcePage": 220,
      "category": "Herramienta",
      "cost": "25 po",
      "weight": "1,5 kg",
      "properties": [
        "Crear o aplicar un disfraz"
      ],
      "description": "Kit de disfraz"
    },
    {
      "id": "kit-de-falsificacion",
      "name": "Kit de falsificación",
      "summary": "Herramienta del Manual del Jugador 2024.",
      "tags": [
        "Equipo",
        "Herramienta"
      ],
      "sourcePage": 220,
      "category": "Herramienta",
      "cost": "15 po",
      "weight": "2,5 kg",
      "properties": [
        "Imitar documentos y sellos"
      ],
      "description": "Kit de falsificación"
    },
    {
      "id": "kit-de-herboristeria",
      "name": "Kit de herboristería",
      "summary": "Herramienta del Manual del Jugador 2024.",
      "tags": [
        "Equipo",
        "Herramienta"
      ],
      "sourcePage": 220,
      "category": "Herramienta",
      "cost": "5 po",
      "weight": "1,5 kg",
      "properties": [
        "Identificar y preparar plantas"
      ],
      "description": "Kit de herboristería"
    },
    {
      "id": "kit-de-venenos",
      "name": "Kit de venenos",
      "summary": "Herramienta del Manual del Jugador 2024.",
      "tags": [
        "Equipo",
        "Herramienta"
      ],
      "sourcePage": 220,
      "category": "Herramienta",
      "cost": "50 po",
      "weight": "1 kg",
      "properties": [
        "Crear y manipular venenos"
      ],
      "description": "Kit de venenos"
    },
    {
      "id": "herramientas-de-herrero",
      "name": "Herramientas de herrero",
      "summary": "Herramienta de artesano del Manual del Jugador 2024.",
      "tags": [
        "Equipo",
        "Herramienta de artesano"
      ],
      "sourcePage": 220,
      "category": "Herramienta de artesano",
      "cost": "20 po",
      "weight": "4 kg",
      "properties": [
        "Trabajar y reparar metal"
      ],
      "description": "Herramientas de herrero"
    },
    {
      "id": "herramientas-de-carpintero",
      "name": "Herramientas de carpintero",
      "summary": "Herramienta de artesano del Manual del Jugador 2024.",
      "tags": [
        "Equipo",
        "Herramienta de artesano"
      ],
      "sourcePage": 220,
      "category": "Herramienta de artesano",
      "cost": "8 po",
      "weight": "3 kg",
      "properties": [
        "Construir y reparar objetos de madera"
      ],
      "description": "Herramientas de carpintero"
    },
    {
      "id": "herramientas-de-cartografo",
      "name": "Herramientas de cartógrafo",
      "summary": "Herramienta de artesano del Manual del Jugador 2024.",
      "tags": [
        "Equipo",
        "Herramienta de artesano"
      ],
      "sourcePage": 220,
      "category": "Herramienta de artesano",
      "cost": "15 po",
      "weight": "3 kg",
      "properties": [
        "Crear y estudiar mapas"
      ],
      "description": "Herramientas de cartógrafo"
    },
    {
      "id": "instrumento-musical",
      "name": "Instrumento musical",
      "summary": "Instrumento del Manual del Jugador 2024.",
      "tags": [
        "Equipo",
        "Instrumento"
      ],
      "sourcePage": 220,
      "category": "Instrumento",
      "cost": "Variable",
      "properties": [
        "Interpretar musica"
      ],
      "description": "Instrumento musical"
    },
    {
      "id": "utiles-de-navegante",
      "name": "Útiles de navegante",
      "summary": "Herramienta del Manual del Jugador 2024.",
      "tags": [
        "Equipo",
        "Herramienta"
      ],
      "sourcePage": 220,
      "category": "Herramienta",
      "cost": "25 po",
      "weight": "1 kg",
      "properties": [
        "Orientarse y trazar rutas"
      ],
      "description": "Útiles de navegante"
    }
  ],
  "classes": [
    {
      "id": "barbaro",
      "name": "Bárbaro",
      "primaryAbility": "Fuerza",
      "hitDie": "d12",
      "summary": "Combatiente primigenio que convierte su furia en resistencia, movilidad y fuerza devastadora.",
      "sourcePage": 51,
      "features": [
        {
          "id": "1-defensa-sin-armadura",
          "name": "Defensa sin armadura",
          "level": 1,
          "description": "Defensa sin armadura",
          "sourcePage": 51
        },
        {
          "id": "1-furia",
          "name": "Furia",
          "level": 1,
          "description": "Furia",
          "sourcePage": 51
        },
        {
          "id": "1-maestria-con-armas",
          "name": "Maestría con armas",
          "level": 1,
          "description": "Maestría con armas",
          "sourcePage": 51
        },
        {
          "id": "3-conocimiento-primigenio",
          "name": "Conocimiento primigenio",
          "level": 3,
          "description": "Conocimiento primigenio",
          "sourcePage": 52
        },
        {
          "id": "3-subclase-de-barbaro",
          "name": "Subclase de bárbaro",
          "level": 3,
          "description": "Subclase de bárbaro",
          "sourcePage": 52
        },
        {
          "id": "5-ataque-adicional",
          "name": "Ataque adicional",
          "level": 5,
          "description": "Ataque adicional",
          "sourcePage": 52
        },
        {
          "id": "5-movimiento-rapido",
          "name": "Movimiento rápido",
          "level": 5,
          "description": "Movimiento rápido",
          "sourcePage": 52
        }
      ]
    },
    {
      "id": "bardo",
      "name": "Bardo",
      "primaryAbility": "Carisma",
      "hitDie": "d8",
      "summary": "Artista mágico que inspira a sus aliados y domina conjuros, habilidades y secretos de otras tradiciones.",
      "sourcePage": 59,
      "features": [
        {
          "id": "1-inspiracion-bardica",
          "name": "Inspiración bárdica",
          "level": 1,
          "description": "Inspiración bárdica",
          "sourcePage": 59
        },
        {
          "id": "1-lanzamiento-de-conjuros",
          "name": "Lanzamiento de conjuros",
          "level": 1,
          "description": "Lanzamiento de conjuros",
          "sourcePage": 59
        },
        {
          "id": "3-subclase-de-bardo",
          "name": "Subclase de bardo",
          "level": 3,
          "description": "Subclase de bardo",
          "sourcePage": 60
        },
        {
          "id": "5-fuente-de-inspiracion",
          "name": "Fuente de inspiración",
          "level": 5,
          "description": "Fuente de inspiración",
          "sourcePage": 61
        }
      ]
    },
    {
      "id": "brujo",
      "name": "Brujo",
      "primaryAbility": "Carisma",
      "hitDie": "d8",
      "summary": "Portador de magia pactada que combina invocaciones sobrenaturales con espacios de conjuro recuperables.",
      "sourcePage": 69,
      "features": [
        {
          "id": "1-invocaciones-sobrenaturales",
          "name": "Invocaciones sobrenaturales",
          "level": 1,
          "description": "Invocaciones sobrenaturales",
          "sourcePage": 69
        },
        {
          "id": "1-magia-del-pacto",
          "name": "Magia del pacto",
          "level": 1,
          "description": "Magia del pacto",
          "sourcePage": 69
        },
        {
          "id": "3-subclase-de-brujo",
          "name": "Subclase de brujo",
          "level": 3,
          "description": "Subclase de brujo",
          "sourcePage": 70
        }
      ]
    },
    {
      "id": "clerigo",
      "name": "Clérigo",
      "primaryAbility": "Sabiduría",
      "hitDie": "d8",
      "summary": "Canalizador de poder divino capaz de sanar, proteger y expulsar a los muertos vivientes.",
      "sourcePage": 81,
      "features": [
        {
          "id": "1-lanzamiento-de-conjuros",
          "name": "Lanzamiento de conjuros",
          "level": 1,
          "description": "Lanzamiento de conjuros",
          "sourcePage": 81
        },
        {
          "id": "1-orden-divina",
          "name": "Orden divina",
          "level": 1,
          "description": "Orden divina",
          "sourcePage": 82
        },
        {
          "id": "3-subclase-de-clerigo",
          "name": "Subclase de clérigo",
          "level": 3,
          "description": "Subclase de clérigo",
          "sourcePage": 83
        },
        {
          "id": "5-abrasar-muertos-vivientes",
          "name": "Abrasar muertos vivientes",
          "level": 5,
          "description": "Abrasar muertos vivientes",
          "sourcePage": 83
        }
      ]
    },
    {
      "id": "druida",
      "name": "Druida",
      "primaryAbility": "Sabiduría",
      "hitDie": "d8",
      "summary": "Guardián de la naturaleza que emplea magia primigenia y adopta formas salvajes.",
      "sourcePage": 91,
      "features": [
        {
          "id": "1-druidico",
          "name": "Druídico",
          "level": 1,
          "description": "Druídico",
          "sourcePage": 92
        },
        {
          "id": "1-lanzamiento-de-conjuros",
          "name": "Lanzamiento de conjuros",
          "level": 1,
          "description": "Lanzamiento de conjuros",
          "sourcePage": 91
        },
        {
          "id": "1-orden-primigenia",
          "name": "Orden primigenia",
          "level": 1,
          "description": "Orden primigenia",
          "sourcePage": 92
        },
        {
          "id": "3-subclase-de-druida",
          "name": "Subclase de druida",
          "level": 3,
          "description": "Subclase de druida",
          "sourcePage": 93
        },
        {
          "id": "5-resurgimiento-salvaje",
          "name": "Resurgimiento salvaje",
          "level": 5,
          "description": "Resurgimiento salvaje",
          "sourcePage": 93
        }
      ]
    },
    {
      "id": "explorador",
      "name": "Explorador",
      "primaryAbility": "Destreza y Sabiduría",
      "hitDie": "d10",
      "summary": "Cazador y superviviente que une destreza marcial, rastreo y magia de la naturaleza.",
      "sourcePage": 103,
      "features": [
        {
          "id": "1-enemigo-predilecto",
          "name": "Enemigo predilecto",
          "level": 1,
          "description": "Enemigo predilecto",
          "sourcePage": 103
        },
        {
          "id": "1-lanzamiento-de-conjuros",
          "name": "Lanzamiento de conjuros",
          "level": 1,
          "description": "Lanzamiento de conjuros",
          "sourcePage": 103
        },
        {
          "id": "1-maestria-con-armas",
          "name": "Maestría con armas",
          "level": 1,
          "description": "Maestría con armas",
          "sourcePage": 104
        },
        {
          "id": "3-subclase-de-explorador",
          "name": "Subclase de explorador",
          "level": 3,
          "description": "Subclase de explorador",
          "sourcePage": 104
        },
        {
          "id": "5-ataque-adicional",
          "name": "Ataque adicional",
          "level": 5,
          "description": "Ataque adicional",
          "sourcePage": 104
        }
      ]
    },
    {
      "id": "guerrero",
      "name": "Guerrero",
      "primaryAbility": "Fuerza o Destreza",
      "hitDie": "d10",
      "summary": "Especialista marcial versátil con gran dominio de armas, tácticas y ataques sucesivos.",
      "sourcePage": 113,
      "features": [
        {
          "id": "1-estilo-de-combate",
          "name": "Estilo de combate",
          "level": 1,
          "description": "Estilo de combate",
          "sourcePage": 113
        },
        {
          "id": "1-maestria-con-armas",
          "name": "Maestría con armas",
          "level": 1,
          "description": "Maestría con armas",
          "sourcePage": 113
        },
        {
          "id": "1-tomar-aliento",
          "name": "Tomar aliento",
          "level": 1,
          "description": "Tomar aliento",
          "sourcePage": 113
        },
        {
          "id": "3-subclase-de-guerrero",
          "name": "Subclase de guerrero",
          "level": 3,
          "description": "Subclase de guerrero",
          "sourcePage": 114
        },
        {
          "id": "5-ataque-adicional",
          "name": "Ataque adicional",
          "level": 5,
          "description": "Ataque adicional",
          "sourcePage": 114
        },
        {
          "id": "5-desplazamiento-tactico",
          "name": "Desplazamiento táctico",
          "level": 5,
          "description": "Desplazamiento táctico",
          "sourcePage": 114
        }
      ]
    },
    {
      "id": "hechicero",
      "name": "Hechicero",
      "primaryAbility": "Carisma",
      "hitDie": "d6",
      "summary": "Lanzador cuya magia innata puede transformarse mediante puntos de hechicería y metamagia.",
      "sourcePage": 123,
      "features": [
        {
          "id": "1-hechiceria-innata",
          "name": "Hechicería innata",
          "level": 1,
          "description": "Hechicería innata",
          "sourcePage": 124
        },
        {
          "id": "1-lanzamiento-de-conjuros",
          "name": "Lanzamiento de conjuros",
          "level": 1,
          "description": "Lanzamiento de conjuros",
          "sourcePage": 123
        },
        {
          "id": "3-subclase-de-hechicero",
          "name": "Subclase de hechicero",
          "level": 3,
          "description": "Subclase de hechicero",
          "sourcePage": 125
        },
        {
          "id": "5-recuperacion-magica",
          "name": "Recuperación mágica",
          "level": 5,
          "description": "Recuperación mágica",
          "sourcePage": 125
        }
      ]
    },
    {
      "id": "mago",
      "name": "Mago",
      "primaryAbility": "Inteligencia",
      "hitDie": "d6",
      "summary": "Erudito de la magia arcana con un amplio libro de conjuros y una preparación flexible.",
      "sourcePage": 137,
      "features": [
        {
          "id": "1-adepto-en-rituales",
          "name": "Adepto en rituales",
          "level": 1,
          "description": "Adepto en rituales",
          "sourcePage": 138
        },
        {
          "id": "1-lanzamiento-de-conjuros",
          "name": "Lanzamiento de conjuros",
          "level": 1,
          "description": "Lanzamiento de conjuros",
          "sourcePage": 137
        },
        {
          "id": "1-recuperacion-arcana",
          "name": "Recuperación arcana",
          "level": 1,
          "description": "Recuperación arcana",
          "sourcePage": 138
        },
        {
          "id": "3-subclase-de-mago",
          "name": "Subclase de mago",
          "level": 3,
          "description": "Subclase de mago",
          "sourcePage": 139
        },
        {
          "id": "5-memorizar-conjuro",
          "name": "Memorizar conjuro",
          "level": 5,
          "description": "Memorizar conjuro",
          "sourcePage": 139
        }
      ]
    },
    {
      "id": "monje",
      "name": "Monje",
      "primaryAbility": "Destreza y Sabiduría",
      "hitDie": "d8",
      "summary": "Artista marcial que concentra su energía para atacar, desplazarse y defenderse de forma extraordinaria.",
      "sourcePage": 149,
      "features": [
        {
          "id": "1-artes-marciales",
          "name": "Artes marciales",
          "level": 1,
          "description": "Artes marciales",
          "sourcePage": 149
        },
        {
          "id": "1-defensa-sin-armadura",
          "name": "Defensa sin armadura",
          "level": 1,
          "description": "Defensa sin armadura",
          "sourcePage": 149
        },
        {
          "id": "3-desviar-ataques",
          "name": "Desviar ataques",
          "level": 3,
          "description": "Desviar ataques",
          "sourcePage": 150
        },
        {
          "id": "3-subclase-de-monje",
          "name": "Subclase de monje",
          "level": 3,
          "description": "Subclase de monje",
          "sourcePage": 151
        },
        {
          "id": "5-ataque-adicional",
          "name": "Ataque adicional",
          "level": 5,
          "description": "Ataque adicional",
          "sourcePage": 151
        },
        {
          "id": "5-golpe-aturdidor",
          "name": "Golpe aturdidor",
          "level": 5,
          "description": "Golpe aturdidor",
          "sourcePage": 151
        }
      ]
    },
    {
      "id": "paladin",
      "name": "Paladín",
      "primaryAbility": "Fuerza y Carisma",
      "hitDie": "d10",
      "summary": "Guerrero sagrado que combina armas, auras protectoras, curación y castigos divinos.",
      "sourcePage": 157,
      "features": [
        {
          "id": "1-imponer-las-manos",
          "name": "Imponer las manos",
          "level": 1,
          "description": "Imponer las manos",
          "sourcePage": 157
        },
        {
          "id": "1-lanzamiento-de-conjuros",
          "name": "Lanzamiento de conjuros",
          "level": 1,
          "description": "Lanzamiento de conjuros",
          "sourcePage": 157
        },
        {
          "id": "1-maestria-con-armas",
          "name": "Maestría con armas",
          "level": 1,
          "description": "Maestría con armas",
          "sourcePage": 158
        },
        {
          "id": "3-canalizar-divinidad",
          "name": "Canalizar divinidad",
          "level": 3,
          "description": "Canalizar divinidad",
          "sourcePage": 158
        },
        {
          "id": "3-subclase-de-paladin",
          "name": "Subclase de paladín",
          "level": 3,
          "description": "Subclase de paladín",
          "sourcePage": 159
        },
        {
          "id": "5-ataque-adicional",
          "name": "Ataque adicional",
          "level": 5,
          "description": "Ataque adicional",
          "sourcePage": 159
        },
        {
          "id": "5-corcel-fiel",
          "name": "Corcel fiel",
          "level": 5,
          "description": "Corcel fiel",
          "sourcePage": 159
        }
      ]
    },
    {
      "id": "picaro",
      "name": "Pícaro",
      "primaryAbility": "Destreza",
      "hitDie": "d8",
      "summary": "Especialista preciso y escurridizo que explota aperturas mediante su ataque furtivo.",
      "sourcePage": 167,
      "features": [
        {
          "id": "1-ataque-furtivo",
          "name": "Ataque furtivo",
          "level": 1,
          "description": "Ataque furtivo",
          "sourcePage": 167
        },
        {
          "id": "1-jerga-de-ladrones",
          "name": "Jerga de ladrones",
          "level": 1,
          "description": "Jerga de ladrones",
          "sourcePage": 167
        },
        {
          "id": "1-maestria-con-armas",
          "name": "Maestría con armas",
          "level": 1,
          "description": "Maestría con armas",
          "sourcePage": 167
        },
        {
          "id": "1-pericia",
          "name": "Pericia",
          "level": 1,
          "description": "Pericia",
          "sourcePage": 167
        },
        {
          "id": "3-punteria-certera",
          "name": "Puntería certera",
          "level": 3,
          "description": "Puntería certera",
          "sourcePage": 168
        },
        {
          "id": "3-subclase-de-picaro",
          "name": "Subclase de pícaro",
          "level": 3,
          "description": "Subclase de pícaro",
          "sourcePage": 168
        },
        {
          "id": "5-esquiva-asombrosa",
          "name": "Esquiva asombrosa",
          "level": 5,
          "description": "Esquiva asombrosa",
          "sourcePage": 168
        },
        {
          "id": "5-golpe-astuto",
          "name": "Golpe astuto",
          "level": 5,
          "description": "Golpe astuto",
          "sourcePage": 168
        }
      ]
    }
  ],
  "creatures": []
};
export function warrior(): CharacterBuild {
    const build = initialBuild(undefined, rules);
    return { ...build, ancestryId: 'enano', backgroundId: 'soldado', classId: 'guerrero', subclass: 'Campeón', level: 5, scoresIncludeBonuses: true, scores: { strength: 16, dexterity: 14, constitution: 14, intelligence: 10, wisdom: 12, charisma: 8 }, classSkills: ['percepcion', 'historia'], equipment: [{ id: 'cota-de-malla', quantity: 1, equipped: true, twoHanded: false }, { id: 'escudo', quantity: 1, equipped: true, twoHanded: false }, { id: 'espada-larga', quantity: 1, equipped: true, twoHanded: false }] };
}
