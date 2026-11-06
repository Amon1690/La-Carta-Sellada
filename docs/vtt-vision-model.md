# Contrato de visión del VTT

Esta fase incorpora datos, validación y persistencia. Los controles de selección,
las capas de visión y su cálculo se implementarán en las tareas siguientes.
No abre acceso al VTT para jugadores ni cambia permisos.

## Fichas compartidas

`GameStatBlock.vision` y `RuleGenericNpc.vision` son opcionales. Un perfil versión
1 contiene sentidos con alcance en pies y fuente (`rule` o `director`, con
referencia). Un perfil/sentido ausente es desconocido; cero declara ausencia
registrada y `null` solo representa vista normal sin límite de alcance registrado.
No se deducen capacidades por nombre, linaje ni texto de rasgos. Los ejemplos de
las pruebas son sintéticos, no datos para personajes de campaña.

`CharacterSheetsService.saveVisionProfile` guarda en la ficha de origen, sin
alterar PG de tokens, asociaciones ni las claves existentes. `visionProfile`
consulta el dato independientemente de que falten otras estadísticas; datos
inválidos se consideran desconocidos sin borrar el original. Los editores y el
recalculo guiado conservan perfiles explícitos. Los sentidos no se rellenan solos.

## Tableros

El campo opcional `vision` contiene `BoardVisionState` versión1: activación,
entorno, listas de observadores, grupo activo y efectos. Las listas usan
`instanceId` de tokens, no nombres, selección, bando ni turno. Sin grupo activo
la lista está vacía; no se añaden todos los personajes por defecto. Al borrar un
token se retiran sus referencias y efectos de concentración; una lista vacía se
conserva explícita y los otros grupos permanecen intactos.

El entorno distingue iluminación, hora del día, clima y un reloj del mundo de
juego opcional. Todos empiezan desconocidos. Los datos conocidos tienen fuente;
no se consulta el reloj del PC ni meteorología real. Los efectos registran tipo,
ámbito (tokens o círculo), duración, actividad y concentración. Este contrato no
aplica reglas de visibilidad ni descuenta duración automáticamente todavía.

La niebla manual sigue en `fogRects`, independiente del nuevo estado. No cambia
la clave `la-carta-sellada:vtt:CAMPAÑA:TIPO:ENTRADA[:RUN]`. Un tablero sin `vision`
se lee con visión desactivada y entorno desconocido, sin escribir durante la
lectura. En el siguiente guardado válido se añade el estado nuevo junto al anterior.

Un campo de visión inválido o de versión futura bloquea escrituras de ese tablero
y muestra el motivo en el estado de guardado. Se conserva la cadena original y
los datos base del tablero. El restablecimiento confirmado del tablero descarta
su estado completo; no se usa como migración automática. La recuperación general
de JSON ilegible anterior a este contrato sigue siendo una propuesta separada.

## Copias y verificación

La copia de campaña mantiene su versión1 y admite datos antiguos sin visión.
Valida los nuevos perfiles, campos, alcances, fuentes, geometría y referencias
antes de cualquier escritura. Versiones futuras, referencias a tokens inexistentes
y perfiles inválidos se rechazan; no se normalizan durante la importación.

Las pruebas cubren dos listas con un observador excluido, borrado de token,
concentración, turno/selección independientes, fuente y ausencia de sentidos,
editores/recalculo, recarga, campaña/runId distintos y exportación/restauración de
visión junto a niebla manual. Esta rama no modifica plantillas ni estilos; la
comprobación visual de las dos capas y controles corresponde a la fase de
previsualización, que todavía no está implementada.
