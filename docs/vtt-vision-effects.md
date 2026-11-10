# Visión, obstáculos y tiempo del juego

La dirección declara el plano: sin geometría confirmada la previsualización queda
cerrada, conservando el guardado anterior. «Confirmar plano sin obstáculos» indica
que se ha revisado ese plano; no descubre paredes en la imagen. Los segmentos usan
coordenadas del tablero de 1536 × 1024. Una puerta abierta deja de bloquear. Vista
y línea de efecto se declaran por separado, permitiendo un obstáculo transparente.

El motor personal devuelve vista, detección de posición y línea de efecto, cada
una verdadera, falsa o desconocida, con motivos. Usa segmentos entre centros en
un plano 2D; no calcula cobertura parcial, alturas ni todas las trayectorias de
un área. Esa comprobación no sustituye las reglas específicas de un conjuro.
Los alcances proceden de fichas y fuentes explícitas, sin asignarlos por nombre.

La vista normal necesita iluminación confirmada o una fuente que alcance el
objetivo. La luz se recorta desde su origen, además de la vista del observador.
Un sentido fuera de alcance no mejora otro que sí alcance el objetivo. Una
fuente de penumbra con ambiente desconocido garantiza luz mínima, pero deja
pendiente su calidad para Percepción. Oscurecimiento del clima se declara aparte:
el nombre «niebla» no determina su intensidad. Hora y clima son datos del juego.

El efecto «Oscuridad que bloquea luz y visión en oscuridad» representa esa
restricción explícita, como la del conjuro Oscuridad; no identifica automáticamente
todos los efectos mágicos ni resuelve anulaciones entre conjuros. Visión verdadera
no atraviesa paredes ni nubes opacas. El sentido sísmico requiere contacto
confirmado con la misma superficie: detecta criaturas y objetos móviles, sin
otorgar vista. Los datos de contacto se guardan con su fuente en el encuentro, por
instancia, y sus controles conservan explícitamente las ausencias. La comprobación
«vista y detección personal» explica los tres resultados sin efectuar tiradas.

Los efectos guardan fuente, ámbito, duración, estado y lanzador que concentra.
«Avanzar asaltos/minutos» descuenta una única cantidad explícita y actualiza el reloj
de juego si estaba confirmado; no consulta temporizadores del ordenador. Los
segundos opcionales conservan avances de seis segundos al cruzar minutos/días.
Cambiar de turno no vuelve a descontar por cada participante. Finalizar un efecto
o concentración conserva el registro y no modifica otros lanzadores o encuentros.
Las consecuencias de perder concentración se confirman por dirección.

La exploración manual permanece independiente. Copias antiguas sin obstáculos o
segundos siguen siendo legibles, sin escribir ni confirmar datos durante la lectura.
No se cambian rutas, autenticación ni permisos de jugadores.

## Fuentes primarias consultadas el 10 de noviembre de 2026

- [Glosario gratuito de reglas 2024](https://www.dndbeyond.com/sources/dnd/br-2024/rules-glossary): sentidos, cegado, iluminación, oscurecimiento y cobertura.
- [Conjuros gratuitos 2024](https://www.dndbeyond.com/sources/dnd/br-2024/spell-descriptions): restricciones concretas de Oscuridad y diferencias entre fuentes mágicas.
- [Reglas gratuitas de juego 2024](https://www.dndbeyond.com/sources/dnd/br-2024/playing-the-game): duración de un asalto.

Se enlazan las fuentes y se describen decisiones de implementación; no se copia
el texto de los conjuros ni se asignan estadísticas a personajes reales.

## Estado de la rama

La comprobación visual la realizó el usuario en el tablero sintético y confirmó
los seis casos propuestos: puertas y listas de observadores, detección sin vista,
oscuridad y luz remota, niebla, duración y concentración, recarga y ventana estrecha.
No se atribuyen estas comprobaciones al control automático del navegador.

Las verificaciones automáticas aprobaron 330 pruebas Angular, 25 del servidor,
3 de herramientas, 16 del workflow, validación de datos y compilación. Incluyen
contactos por instancia, condiciones desconocidas, restauración y separación
entre ejecuciones. La integración de la rama requiere decisión humana.
