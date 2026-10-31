# Mejora continua con agentes

## Estado del piloto

El repositorio incluye el coordinador, desarrollador, verificador, revisor y
auditor. Los agentes de pago permanecen pausados mientras `AGENTS_ENABLED` no
sea exactamente `true`. La CI funciona independientemente y no usa una clave
de OpenAI. La primera ejecución real con API requiere configurar el repositorio.

El piloto procesa una tarea cada vez. El verificador y el revisor sí trabajan en
paralelo, en máquinas separadas, sobre el mismo parche. Dos desarrolladores
simultáneos se dejan para una segunda fase después de comprobar el piloto.

## Activación en GitHub

1. Integra la PR de infraestructura en la rama predeterminada después de revisar
   sus resultados. Las programaciones solo funcionan desde esa rama.
2. En **Settings → Actions → General**, permite que GitHub Actions cree pull
   requests. El workflow solicita permisos específicos para cada trabajo.
3. Ejecuta **Actions → Mejora continua → Run workflow → bootstrap** desde `main`.
   Crea las etiquetas y seis tareas iniciales sin duplicados ni llamadas a IA.
4. Crea una clave de API para un proyecto dedicado y guárdala en
   **Settings → Secrets and variables → Actions → Secrets** con el nombre
   `OPENAI_API_KEY`. No la pegues en chats, issues, archivos o logs.
5. Añade la variable de repositorio `AGENTS_MODEL` con un identificador de modelo
   **de la API** disponible para esa clave. Los nombres de modelos de la app no
   garantizan disponibilidad en la API. Configura el control de gasto del proyecto
   y la cuota de GitHub Actions según tu presupuesto.
6. Añade `AGENTS_ENABLED=true` y ejecuta manualmente el modo `work`. Comprueba la
   tarea reservada, los artefactos, la validación y la PR en borrador. A partir de
   entonces también se ejecutará la programación.

No hay un valor de modelo por defecto ni una clave incluida. Si falta cualquiera,
el coordinador explica la configuración pendiente antes de invocar al agente.

## Ejecuciones y límites

| Actividad | Límite inicial |
| --- | --- |
| Desarrollo | Un ciclo programado cada seis horas |
| Auditoría | Una vez por semana, lunes |
| Ejecuciones de desarrollo | Hasta cuatro al día UTC, contando manuales |
| Auditorías | Hasta una en una ventana de siete días |
| PRs de agentes abiertas | Tres como máximo |
| Intentos por tarea | Dos, en ejecuciones distintas |
| Cambios por propuesta | Hasta 30 archivos y 300 kB de parche de texto |
| Desarrollador | Hasta 15 minutos de trabajo, 12 de llamada al agente |
| Pruebas | Hasta 12 minutos |
| Revisión | Hasta 8 minutos, 6 de llamada al agente |
| Auditor | Hasta 12 minutos, 10 de llamada al agente |

La cadencia de seis horas limita el piloto a cuatro oportunidades diarias. Las
ejecuciones manuales de `work`, incluso sin tarea disponible, consumen una de esas
oportunidades. Las programaciones usan UTC: los minutos 17 de las 00, 06, 12 y 18;
la auditoría es el lunes a las 03:23 UTC. En Madrid la hora local cambia con el
horario de verano. GitHub puede retrasar ejecuciones; no se promete puntualidad.

Una tarea genera como máximo una llamada al desarrollador y una al revisor por
ciclo. Si fallan, no se repiten llamadas dentro del mismo ciclo. Se bloquean los
reruns de trabajos que invocan modelos; para reintentar usa una ejecución nueva.
Los límites de tiempo y frecuencia **no son un tope monetario exacto**: el coste
depende del modelo, los tokens y los minutos de runner. Revisa los controles y
alertas reales de gasto antes de activar. No se ha configurado un presupuesto
económico por ti.

## Cola de trabajo

Las tareas iniciales están en `.github/agents/backlog.json`; su identificador se
conserva en una marca del cuerpo de la issue. El coordinador respeta prioridad y
dependencias: una dependencia solo se satisface cuando su issue está cerrada y
existe una PR fusionada de su rama de agente.

| Etiqueta | Significado |
| --- | --- |
| `agent:backlog` | Pendiente de priorizar |
| `agent:proposal` | Hallazgo de auditoría, sin autorizar |
| `agent:ready` | Autorizada y pendiente de reserva |
| `agent:in-progress` | Reservada por una ejecución identificada |
| `agent:review` | PR preparada para decisión humana |
| `agent:blocked` | Necesita revisar el motivo del bloqueo |

`bootstrap` marca las seis tareas acordadas como autorizadas, pero sus dependencias
siguen siendo obligatorias. Las propuestas semanales se crean únicamente como
`proposal` y `backlog`. Para autorizar una, verifica evidencia, alcance y criterios,
quita esas etiquetas y añade `agent:ready`. El autor de una tarea debe ser un
colaborador con escritura o el bot de estos workflows.

El auditor recibe las issues abiertas y cerradas para evitar repetir hallazgos;
el publicador también deduplica por identificador y título. La deduplicación no
detecta todos los casos semánticamente equivalentes: revisa las propuestas antes
de autorizarlas. El piloto no crea tareas indefinidamente para llenar la cola.

## Qué ocurre en cada ciclo

