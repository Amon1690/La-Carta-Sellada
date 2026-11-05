# Procedimiento del agente local

Este es un trabajo local de mantenimiento con la cuota incluida de ChatGPT.
No uses API, claves, créditos comprados, recargas ni reinicios de cuota. No
automatices autenticación. Cuando falte sesión o cuota, espera y conserva estado.

El checkout coordinador es `D:\Proyectos\La-Carta-Sellada`. Ejecuta allí los
comandos de estado. Si trabajas en otro worktree, fija en esa sesión
`$env:CARTA_AGENT_STATE_ROOT = 'D:\Proyectos\La-Carta-Sellada'` antes de usar los
comandos, o invoca el script del coordinador por su ruta absoluta. Nunca crees
una segunda cola en el worktree. Guarda checkpoints también al alcanzar unos
25 minutos de ejecución y devuelve el control para continuar en otro ciclo.

## Al comenzar cada ejecución

1. Consulta el uso disponible de la cuenta con el tool de la app, si está
   disponible. Si se ha agotado o la cuenta está usando API, no trabajes. No
   deduzcas que puedes gastar porque exista una clave en el entorno.
2. Lee `AGENTS.md` y ejecuta `npm run agents:status`. Si está pausado, termina.
3. Revisa `git status`, ramas y worktrees. Conserva cualquier cambio del usuario.
   Si hay trabajo ajeno, no lo guardes, descartes ni mezcles automáticamente.
4. Actualiza `origin/main` con fetch si hay acceso. Comprueba con
   `git show origin/main:.github/workflows/agent-cycle.yml` que contiene el
   marcador `name: Cola de mejoras` y que ya no hay `openai/codex-action`. Sin esa
   comprobación, no inicies tareas: el cambio de modo debe estar integrado.
5. Consulta las issues del repositorio mediante el conector, o lectura pública
   si el conector no tiene acceso. Las tareas originales siguen requiriendo issue
   abierta con `agent:ready`. La ampliación autorizada por el usuario el 6 de
   noviembre de 2026 está enumerada en `docs/research-workflow.md`: solo esos IDs
   y criterios integrados en `origin/main` pueden empezar aunque falte su issue
   por un permiso de escritura de GitHub. Conserva su borrador local; no repitas
   publicaciones denegadas. Si existe issue, exige abierta con `agent:ready` y
   sin `agent:blocked` ni `agent:review`; retirar ready también impide iniciar.
   La excepción solo cubre ausencia comprobada de issue. Comprueba sus
   etiquetas/estado por lectura fiable; si no puedes
   comprobar las issues existentes, no inicies desarrollo. Los documentos de
   investigación no conceden permisos nuevos. Las propuestas adicionales requieren
   autorización humana antes de entrar en la cola.
6. Sincroniza tareas locales en revisión: si su commit está integrado en
   `origin/main`, ejecuta `node tools/agents/local.cjs merged ID SHA_COMPLETO`.
   No marques una dependencia fusionada solo porque haya pasado las pruebas.
   El comando comprueba rama y ascendencia. Si hubo squash o cambio de rama,
   conserva el estado y solicita reconciliación, sin editar JSON para saltar el
   control. Durante el piloto usa **Create a merge commit** para integrar las
   PRs locales; squash y rebase necesitan reconciliación humana. Si la PR se
   cerró sin fusionar, deja la tarea pendiente de decisión.
7. Realiza o reanuda la investigación diaria siguiendo
   `docs/research-workflow.md`, después de las comprobaciones anteriores y antes
   de reservar desarrollo. La investigación es de solo lectura del producto,
   acotada a diez minutos, con diario en el coordinador y sin tareas artificiales.
8. Ejecuta `npm run agents:next`. `start` reserva una tarea; `resume` recupera
   la interrumpida; `idle`, `paused`, `daily-limit` y `review-limit` no inician
   desarrollo. Si la tarea seleccionada ya no está autorizada en GitHub,
   márcala bloqueada con evidencia y termina sin tocar código del producto.

