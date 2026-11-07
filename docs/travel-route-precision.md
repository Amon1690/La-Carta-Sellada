# Precisión de las rutas de viaje

La ruta `(20,20) → (20.01,20) → (20.02,20)` mide aproximadamente
1,222 km con la escala existente del atlas. Antes el total se redondeaba a
1 km y cada segmento a 1 km: al resolver la ruta el grupo quedaba en el punto
intermedio `(20.01,20)`, aunque el viaje figuraba terminado. Una ruta menor de
medio kilómetro podía convertirse en cero.

El cálculo conserva ahora las fracciones de kilómetro del total, los tramos,
la capacidad diaria y los modificadores de la jornada. La interpolación emplea
esas mismas longitudes. Al llegar se asigna el punto final exacto, incluidos
los bordes del mapa. Los tramos nulos no causan divisiones entre cero.

Solo la presentación usa formato español con hasta tres decimales. Una
distancia positiva inferior a 0,001 km se muestra como `< 0,001 km`. Ese umbral
visual no determina la llegada. Para cerrar residuos de coma flotante se usa
una tolerancia de ocho veces `Number.EPSILON`, relativa a la escala de los
valores comparados. Así no se consume una jornada adicional por un residuo
numérico tras sumar el avance y el resto.

## Partidas existentes

Se conservan las claves y la versión del guardado. Cargar una partida no mueve
grupos ni reescribe jornadas, consumos o planes anteriores. Los kilómetros de
las jornadas antiguas permanecen como fueron registrados; las discrepancias
históricas de redondeo no se reconstruyen automáticamente. Los avances nuevos
utilizan la geometría sin redondear. Las campañas y los grupos mantienen sus
propios planes, rutas y registros, también al exportar y restaurar copias.

## Comprobaciones

Se añadieron nueve regresiones: recorrido de 1,222 km e interpolación al primer
kilómetro, ruta inferior a medio kilómetro, mil tramos cortos, segmentos nulos
y llegada a un borde, capacidad y modificadores fraccionarios, historial
antiguo intacto, recarga de dos grupos/campañas, cierre tras dos jornadas y
copias de dos grupos con distancias fraccionarias.

El 7 de noviembre de 2026 pasaron `test:tools` (3), `test:workflow` (16),
`validate:data`, `build` y `test:ci` (207). La compilación conserva el aviso
previo de tamaño del SCSS de viajes, sin cambios de estilos en esta tarea.

La comprobación visual se realizó en el navegador integrado de la app, con
una campaña y almacenamiento ficticios en un servidor local de prueba. Se
verificaron 1,222 km de ruta/restante, 31,5 km/día, el registro de la llegada,
restante cero, bloqueo de otra jornada y conservación tras recargar. Chrome
no estaba conectado; no se cambiaron permisos ni se automatizó un acceso.

Esta corrección conserva la escala y las reglas actuales. El trazado por
caminos, agua y terreno corresponde a las siguientes fases de la cola.
