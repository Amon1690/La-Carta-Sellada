# Carga del mapa de viajes

## Cambio y alcance

Antes se creaban 1456 detalles cartográficos completos aunque ninguno fuera
visible. Ahora se monta únicamente el del marcador bajo el ratón o con foco de
teclado. El ratón tiene prioridad; al salir vuelve el detalle del marcador con
foco y, al perder ambos, se retira. Clic y Enter conservan la selección y las
acciones de colocar/trazar. La descripción accesible de cada botón se mantiene.

Se conservan los 1456 botones y sus coordenadas exactas, los dos desplegables de
1456 destinos y el catálogo original. No cambia ninguna clave, dato de partida,
ficha, regla ni separación entre campañas o grupos. No se modifican imágenes ni
la atribución **Atlas AideDD / Mike Schley**.

## Medición antes y después

Comprobado el 3 de noviembre de 2026 sobre la base `111ec67`, compilación de
producción, Windows y navegador Chromium de la app. Datos públicos de campaña y
sesión ficticia de director servidos en memoria en loopback: sin iniciar sesión,
leer credenciales ni modificar partidas reales. La medición añade únicamente en
la página de prueba un indicador oculto; no forma parte del producto.

| Medida | Antes | Después |
| --- | ---: | ---: |
| Marcadores | 1456 | 1456 |
| Detalles montados sin interacción | 1456 | 0 |
| Elementos de los marcadores y sus descendientes | 10 192 | 2912 |
| Elementos con un detalle consultado | 10 192 | 2917 |
| JavaScript del módulo Viajes, bytes | 681 778 | 682 527 |
| CSS global compilado, bytes | 17 051 | 17 020 |
| Atlas JPEG utilizado, bytes | 15 974 656 | 15 974 656 |

Se eliminan **7280 elementos iniciales (71,4 %)** del conjunto de marcadores.
El módulo añade 749 bytes para controlar ratón y teclado. La descarga del atlas
sigue siendo la misma: esta mejora reduce trabajo de creación de la página.

Se midieron tres recargas consecutivas por versión, desde el indicador insertado
al final del HTML hasta el primer fotograma con 1456 marcadores y el atlas cargado
(`complete` y ancho natural 7990). Misma ventana y servidor, sin vaciar caché,
simular red ni carga de CPU:

| Muestra local | Antes (ms) | Después (ms) |
| --- | ---: | ---: |
| 1 | 366,3 | 297,2 |
| 2 | 386,3 | 307,2 |
| 3 | 363,2 | 301,1 |
| Mediana | 366,3 | 301,1 |

Son observaciones de carga local, con solo tres muestras; no predicen una primera
visita desde Internet ni aíslan todas las fuentes de variación. El ahorro de
nodos es reproducible independientemente de esos tiempos.

## Reproducción y comprobación visual

1. Compilar cada versión con `npm run build` y comparar la fila `travel-map` y el
   CSS global. Consultar el tamaño del JPEG original sin modificarlo.
2. Abrir Viajes con una campaña de prueba, pestaña Grupos y ningún marcador bajo
   el ratón o con foco. Contar `.map-location`, `.location-tooltip` y
   `.map-location, .map-location *`: deben dar 1456, 0 y 2912.
3. Consultar un lugar con ratón y otro con Tab/Enter. Debe quedar un solo detalle,
   legible, con nombre, región, descripción y coordenadas; la asociación accesible
   `aria-describedby` debe apuntar a ese detalle. Al salir del ratón se recupera
   el foco y al salir de ambos queda cero. La prueba de componente cubre esta
   secuencia de ratón y foco, además de todos los botones/coordenadas.
4. Cambiar zoom y abrir Plan: los dos selectores conservan los 1456 destinos.
   Trazar Waterdeep → Neverwinter activando los marcadores. Se comprobó una ruta
   de 544 km con puntos `28.7735,23.0878 24.806,11.8012`, sin duplicación por
   propagación del clic. Recargar y comprobar la recuperación de la ruta.
5. Revisar que el atlas, símbolos y atribución permanecen visibles. La captura
   local `.agent-runtime/travel-map-performance.png` muestra Waterdeep con foco
   de teclado, su detalle y la atribución; la prueba de interfaz también comprobó
   zoom al 18 %, cierre del detalle y trazado. No se ha hecho una prueba táctil
   en dispositivo físico ni una medición de red externa.

Evidencia local: archivos `travel-map-performance-before-dom.json`,
`travel-map-performance-after-dom.json`, `travel-map-performance-before-load.json`
y `travel-map-performance-after-load.json`, junto con registros de comprobaciones
en `.agent-runtime`. Se compararon las 1456 etiquetas y pares de coordenadas:
todos idénticos antes y después. El catálogo conserva SHA-256
`C8D6A5EEC0C7127FF925E6F4A799210EAECBB96DF8659356FFAFCD95EB6DC380`.

## Recursos gráficos: decisión aparte

El atlas actual pesa 15,97 MB y el archivo existente `faerun-travel-map.png`
pesa 127,95 MB. No se borra ni sustituye ninguno. Como propuesta independiente,
se puede evaluar una versión optimizada o por teselas del atlas y revisar el uso
del PNG, manteniendo detalle, licencia y atribución, antes de pedir una decisión
humana. Esta rama no realiza esa transformación.
