import { Ability } from '../models/character-build';
export interface CharacterOrigin {
    id: string;
    name: string;
    speed: number;
    traits: string[];
    variants?: {
        id: string;
        name: string;
        traits: string[];
    }[];
}
export interface CharacterBackground {
    id: string;
    name: string;
    abilities: Ability[];
    skills: string[];
    feat: string;
    tools: string;
}
// Mechanical data, 2024 edition. Sources and conversion policy: docs/character-builder.md.
export const CHARACTER_ORIGINS: CharacterOrigin[] = [
    { id: 'humano', name: 'Humano', speed: 9, traits: ['Ingenioso: inspiración heroica tras un descanso largo.', 'Habilidoso: competencia en una habilidad a elegir.', 'Versátil: una dote de origen adicional a elegir.'] },
    { id: 'enano', name: 'Enano', speed: 9, traits: ['Visión en la oscuridad: 36 m.', 'Resistencia enana: resistencia al veneno y ventaja contra envenenamiento.', 'Dureza enana: +1 PG máximo por nivel.', 'Afinidad con la piedra: percepción sísmica de 18 m durante 10 minutos, usos iguales a competencia por descanso largo.'] },
    { id: 'elfo', name: 'Elfo', speed: 9, traits: ['Visión en la oscuridad: 18 m.', 'Ascendencia feérica: ventaja contra hechizado.', 'Sentidos agudos: competencia a elegir entre Perspicacia, Percepción o Supervivencia.', 'Trance: descanso largo en 4 horas; no necesita dormir.'], variants: [
            { id: 'alto', name: 'Alto elfo', traits: ['Linaje alto elfo: un truco de mago a elegir; detectar magia desde nivel 3 y paso brumoso desde nivel 5.'] },
            { id: 'bosque', name: 'Elfo de los bosques', traits: ['Linaje de los bosques: velocidad 10,5 m; saber druídico; zancada prodigiosa desde nivel 3 y pasar sin rastro desde nivel 5.'] },
            { id: 'drow', name: 'Drow', traits: ['Linaje drow: visión en la oscuridad de 36 m; luces danzantes; fuego feérico desde nivel 3 y oscuridad desde nivel 5.'] },
        ] },
    { id: 'gnomo', name: 'Gnomo', speed: 9, traits: ['Visión en la oscuridad: 18 m.', 'Astucia gnoma: ventaja en salvaciones de Inteligencia, Sabiduría y Carisma.'], variants: [
            { id: 'bosque', name: 'Gnomo de los bosques', traits: ['Ilusión menor y hablar con los animales; este último tiene usos gratuitos iguales a competencia por descanso largo.'] },
            { id: 'roca', name: 'Gnomo de las rocas', traits: ['Prestidigitación y reparar; puede crear pequeños mecanismos con prestidigitación.'] },
        ] },
    { id: 'mediano', name: 'Mediano', speed: 9, traits: ['Valiente: ventaja contra asustado.', 'Agilidad mediana: atraviesa espacios de criaturas mayores.', 'Afortunado: repite un 1 en una prueba con d20 y usa el nuevo resultado.', 'Sigilo natural: puede esconderse tras una criatura de mayor tamaño.'] },
    { id: 'orco', name: 'Orco', speed: 9, traits: ['Visión en la oscuridad: 36 m.', 'Subidón de adrenalina: Correr como acción adicional y PG temporales iguales a competencia; usos iguales a competencia por descanso corto o largo.', 'Aguante incansable: queda a 1 PG en lugar de 0 una vez por descanso largo si no muere instantáneamente.'] },
    { id: 'goliat', name: 'Goliat', speed: 10.5, traits: ['Complexión poderosa: ventaja contra apresado y cuenta como una categoría mayor para carga.', 'Forma grande desde nivel 5: acción adicional, duración 10 minutos, ventaja en Fuerza y +3 m de velocidad; una vez por descanso largo.'], variants: [
            { id: 'nubes', name: 'Gigante de las nubes', traits: ['Paseo entre nubes: teletransporte de 9 m como acción adicional. Usos: competencia por descanso largo.'] },
            { id: 'fuego', name: 'Gigante de fuego', traits: ['Quemadura de fuego: +1d10 de fuego al impactar. Usos: competencia por descanso largo.'] },
            { id: 'escarcha', name: 'Gigante de escarcha', traits: ['Frío de escarcha: +1d6 de frío y reduce velocidad 3 m al impactar. Usos: competencia por descanso largo.'] },
            { id: 'colinas', name: 'Gigante de las colinas', traits: ['Tumbo de las colinas: derriba al impactar a una criatura Grande o menor. Usos: competencia por descanso largo.'] },
            { id: 'piedra', name: 'Gigante de piedra', traits: ['Aguante de piedra: reacción para reducir daño en 1d12 + Constitución. Usos: competencia por descanso largo.'] },
            { id: 'tormentas', name: 'Gigante de las tormentas', traits: ['Trueno de las tormentas: reacción para causar 1d8 de trueno a quien te dañe a 18 m. Usos: competencia por descanso largo.'] },
        ] },
    { id: 'draconido', name: 'Dracónido', speed: 9, traits: ['Visión en la oscuridad: 18 m.', 'Resistencia al tipo de daño de la ascendencia.', 'Arma de aliento: sustituye un ataque; CD 8 + CON + competencia, daño 1d10 (2d10 a nivel 5, 3d10 a 11, 4d10 a 17), usos iguales a competencia por descanso largo.', 'Vuelo dracónico desde nivel 5: vuelo igual a velocidad durante 10 minutos, una vez por descanso largo.'], variants: [
            ...['Azul: relámpago', 'Blanco: frío', 'Bronce: relámpago', 'Cobre: ácido', 'Latón: fuego', 'Negro: ácido', 'Oro: fuego', 'Plata: frío', 'Rojo: fuego', 'Verde: veneno'].map((name, i) => ({ id: String(i), name, traits: [`Ascendencia dracónica: ${name}.`] })),
        ] },
    { id: 'tiflin', name: 'Tiflin', speed: 9, traits: ['Visión en la oscuridad: 18 m.', 'Presencia sobrenatural: taumaturgia.'], variants: [
            { id: 'abisal', name: 'Legado abisal', traits: ['Resistencia al veneno; rociada venenosa; rayo nauseabundo desde nivel 3 y inmovilizar persona desde nivel 5.'] },
            { id: 'ctonico', name: 'Legado ctónico', traits: ['Resistencia al daño necrótico; toque helado; falsa vida desde nivel 3 y rayo debilitador desde nivel 5.'] },
            { id: 'infernal', name: 'Legado infernal', traits: ['Resistencia al fuego; descarga de fuego; reprensión infernal desde nivel 3 y oscuridad desde nivel 5.'] },
        ] },
    { id: 'aasimar', name: 'Aasimar', speed: 9, traits: ['Visión en la oscuridad: 18 m.', 'Resistencia celestial: resistencia al daño necrótico y radiante.', 'Manos sanadoras: cura tantos d4 como competencia una vez por descanso largo.', 'Portador de la luz: truco luz.', 'Revelación celestial desde nivel 3: transformación durante 1 minuto como acción adicional, una vez por descanso largo; elige la forma al activarla.'] },
];
const bg = (id: string, name: string, abilities: Ability[], skills: string[], feat: string, tools: string): CharacterBackground => ({ id, name, abilities, skills, feat, tools });
export const CHARACTER_BACKGROUNDS: CharacterBackground[] = [
    bg('acolito', 'Acólito', ['intelligence', 'wisdom', 'charisma'], ['perspicacia', 'religion'], 'iniciado-en-la-magia', 'Útiles de caligrafía; iniciado en la magia de clérigo'),
    bg('artesano', 'Artesano', ['strength', 'dexterity', 'intelligence'], ['investigacion', 'persuasion'], 'fabricante', 'Herramientas de artesano a elegir'),
    bg('animador', 'Animador', ['strength', 'dexterity', 'charisma'], ['acrobacias', 'interpretacion'], 'musico', 'Instrumento musical a elegir'),
    bg('charlatan', 'Charlatán', ['dexterity', 'constitution', 'charisma'], ['engano', 'juego-de-manos'], 'habilidoso', 'Útiles para falsificar'),
    bg('criminal', 'Criminal', ['dexterity', 'constitution', 'intelligence'], ['juego-de-manos', 'sigilo'], 'alerta', 'Herramientas de ladrón'),
    bg('erudito', 'Erudito', ['constitution', 'intelligence', 'wisdom'], ['conocimiento-arcano', 'historia'], 'iniciado-en-la-magia', 'Útiles de caligrafía; iniciado en la magia de mago'),
    bg('ermitano', 'Ermitaño', ['constitution', 'wisdom', 'charisma'], ['medicina', 'religion'], 'sanador', 'Útiles de herborista'),
    bg('escriba', 'Escriba', ['dexterity', 'intelligence', 'wisdom'], ['investigacion', 'percepcion'], 'habilidoso', 'Útiles de caligrafía'),
    bg('granjero', 'Granjero', ['strength', 'constitution', 'wisdom'], ['trato-con-animales', 'supervivencia'], 'duro', 'Herramientas de carpintero'),
    bg('guardia', 'Guardia', ['strength', 'intelligence', 'wisdom'], ['atletismo', 'percepcion'], 'alerta', 'Juego a elegir'),
    bg('guia', 'Guía', ['dexterity', 'constitution', 'wisdom'], ['sigilo', 'supervivencia'], 'iniciado-en-la-magia', 'Útiles de cartógrafo; iniciado en la magia de druida'),
    bg('marinero', 'Marinero', ['strength', 'dexterity', 'wisdom'], ['acrobacias', 'percepcion'], 'maton-de-taberna', 'Herramientas de navegante'),
    bg('comerciante', 'Comerciante', ['constitution', 'intelligence', 'charisma'], ['trato-con-animales', 'persuasion'], 'afortunado', 'Herramientas de navegante'),
    bg('noble', 'Noble', ['strength', 'intelligence', 'charisma'], ['historia', 'persuasion'], 'habilidoso', 'Juego a elegir'),
    bg('soldado', 'Soldado', ['strength', 'dexterity', 'constitution'], ['atletismo', 'intimidacion'], 'atacante-salvaje', 'Juego a elegir'),
    bg('vagabundo', 'Vagabundo', ['dexterity', 'wisdom', 'charisma'], ['perspicacia', 'sigilo'], 'afortunado', 'Herramientas de ladrón'),
];
