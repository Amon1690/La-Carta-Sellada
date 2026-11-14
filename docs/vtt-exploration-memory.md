# Terreno explorado y visión actual

El VTT conserva una memoria del terreno por instancia de personaje y escenario:

- Negro opaco: terreno todavía desconocido.
- Mapa oscurecido: terreno explorado que ahora queda fuera de la visión.
- Mapa visible: terreno dentro de la visión actual confirmada.

La memoria conserva el contorno visible, sin ampliarlo a casillas: arcos de luz,
intersecciones con el alcance del personaje y conos recortados por paredes,
puertas y ocultaciones. Cada contorno guarda los recortes del instante visto,
incluida la niebla pintada por dirección; mover la luz, abrir una puerta o quitar
niebla después no convierte en explorado lo que todavía no se había visto.
Solapar recuerdos mantiene el mismo tono oscuro, sin acumular oscurecimiento.

No concede iluminación ni nuevos sentidos. En los pasos permitidos en oscuridad
solo recuerda la pisada redonda del token, recortada por obstáculos. Los tokens
siguen dependiendo de la visión actual y de la ayuda mínima de orientación;
conocer una habitación no muestra sus ocupantes a distancia. La niebla pintada
actual sigue siendo opaca y tiene prioridad sobre cualquier recuerdo.

Compartir visión une únicamente los recuerdos de los personajes incluidos en la
lista activa. Retirarlos restaura las memorias individuales. Las campañas,
escenarios y las instancias duplicadas mantienen registros independientes.

El campo opcional `exploration` amplía el modelo de visión versión 1. Se valida
antes de cargar o importar copias, se conserva al sincronizar y desaparece de una
instancia al eliminar su token. Las claves y el resto de la partida se mantienen.
Los contornos se envían al jugador únicamente como parte del mapa rasterizado;
no se añaden acceso al escenario original ni permisos de edición.

Las casillas históricas de guardados anteriores se conservan. Esos guardados no
contenían el contorno original de la luz y no permiten reconstruirlo: los nuevos
recuerdos sí mantienen la forma exacta. Un guardado sin memoria empieza por la
visión y posición confirmadas actuales, sin inventar recorridos anteriores.

La memoria admite hasta 8192 contornos nuevos y 2 MiB de contornos por escenario, compartidos entre
los observadores. Este presupuesto no invalida las casillas de guardados antiguos. Si una nueva máscara supera esos límites o su complejidad
válida, se conserva íntegro el historial y se avisa a dirección; no se trunca ni
se reinicia automáticamente. Las copias de campaña incluyen esta memoria.