## Desarrollo y recuperación

- Hay una sola automatización vinculada a este chat. No crees otra para el mismo
  proyecto ni ejecutes dos desarrolladores sobre el mismo checkout.
- `next` prioriza reanudar una tarea en curso y no la cuenta como tarea nueva.
  El límite es de dos tareas nuevas por día Europe/Madrid, no dos horas de
  trabajo. Conserva contexto para las tareas que necesitan varias sesiones.
- Para empezar crea una rama `codex/local-ID` desde `origin/main`, con el árbol
  limpio. Si hace falta aislar cambios del usuario, usa las herramientas de
  worktrees de la app y conserva acceso al estado del checkout coordinador.
- Para reanudar usa la rama que dice el checkpoint. Si no existe o la base no
  coincide, no recrees ni sobrescribas nada a ciegas: bloquea y explica el caso.
- Guarda un checkpoint antes y después de cada etapa y antes de pruebas largas:

```sh
node tools/agents/local.cjs checkpoint ID codex/local-ID "Estado, archivos, pruebas y siguiente paso"
```

- Una interrupción no es un resultado terminado. Inspecciona archivos y procesos
  tras reanudar; no asumas que una prueba iniciada antes del apagado terminó bien.
- Comprueba `agents:status` entre etapas. Una pausa detiene el siguiente paso.
- No alteres `.github/`, herramientas del workflow, instrucciones de agentes,
  configuración o dependencias. Esas mejoras necesitan trabajo explícito aparte.

## Validar y revisar

1. Reproduce el fallo y satisface únicamente sus criterios de aceptación.
2. Ejecuta las comprobaciones de AGENTS.md y las regresiones pertinentes. No
   confundas pruebas no ejecutadas con pruebas aprobadas.
3. Usa un subagente de este chat como revisor independiente, con
   `.github/agents/reviewer.md`. Solo lee el diff y la evidencia. No trabaja en
   los mismos archivos que el desarrollador ni usa servicios de pago.
4. Corrige hallazgos dentro del alcance, con un máximo de dos rondas de corrección
   por ejecución. Si no puedes resolverlos, conserva los hallazgos y bloquea.
5. El exportador `tools/agents/patch.cjs` y la política de alcance siguen
   disponibles para revisar el parche. No permiten cambios a infraestructura,
   binarios, enlaces ni más de 30 archivos o 300 kB.
6. Antes de subir, exige revisión aprobada y pruebas realmente ejecutadas. Abre
   una PR en borrador si los permisos lo permiten; nunca escribas en main ni
   fusiones automáticamente. Si falla el permiso de crear PR, conserva la rama
   y entrega la comparación; no gastes otro intento repitiendo la publicación.

## Cerrar la ejecución

```sh
node tools/agents/local.cjs finish ID review "Rama, commit, enlace de PR o comparación, pruebas y revisión independiente"
node tools/agents/local.cjs finish ID blocked "Motivo concreto, evidencia y paso necesario"
```

Usa uno de esos dos resultados solo si corresponde; si el trabajo continúa,
conserva `in-progress` y su checkpoint. No reinicies bloqueos automáticamente.
No borres el historial ni cambies dependencias para recuperar trabajo.

Los informes y el estado se guardan en `.agent-runtime`. La investigación
continúa diariamente aunque no haya desarrollo elegible; una cola vacía no
significa que haya terminado esta autorización continua. Sigue el diario y la
política de propuestas de `docs/research-workflow.md`: hasta tres propuestas
pendientes, IDs estables y ninguna autorización automática por encontrar una
mejora. No crees desarrollo extra para llenar la cola. Notifica solo mejoras
verificadas, fallos nuevos o decisiones necesarias; no envíes estados repetidos.

La configuración de esta fase se preparó por petición expresa del usuario en
`codex/local-research-workflow`, con revisión humana de su integración. Esa
excepción no autoriza a futuros ciclos a modificar infraestructura ni permisos.