1. El coordinador comprueba pausa, configuración, cuota, PRs y dependencias.
2. Guarda una reserva vinculada a la ejecución, con un máximo de dos intentos.
3. El desarrollador trabaja en un checkout sin credenciales de publicación.
4. Un exportador de confianza admite solo texto en `src/`, `public/`, `docs/` y
   `README.md`. Rechaza configuración, instrucciones, dependencias, binarios,
   enlaces y cambios excesivos. Se excluye este manual operativo del alcance.
5. Se conserva un parche inmutable. Otro runner aplica ese parche a la misma base
   y ejecuta herramientas, pruebas del workflow, datos, compilación y Angular.
6. Un revisor en una ejecución nueva examina el parche en modo de solo lectura.
   Su salida estructurada debe aprobar sin hallazgos pendientes.
7. Solo si ambos trabajos pasan, un publicador separado crea una rama
   `codex/agent-N`, un commit y una PR en borrador con la evidencia.
8. La issue recibe el resultado. Un fallo se puede intentar una segunda vez;
   después queda bloqueada. El segundo intento recibe el feedback previo.

El agente no tiene permiso para cambiar la propia automatización. Los trabajos
con código de la propuesta no reciben permisos de escritura de GitHub. El
publicador no ejecuta código de la propuesta ni hace `npm install`; utiliza los
scripts de la base validada. Tampoco sobrescribe ramas ni fusiona PRs.

Las PRs creadas con `GITHUB_TOKEN` no disparan normalmente nuevos workflows de
`pull_request`. Por eso el publicador registra explícitamente los checks
`Verificación` y `Revisión de agentes` sobre el commit exacto probado. Las PRs
humanas y los commits de `main` ejecutan la CI convencional. Si se añaden commits
a una PR de agente, hay que validar de nuevo ese nuevo commit; no hereda los
checks del anterior.

La base se comprueba de nuevo justo antes de publicar. Si avanzó desde las
pruebas, el ciclo se detiene para evitar presentar como probado un cambio sobre
otra base. GitHub también debe comprobar que la rama esté actualizada al integrar.

## Revisión humana e integración

Revisa las primeras PRs y cambia su estado de borrador cuando estén listas.
Configura una regla de protección para `main` que exija PR y el check
`Verificación`, sin pushes directos ni force-pushes. Exigir que la rama esté al
día evita integrar sobre una combinación que no se haya comprobado.

`Revisión de agentes` es adicional para las PRs generadas por este circuito; no
se exige globalmente porque las PRs humanas no invocan este revisor de pago.
La revisión de IA no cuenta como aprobación de otro colaborador de GitHub.

Una modificación visual sin comprobación visual suficiente debe quedar pendiente;
el revisor no debe aprobarla por defecto. Durante el piloto no hay pruebas de
navegador visuales ni fusión automática. No se han activado reglas de protección
del repositorio automáticamente.

## Pausa y recuperación

- **Pausar:** cambia `AGENTS_ENABLED` a `false`. No se inician nuevas llamadas.
  Cancela también la ejecución activa desde Actions si quieres detenerla ahora.
- **Reserva interrumpida:** el siguiente coordinador consulta su ejecución. Solo
  si GitHub confirma que terminó, devuelve la tarea a `ready`, `review` o `blocked`.
  Una reserva sin identificador se bloquea para que no se pierda silenciosamente.
- **Segundo fallo:** consulta el comentario y los artefactos. Quitar `blocked` no
  borra el historial de intentos. Para un nuevo alcance crea una tarea nueva con
  referencia a la anterior; no elimines evidencia de fallos para forzar reintentos.
- **Rama sin PR:** se bloquea antes de volver a consumir API. Revisa la rama y la
  ejecución que la creó; abre la PR manualmente si corresponde o elimina esa rama
  tras confirmar que su contenido ya no es necesario.
- **PR cerrada sin fusionar:** decide si se descarta la tarea o se plantea otra.
  La issue queda en revisión hasta esa decisión; no se reabre trabajo por defecto.
- **Cambios de infraestructura:** se preparan explícitamente fuera del agente
  automático y se revisan como una PR normal.

## Resultados y seguimiento

Cada ejecución tiene un resumen en Actions. Las tareas trabajadas reciben un
comentario con el resultado, el feedback del revisor y un enlace a la ejecución.
Los parches e informes se conservan siete días como artefactos. Las ejecuciones
sin trabajo solo escriben su resumen, sin publicar comentarios repetidos.

Las notificaciones dependen de tu configuración de GitHub. Este piloto no crea
correos, avisos externos ni un informe diario adicional. Durante la primera semana
conviene revisar diariamente PRs, bloqueos, consumo y duración de ejecuciones.

## Verificación local

```sh
npm ci
npm run test:tools
npm run test:workflow
npm run validate:data
npm run build
npm run test:ci
```

Node 22 y Chrome son necesarios. En este equipo Windows las pruebas de Chrome
necesitaron permiso adicional de ejecución; no se rebajaron ni omitieron pruebas.

El snapshot publicado conserva los cambios previos de la aplicación. La imagen
de trabajo `public/assets/maps/faerun-travel-map.png` pesa más de 100 MB, no está
referenciada por la app actual y se conserva localmente ignorada por Git. El atlas
usado por viajes es `faerun-atlas-aidedd.jpg`, que sí se incluye.

Referencias: [Codex GitHub Action](https://learn.chatgpt.com/docs/github-action),
[workflows con correcciones automáticas](https://developers.openai.com/cookbook/examples/codex/autofix-github-actions).
