# Auditoría del catálogo 2024 y las fichas de PJ

Revisión del 8 de noviembre de 2026, sobre `c75bbd54bac43432f88a71043a00d8e5d95b0fc9`. Se contrastó el texto del Manual del Jugador en español ya disponible localmente con su índice, los catálogos del proyecto y las fuentes oficiales gratuitas. Las fichas guardadas se examinaron en modo de solo lectura; las correcciones del editor no guardan cambios automáticamente.

## Cobertura contrastada

| Catálogo | Resultado |
| --- | --- |
| Conjuros del Manual 2024 | 391 únicos: 34/64/63/52/41/48/34/21/18/16 por nivel 0–9 |
| Dotes | 75: 10 de origen, 43 generales, 10 de combate, 12 dones épicos |
| Habilidades | 18 |
| Clases y subclases | 12 clases, 174 rasgos base, 48 subclases y 241 rasgos de subclase |
| Opciones de rasgos | 28 invocaciones, 10 metamagias y 20 maniobras, consultables desde el nivel correcto |
| Equipo | 160 entradas: 38 armas, 13 armaduras/escudo, 25 tipos de herramientas y 82 tipos de aventura, más dos entradas anteriores conservadas |
| Criaturas del catálogo existente | 51 conservadas |

Se recuperan Localizar objeto, Rociada de color y Castigo brillante. Escupo era una lectura OCR duplicada de Escudo: se conserva su compatibilidad en las selecciones guardadas, con un único conjuro visible. Sanctasanctórum privado de Mordenkainen recupera su nombre completo conservando su identificador anterior. Se corrigen campos multilínea, dados OCR y descripciones que arrastraban listas de conjuros de otra sección. Los rasgos ya no se recortan a 1800 caracteres. Invocaciones, metamagias y maniobras se separan del rasgo final de nivel 20/18 y se vinculan a sus rasgos de nivel 1/2/3.

El equipo incorpora 74 entradas ausentes. Libro y Libro de conjuros son objetos distintos y se mantienen sus precios y pesos; Linterna genérica permanece compatible junto a los tipos concretos. Las entradas genéricas de canalizadores tienen precio/peso variable, sin atribuirles el de una variante concreta. No se ha convertido el catálogo en una base de todos los suplementos, objetos mágicos, monturas o variantes de instrumentos: el inventario contrastado se refiere a las categorías de la tabla.

## Valian Foregon

Humano, Noble, paladín 5, Juramento de entrega. Con las características y objetos guardados son correctos CA 20, PG máximos 54, velocidad 9 m, iniciativa +0, competencia +3 y ataque +8. Los PG incluyen Duro.

Sus conjuros automáticos son Castigo divino, Hallar corcel, Escudo de fe, Protección contra el bien y el mal, Auxilio y Zona de la verdad. Se separan de las seis elecciones ordinarias: las elecciones guardadas aportan Curar heridas y Bendición; quedan cuatro elecciones disponibles que debe decidir el jugador. Los conjuros del juramento no conceden lanzamientos gratuitos individuales.

Hay espada, lanza de caballería y escudo marcados como equipados. Debe indicarse si va montado y qué arma empuña. Sin montura, la lanza requiere dos manos e impide usar escudo a la vez. Duelo añade +2 al daño solo con una única arma a una mano; no se aplica automáticamente cuando ambas armas constan como empuñadas. Arma sagrada se muestra como rasgo, sin activar su bonificador temporal por defecto.

## Erwan Valae

Alto elfo, Erudito, mago 5, Adivino. Son correctos CA 13 sin Armadura de mago activa, PG máximos 32, velocidad 9 m, iniciativa +3, competencia +3 y nueve preparados de clase. Los trucos de origen y de Iniciado en la magia son adicionales a los cuatro de clase.

El ataque con bastón era −1 y pasa a +2 por competencia con armas sencillas; el daño sigue siendo 1d6−1. Escupo pasa a mostrarse como Escudo. Los rasgos Experto en adivinación y Presagio se incorporan a la ficha desde el nivel correspondiente, sin añadir rasgos futuros ni de otra subclase.

