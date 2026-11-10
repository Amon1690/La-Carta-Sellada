# Redes propias de caminos y vías acuáticas

La sección «Red de caminos y vías acuáticas» de Viajes permite al director importar,
validar, editar y descargar una red de su campaña. Se guarda solo en el navegador
actual y se incluye en las copias de seguridad de esa campaña. No cambia grupos,
jornadas, rutas manuales, atlas ni atribuciones. No calcula todavía itinerarios:
esa selección corresponde a la tarea independiente de planificación.

No se distribuye una red de carreteras de Faerûn: las localizaciones y polígonos
del atlas no prueban conexiones transitables. La plantilla inicial está vacía.
Las únicas geometrías sintéticas del cambio están en pruebas y se identifican
como tales. Una red sintética siempre se muestra con esa advertencia.

## Contrato y procedencia

El documento usa `format: la-carta-sellada:travel-network`, `version: 1`, `id`,
`name` y `revision` entera positiva. Al modificar el mismo ID debe aumentar la
revisión. `dataKind` distingue `own`, `external` y `synthetic`.

`map` debe coincidir con `TRAVEL_MAP_REFERENCE`: mapa `faerun-atlas-v3`,
coordenadas `percent`, ancho 7990, alto 5635, 61,1 km por punto porcentual X y
43,1 km por punto porcentual Y. X crece hacia la derecha e Y hacia abajo. No son
longitud/latitud WGS84. El zoom de presentación no cambia la escala física.

Cada fuente declara `id`, `name`, `kind`, `reference`, `attribution`, `license`
y `usageConfirmed`. Las fuentes externas exigen confirmación de uso del director;
el programa valida la estructura, no verifica jurídicamente una licencia. El
agente no incorpora ni publica nuevas geometrías externas sin contrastar su uso.

`coverage` contiene rectángulos nombrados con fuente y límites `minX`, `minY`,
`maxX`, `maxY` entre 0 y 100. Representan cobertura declarada, no transitabilidad
de toda su superficie. Cada nodo y cada segmento completo deben estar cubiertos
por la unión de esas zonas; un hueco entre rectángulos invalida el tramo. Fuera
de la cobertura se indica que no hay red disponible, con trazado manual aparte.

Cada nodo declara `id`, `name`, `x`, `y`, `sourceId` y `boarding`. Cada arista
declara `id`, `from`, `to`, `sourceId`, `geometry`, `modes`, `direction`, `kind`,
`terrain` y `crossing`. La polilínea incluye sus extremos exactos y todos los
vértices intermedios: su distancia suma la geometría completa con ambas escalas.
No se derivan conexiones por cercanía o por intersección de dibujos.

- `direction`: `both` o `forward`, de `from` a `to`.
- `kind`: `road`, `trail`, `off-road` o `water`.
- `modes`: `foot` para vías terrestres y `boat` para vías acuáticas.
- `terrain`: `plain`, `forest`, `hills`, `mountain`, `swamp` o `water`.
- `crossing`: `none`, `bridge` o `ford`. Un tramo terrestre sobre agua requiere
  puente o vado; uno navegable no autoriza andar sobre el agua. Un nodo donde
  confluyen medios distintos exige un embarque explícito.

La red admite hasta 2000 nodos, 4000 aristas, 20000 vértices, 100 fuentes y 100
zonas, con archivo máximo de 1 MiB. Versiones futuras, campos desconocidos,
identificadores duplicados, referencias inexistentes y números no finitos se
rechazan antes de escribir.

## Guardado, recuperación y copias

La clave `la-carta-sellada:travel-network:v1:campaign:ID` separa campañas. Guardar
exige director de esa campaña, validación completa, revisión nueva y que el
original no haya cambiado desde su carga. Se comparte el bloqueo de restauración
de copias; una recuperación pendiente impide guardar la red.

Los originales ilegibles o futuros no se borran ni reemplazan: se ofrece descargar
el texto original para revisión. Un fallo de cuota de almacenamiento conserva la
red anterior. Las copias de campaña incluyen y validan la red antes de restaurarla;
una copia antigua que no contiene red deja intacta la actual. Las redes de otra
campaña se rechazan. La importación del documento no escribe nada hasta pulsar
«Guardar red validada».

La restauración también comprueba la red local que se va a sustituir. Si el
original es ilegible o de una versión futura, se bloquea antes de escribir;
descargar una copia nueva no autoriza a perder ese original. Las copias antiguas
que no incluyen red pueden restaurar sus demás datos sin tocarla.
