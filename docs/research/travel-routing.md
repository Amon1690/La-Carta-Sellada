# Investigación: itinerarios de Viajes

Fecha: 6 de noviembre de 2026. Base: `2c0a689`.
Objetivo: caminos por defecto, check para permitir alternativas fuera de camino,
medios terrestres/acuáticos y jornadas calculadas por los tramos reales.
Las fases descritas todavía no están implementadas.

## Evidencia y fuentes contrastadas

`travel-map.ts:978` suma rectas con escalas 61,1/43,1 km por porcentaje.
`routeToSelectedDestination` y los clics añaden puntos sin buscar caminos.
`dailyDistance` aplica un único terreno a toda la jornada; el clima generado en
`resolveDay` es texto. Las 1456 localizaciones son puntos o centros regionales.

Se consultaron el [atlas original](https://www.aidedd.org/atlas/faerun), sus
[datos públicos](https://www.aidedd.org/atlas/dataF.js?v=7) y su
[cálculo de distancias](https://www.aidedd.org/atlas/fonctions.js?v=5), sin ejecutar
los scripts externos. El mapa mantiene 7990 × 5635 y la escala publicada es
2,104 píxeles/milla. Las nueve geometrías `path` son regiones, no carreteras.
El medidor también acumula segmentos manuales; no se ha encontrado una red
alineada de caminos, agua, puentes o vados en esos recursos.

Se revisó además [LoreMaps](https://github.com/loremaps/loremaps): sus puntos y
sus teselas no resuelven esa falta de topología para este atlas. La búsqueda no
prueba que no exista otra fuente. No se presupone permiso para distribuir nuevas
geometrías derivadas: se debe verificar procedencia y uso del conjunto concreto.
Se conservan imágenes y atribución Atlas AideDD / Mike Schley.

## Arquitectura propuesta

- Red local versionada con nodos/aristas, polilínea completa, tipo de vía,
  dirección, medios permitidos, puente/vado/embarque, terreno y procedencia.
  Declarar la cobertura. No conectar poblaciones solo porque estén próximas.
- Admitir red propia del director mediante edición/importación validada. Los
  ejemplos de prueba serán sintéticos y estarán identificados; no se publicarán
  como caminos reales. Datos externos requieren verificación antes de integrarlos.
- Dijkstra determinista con costes no negativos. La geometría determina
  `distanceKm`; terreno, medio y condiciones determinan duración/avance. Separar
  ambos valores: ir despacio no aumenta los kilómetros físicos.
- Caminos por defecto. El check «Permitir tramos fuera de camino» habilita solo
  alternativas transitables contrastadas, no rectas a través de agua o zonas sin
  datos. El medio de viaje y los transbordos limitan los enlaces válidos.
- Sin cobertura/conexión/medio: «No hay itinerario cartográfico verificado», con
  alternativa manual identificada. No presentar una recta como camino calculado.
- Avanzar por tramos consumiendo horas. Conservar por campaña/grupo geometría,
  opciones y versión de red del itinerario empezado. No recalcularlo en silencio
  cuando se actualice el catálogo. Actualizar copias de seguridad en el mismo cambio.

La ausencia de datos continentales no impide el contrato, el motor, las pruebas
ni una herramienta para redes propias. Sí impide prometer cobertura automática
de todo Faerûn. La investigación diaria seguirá buscando fuentes utilizables y
medirá cobertura, sin fabricar trazados.

## Error adicional confirmado dentro del cálculo solicitado

`calculateRouteDistance` redondea el total y `positionGroupAlongRoute` vuelve a
redondear cada tramo. En `(20,20) → (20.01,20) → (20.02,20)`, los tramos miden
0,611 km cada uno: el total mostrado es 1 km, pero avanzar ese kilómetro sitúa al
grupo en el punto intermedio y ya no queda distancia pendiente. Se incorporó la
tarea `travel-route-precision` para conservar precisión interna y redondear solo
al mostrar. Antes de corregir se añadirá una regresión que reproduzca el caso.

## Criterios de aceptación

Rodeo por camino frente a una alternativa válida; check fuera de camino;
barco/pie; puentes/vados; enlaces desconectados; distancia y tiempo distintos;
llegada exacta con muchos segmentos cortos; conservación de rutas manuales;
actualización de red sin mover viajes iniciados; dos grupos y campañas tras
recarga y restauración de copia. La UI no debe prometer rutas que la red no cubre.

La hora y el clima estructurados acompañarán a los encuentros mediante una
instantánea por campaña/grupo/runId, conservando los textos antiguos como tales.
