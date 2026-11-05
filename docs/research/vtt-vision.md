# Investigación: exploración y visión en el VTT

Fecha: 6 de noviembre de 2026. Base: `2c0a689`.
Petición del usuario: dos capas independientes y un modo para elegir con qué
personajes se comparte visión. Las fases siguientes son trabajo pendiente.

## Evidencia del proyecto

- `vtt-board.ts:118`: el guardado contiene tokens, `fogRects`, capas y combate;
  todavía no hay entorno, sentidos ni observadores estructurados.
- `vtt-board.scss:278,324,424`: la niebla tiene z-index 20 y los tokens 30;
  `hidden` reduce opacidad. Cubrir terreno no oculta la información de los tokens.
- `access.ts:28`: el jugador no puede abrir `/vtt`. El servidor filtra campaña y
  recursos para ese rol; el tablero solo se conserva en localStorage por
  campaña/entrada/runId. No existe sincronización de tableros entre navegadores.
- `campaign.ts:138` y `character-origins.ts`: sentidos descritos en texto, sin
  modelo mecánico común. No se deben inventar capacidades al encontrar un nombre.
- `attack-situation.ts:34` ya pregunta quién ve a quién; la caché de
  `attack-picker.ts:53` no depende todavía de luz, clima, muros o efectos.
- `campaign-backup-format.ts:128`: `validateBoard` y las copias deben evolucionar
  junto con cualquier nuevo campo. Un modelo nuevo sin validar su restauración
  dejaría incompleta la funcionalidad.

## Reglas verificadas y límites

Fuente primaria: [SRD 5.2.1 español](https://media.dndbeyond.com/compendium-images/srd/5.2/SP_SRD_CC_v5.2.1.pdf),
páginas 12, 170–171, 208 y 210; [página oficial](https://www.dndbeyond.com/srd).
Penumbra y oscuridad son estados diferentes. Los sentidos tienen alcance y
restricciones: visión en oscuridad no equivale a atravesar oscuridad mágica o
paredes; vibraciones permite detectar sin conceder vista. Luz, niebla, cobertura
y efectos de conjuros necesitan propiedades distintas. Estas son conclusiones
para el modelo, no una reproducción de las entradas de reglas.

El SRD declara CC BY 4.0 y una atribución en su primera página. Antes de copiar
texto a datos del producto debe conservarse esa atribución y comprobarse el
contenido concreto. No se infiere de ello permiso sobre mapas u otra ambientación.
Esta rama solo enlaza las fuentes y registra el diseño.

## Diseño propuesto

1. Perfiles explícitos de sentidos, fuente y datos desconocidos; estado de entorno
   versionado. Usar fichas compartidas para que edición, viajes y VTT concuerden.
2. Mantener la exploración manual. Añadir visión dinámica independiente: terreno
   desconocido opaco, conocido sin visión oscuro, visible iluminado.
3. Listas guardadas de personajes/observadores por instancia de token. El director
   elige con quién se comparte; la unión usa solo esos observadores. Ni el bando,
   ni el turno, ni la selección de edición cambian implícitamente la lista. Al
   borrar un token se limpia su referencia. El conocimiento de un observador no
   debe revelar automáticamente exploración de otro que nunca se compartió.
4. Motor puro con resultado visible/no visible/desconocido y motivos. Separar
   detección, vista y línea de efecto. Obstáculos y puertas se marcan con geometría
   explícita; una imagen no aporta automáticamente paredes fiables.
5. Hora del mundo y clima configurados por el director o procedentes del viaje.
   No usar el reloj del PC ni meteorología de la Tierra. Registrar alcance,
   concentración, duración y final de efectos; no extraerlos de texto ambiguo.
6. La visión compartida sirve para presentar el tablero. El combate usa la visión
   personal del atacante y del objetivo. Mover, cerrar una puerta o terminar un
   efecto invalida las decisiones anteriores de ventaja/desventaja y objetivos.

## Entrega por etapas y acceso de jugadores

Primero se implementarán modelo, migración y previsualización del director;
después, efectos y coherencia de combate. Las tareas están en la cola con sus
pruebas. La previsualización debe ocultar también listas, nombres, PG, turnos,
fichas, selección y objetivos fuera de visión.

Para que jugadores conectados reciban el tablero hay una fase adicional de
servidor, sincronización y permisos que **no queda autorizada al agente automático**
por estos documentos. Se preparará una propuesta específica para revisión humana:
qué tableros puede abrir cada usuario, quién concede visión compartida y qué datos
salen del servidor. Ocultar por CSS no garantiza confidencialidad. No se abrirán
rutas ni se enviarán criaturas/mapas secretos para probar la previsualización.

## Criterios esenciales

Dos observadores compartidos y un tercero excluido; cambio y eliminación de
observadores; personaje con y sin visión nocturna; luz remota; oscuridad mágica;
pared/puerta; detección por vibraciones sin vista; expiración de efectos; combate
sin visión personal aunque un aliado vea; recarga, copias y separación por
campaña/encuentro. Los cambios visuales requieren comprobación visual real.
