# Propuesta pendiente: entrega del VTT a jugadores

Este documento propone una fase posterior para revisión humana. No habilita
rutas, acceso externo, permisos, sincronización ni nuevos servicios.

El servidor debe ser la autoridad de tablero, revisión y visión. Una solicitud
de jugador comprobaría sesión, campaña asignada, personajes asociados y permiso
explícito del director para compartir visión con instancias concretas. El cliente
no elegiría libremente los observadores de una respuesta. Selección de edición,
bando y turno no concederían acceso. Cambios de asociaciones y concesiones deben
revocarse durante una sesión abierta, además de comprobarse al entrar.

La respuesta de jugador se diseñaría separada de la respuesta completa del
director. Solo incluiría fichas y campos autorizados, posiciones visibles y
acciones propias permitidas. Deben filtrarse nombres, PG, orden de iniciativa,
objetivos, tiradas, recursos, registros, identificadores y recuentos que revelen
fichas ocultas. Las mutaciones de combate se validarían en servidor; el resultado
visible de un aliado no sustituye la visión personal del atacante.

El mapa también necesita una entrega protegida: un archivo original completo
enviado al navegador permite inspeccionarlo fuera de la máscara. Se propone
evaluar imágenes o teselas compuestas en servidor para cada vista autorizada,
con recursos secretos fuera de rutas estáticas públicas. Las respuestas y cachés
deben respetar la audiencia y su revisión, sin reutilizar una vista de dirección
o de otro jugador. La previsualización actual carga datos completos de dirección
en su propio navegador y no es esa frontera de acceso.

Antes de desarrollar se debe acordar la persistencia del servidor, transición
desde guardados locales, recuperación y conflictos por revisión. Las copias
deben conservar campañas y encuentros independientes y permitir revertir una
migración sin perder partidas. El canal de sincronización debe aplicar las
mismas comprobaciones que una consulta ordinaria y actualizarse al mover una
ficha, cambiar luz/efectos o revocar una concesión.

La revisión humana debe fijar qué campañas y tableros se comparten y aprobar
las pruebas de rechazo: otra campaña, observadores falsificados, acceso directo
al mapa original, datos ocultos en listas/registros, cachés cruzadas, sesión
revocada y dos jugadores con visiones diferentes. La apertura de acceso externo
seguirá siendo una decisión separada.
