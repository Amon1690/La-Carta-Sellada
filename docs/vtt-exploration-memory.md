# Terreno explorado y visión actual

El VTT conserva una memoria del terreno por instancia de personaje y escenario:

- Negro opaco: terreno todavía desconocido.
- Mapa oscurecido: terreno explorado que ahora queda fuera de la visión.
- Mapa visible: terreno dentro de la visión actual confirmada.

La memoria registra casillas completamente vistas y las casillas pisadas durante
los pasos permitidos en oscuridad. No concede iluminación ni nuevos sentidos.
Los tokens siguen dependiendo de la visión actual y de la ayuda mínima de
orientación; conocer una habitación no muestra sus ocupantes a distancia.

La visión se calcula con su geometría exacta. La memoria se conserva por casillas
de la cuadrícula existente para acotarla y evitar descubrir partes desconocidas
alrededor de paredes. El borde recordado puede avanzar por casillas; no rellena
casillas parcialmente vistas detrás de obstáculos. La niebla pintada por dirección
sigue siendo una ocultación opaca que tiene prioridad sobre el recuerdo.

Compartir visión une únicamente los recuerdos de los personajes incluidos en la
lista activa. Retirarlos restaura las memorias individuales. Las campañas,
escenarios y las instancias duplicadas mantienen registros independientes.

El campo opcional `exploration` amplía el modelo de visión versión1. Se valida
antes de cargar o importar copias, se conserva al sincronizar y desaparece de una
instancia al eliminar su token. Las claves y el resto de la partida se mantienen.
Los guardados anteriores no contenían recorridos históricos: se empieza con la
posición y visión confirmadas actuales, sin inventar qué terreno se había visto.