Faltan las elecciones de rituales de nivel 1 y la característica de Lanzador ritual. La dote adquirida a nivel 4 exige dos rituales; al subir a nivel 5 permite un tercero opcional. La primera auditoría exigía tres y se ha corregido. El editor solicita esos datos y comparte un solo uso de Ritual rápido. No se deducen las elecciones de la dote ni las adivinaciones aprendidas por subclase a partir de una lista de libro sin procedencia. El director/jugador debe comprobar cuáles eligió; no se añaden conjuros inventados.

## Verificación y límites

`node --test tools/rules-catalog.test.mjs` comprueba cobertura por niveles, nombres recuperados, compatibilidad de identificadores, opciones y atribución de rasgos a su subclase. Las pruebas Angular cubren los cálculos, recursos, migración sin mutación, requisitos y liberación de casillas al cambiar de subclase. Las verificaciones completas y la evidencia visual se registran en el checkpoint del coordinador.

La ampliación de la auditoría sobre `b77d5cfe7057ba8ae3f22f6898712173867b6ed3` revisa los cuerpos de los 391 conjuros, además del índice. Se separan Rociada prismática y Saber druídico, Apariencia y el perfil de Animar objetos, y los perfiles de Invocar aberración, autómata, celestial y dragón. Se recuperan las acciones del corcel y los valores de Insecto gigante, el dado de Toque mortal y las tres escalas numeradas de Controlar el clima. Las reparaciones se mantienen en el generador, con pruebas para evitar que vuelvan a mezclarse.

La tabla de magia salvaje queda reconstruida en sus 25 intervalos que cubren 1–100, conservando el orden de la edición española para sus tiradas secundarias. Los tres compañeros primigenios se muestran en perfiles separados con fórmulas por nivel y Sabiduría. Estas referencias ya están contrastadas; no automatizan la invocación ni el gasto de recursos. Se corrigen también celdas ilegibles de las tablas de conjuros de subclase y dados OCR concretos. El texto extraído conserva defectos tipográficos menores y algunas tablas de progresión en texto plano.

La presencia íntegra de un rasgo en el catálogo no implica que todos sus efectos estén automatizados: multiclase, elecciones especiales de todas las subclases y efectos temporales siguen necesitando revisión del director. La visión configurada previamente se conserva; esta auditoría no reemplaza perfiles de visión ni activa conjuros. No se modifican autenticación, asociaciones de jugadores, campañas ni partidas reales.

## Fuentes y atribución

- Manual del Jugador 2024 en español, texto local ya aportado: conjuros, dotes, clases, subclases y listas de opciones con página de origen.
- [Reglas básicas 2024, conjuros](https://www.dndbeyond.com/sources/dnd/br-2024/spell-descriptions), para contrastar Localizar objeto, Escudo y Rociada venenosa.
- [Reglas básicas 2024, equipo](https://www.dndbeyond.com/sources/dnd/br-2024/equipment), para propiedades de armas.
- [SRD 5.2.1 en español](https://media.dndbeyond.com/compendium-images/srd/5.2/SP_SRD_CC_v5.2.1.pdf), tablas gratuitas de herramientas y equipo de aventureros, consultadas el 8 de noviembre de 2026.
- Edición 2024 licenciada en Roll20 de [Magia salvaje](https://roll20.net/compendium/dnd5e/Subclasses:Wild%20Magic%20Sorcery?expansion=32231&iframe=true), [Señor de las bestias](https://roll20.net/compendium/dnd5e/Subclasses:Beast%20Master?expansion=32231&iframe=true) y los perfiles de [Espíritu aberrante](https://roll20.net/compendium/dnd5e/Monsters:Aberrant%20Spirit?expansion=32231&iframe=true), [Espíritu autómata](https://roll20.net/compendium/dnd5e/Monsters:Construct%20Spirit?expansion=32231&iframe=true) e [Insecto gigante](https://roll20.net/compendium/dnd5e/Monsters:Giant%20Insect?expansion=32231&iframe=true), cotejados el 8 de noviembre de 2026 con las páginas locales.

Esta obra incluye material procedente del documento de referencia del sistema 5.2.1 (SRD 5.2.1) de Wizards of the Coast LLC, disponible en [D&D SRD](https://www.dndbeyond.com/srd). La licencia sobre el SRD 5.2.1 se concede de acuerdo con la licencia internacional de atribución/reconocimiento 4.0 de Creative Commons, disponible en [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/legalcode).
