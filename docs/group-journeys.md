# Viajes independientes por grupo

Cada grupo del atlas conserva su ruta, plan y puestos de viaje, provisiones, fondos, fatiga, registro de jornadas y encuentro pendiente. Al seleccionar otro grupo se guarda la preparación actual y se recupera la suya. Resolver una jornada, omitir un encuentro, borrar una ruta o reiniciar jornadas afecta al grupo seleccionado.

Un grupo nuevo comienza con el plan inicial del atlas, sin copiar recursos modificados, notas ni jornadas de otro. Eliminarlo recupera el viaje del siguiente grupo disponible. La posición de cada grupo sigue guardándose con su ficha del mapa.

Cuando hay un encuentro pendiente, su ventana identifica el grupo y permite elegir otro en **Grupo de viaje**. Cambiar de grupo no omite ni resuelve ese encuentro; vuelve a aparecer al seleccionar su grupo, incluso después de recargar. Cada encuentro conserva el enlace a su propia partida de VTT.

## Compatibilidad del guardado

El acceso con roles usa la clave `la-carta-sellada:travel-map:faerun-atlas-v3:campaign:ID_CAMPAÑA`. La clave global anterior se conserva intacta y puede recuperarse una sola vez en la campaña elegida. El formato tiene `version: 2` y un diccionario `journeys` por identificador de grupo. Los campos anteriores de ruta, plan, registro y encuentro siguen reflejando el grupo seleccionado. No se modifican las claves de fichas ni los tableros VTT.

El formato anterior solo tenía un viaje compartido: no es posible reconstruir viajes diferentes que nunca se guardaron. Ese viaje completo se asigna al grupo que estaba seleccionado; si la selección ya no existe, al primero disponible. Los demás empiezan con un plan inicial independiente. Si el archivo no tenía grupos, se conserva como viaje sin asignar y lo recoge el primer grupo que se cree.

Antes del primer guardado migrado se conserva el texto original en `la-carta-sellada:travel-map:faerun-atlas-v3:before-group-journeys`. Una copia previa no se sobrescribe. Si la copia o el guardado fallan, no se sustituye el estado guardado anterior y se muestra el problema. Un archivo ilegible o de versión desconocida se conserva y no se sobrescribe con valores iniciales.

El atlas se abre dentro de la campaña seleccionada por un director y utiliza sus personajes. Los viajes quedan separados por campaña y por grupo. Los compañeros genéricos que ya pertenecían a un viaje antiguo se conservan al recuperarlo. Las reglas de jornadas no cambian.

## Comprobación

Las regresiones cubren dos grupos con reservas, rutas, puestos y encuentros diferentes; consumo y movimiento de uno sin cambiar el otro; recarga; omisión de encuentros; creación y eliminación; migración con selección ausente o sin grupos; y preservación ante datos ilegibles o falta de espacio. La comprobación visual utiliza un origen local de prueba separado de las partidas del usuario.
