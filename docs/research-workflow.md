# Investigación diaria y ampliación de la cola

Fase `daily-research-v1`, autorizada por el usuario el **6 de noviembre de 2026**.
Esta fase reanuda la mejora continua, que no termina cuando se completa una tanda.
La investigación y la preparación del workflow son el resultado de esta rama;
las nuevas funciones del VTT y las rutas siguen pendientes de sus propias tareas.

## Autorización y límites

La petición incluye dos capas de niebla, visión según personaje/entorno/efectos,
selección de personajes que comparten visión y rutas por caminos con una opción
fuera de camino y consideración de agua/terreno. Se autoriza investigar,
implementar esas mejoras en fases, probar y preparar ramas para revisión humana.
Buscar mejoras adicionales no las convierte automáticamente en tareas autorizadas.

Se mantienen cuota incluida, un desarrollador y revisor independiente, máximo
dos tareas nuevas por día Europe/Madrid, una rama por tarea, tres propuestas en
revisión y checkpoints a unos 25 minutos. No se fusiona ni publica, no se cambian
autenticación/permisos ni dependencias y no se compran servicios.

Los cambios de configuración de esta rama son una petición expresa del usuario;
el exportador automático mantiene su protección y no se amplía para permitir
infraestructura. Se revisan por separado y su integración sigue siendo humana.

## Rutina diaria

1. Confirmar sesión/cuota incluida, ausencia de pausa, cambios ajenos e integración
   del modo local mediante fetch y `git show origin/main:.github/workflows/agent-cycle.yml`.
2. Usar siempre `.agent-runtime` del coordinador. Revisar
   `.agent-runtime/research/AAAA-MM-DD.json` para la fecha Europe/Madrid. Un diario
   completo evita repetir investigación ese día. Registrar en el diario de hoy
   `budgetUsedSeconds` y, si se retoma otro informe, `resumedFrom` antes de trabajar.
   Reanudar primero el informe incompleto y actualizar ambos diarios con tiempo
   consumido, resultado y siguiente paso: no abrir un segundo presupuesto de diez
   minutos al terminar el informe heredado. Si hoy ya consumió 600 segundos, no
   volver a investigar en otro ciclo; registrar las incógnitas y continuar otro
   día. Un corte conserva el tiempo consumido y el checkpoint para la reanudación.
3. Investigar hasta diez minutos en el primer ciclo disponible: releer checkpoints,
   estudios y tareas; contrastar código actual y fuentes primarias gratuitas.
   No usar API de pago, credenciales, login automatizado ni JavaScript externo.
   Guardar el diario inicialmente con `status: in-progress` y pasar a `complete`
   solo al registrar el resultado real, aunque no haya hallazgos nuevos.
4. Cada diario registra fecha del mundo real, base de Git, área/tarea, fuentes con
   URL/fecha/evidencia, hechos, hipótesis, incógnitas y siguiente paso. Esa fecha
   solo organiza trabajo: la hora y el clima del juego no proceden del reloj real.
   Referenciar el diario desde el checkpoint de la tarea en curso; las reservas
   y el historial siguen perteneciendo a `tools/agents/local.cjs`.
5. Revisar backlog, issues abiertas/cerradas, estado local y propuestas previas
   antes de proponer algo. Mantener IDs estables; actualizar evidencia de un
   hallazgo conocido en vez de duplicarlo. Hasta tres propuestas pendientes en
   `.agent-runtime/proposals.json`, usando `.github/agents/audit.schema.json`.
   Nada se implementa solo porque el informe lo recomiende.
6. Después de investigar, comprobar pausa y usar `agents:next`. El límite diario
   impide tareas nuevas, pero permite reanudar la que esté interrumpida. La
   investigación no crea una reserva de desarrollo ni elude ese límite. Una
   tarea que necesite otro ciclo conserva su checkpoint, sin dar pruebas por
   aprobadas tras una interrupción.
7. Si falta integración de esta fase, solo investigar en `.agent-runtime`: no
   reservar desarrollo de la cola nueva. Si falta cuota o hay pausa, no investigar.
   Sin desarrollo elegible, mantener esta rutina para próximos días. Avisar solo
   de mejoras preparadas, fallos nuevos o decisiones necesarias.

Una sesión de investigación vacía también es un resultado válido. No se añaden
reescrituras ni funcionalidades para justificar una ejecución.

## Cola autorizada para esta fase

Los seis IDs iniciales se conservan como historial. Los siguientes IDs y criterios
están aprobados por la petición; los criterios completos y las dependencias están
en `.github/agents/backlog.json`. El desarrollo usa únicamente la versión
integrada en `origin/main`, nunca una ampliación unilateral del agente:

| ID | Resultado comprobable |
| --- | --- |
| research-workflow | Investigación, diario, fuentes y coordinación de esta fase |
| vtt-vision-model | Sentidos/entorno/observadores versionados y copias compatibles |
| travel-route-precision | Distancias internas e interpolación sin redondeos incoherentes |
| travel-route-graph | Red propia/importable validada, con procedencia y cobertura |
| vtt-vision-preview | Exploración y visión distintas; observadores elegidos por el director |
| vtt-vision-effects | Luz, sentidos, obstáculos y efectos temporales con datos verificados |
| travel-route-planner | Itinerarios por caminos y alternativas transitables explícitas |
| travel-route-progress | Jornadas por tramos y conservación del itinerario empezado |
| vtt-vision-combat | Visión personal y decisiones de ataque actualizadas |
| encounter-environment | Hora/clima de juego por grupo/encuentro, sin mezclar estados |

Consultar siempre GitHub: si existe issue, exigir **abierta con `agent:ready` y
sin `agent:blocked` ni `agent:review`**. Retirar ready también detiene un inicio
nuevo, aunque el estado local sea más antiguo. Los seis IDs originales requieren
siempre su issue. Para esta ampliación expresa, solo si se comprueba que no existe issue
tras una denegación de escritura del conector, la lista anterior integrada y la
petición del usuario mantienen la autorización dentro de esos criterios. Guardar
los cuerpos de issue como borradores locales. La ausencia de una issue no permite
crear IDs nuevos ni ampliar el alcance. Si no se puede comprobar por lectura si
hay issues existentes, esperar antes de desarrollar. No repetir publicaciones
rechazadas ni cambiar autenticación para conseguirlas.

El workflow manual de GitHub puede crear las issues que falten después de integrar
esta rama. No vuelve a abrir ni duplica las existentes.

## Decisiones y propuestas fuera de la cola automática

- Publicar tableros a jugadores necesita servidor/sincronización y una revisión
  humana específica de permisos, respuestas y recursos. La previsualización del
  director no equivale a ese acceso. La investigación dejará una propuesta
  concreta antes de habilitarlo; no basta añadir `/vtt` al rol jugador.
- No se ha encontrado una red cartográfica utilizable con procedencia y uso
  verificados para todo el atlas. Se puede avanzar con contrato, motor, fixtures
  sintéticas y redes propias; no prometer cobertura ni fabricar caminos.
- Un guardado de VTT ilegible actualmente se elimina al leerlo. Se ha identificado
  como propuesta adicional de recuperación; no se incorpora silenciosamente a
  la implementación de la niebla.

Los estudios de [visión](research/vtt-vision.md) y [rutas](research/travel-routing.md)
separan la evidencia de lo propuesto. Si aparecen límites nuevos, se registra la
incógnita y se continúa con trabajo independiente dentro del alcance.
