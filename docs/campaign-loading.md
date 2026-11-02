# Recuperación de enlaces de campaña

Las rutas de campaña y del VTT comprueban la campaña antes de mostrar sus pantallas. Durante la lectura aparece **Cargando campaña**. El indicador desaparece al terminar o cancelar la navegación.

Si el identificador no figura en el catálogo, aparece **No encontramos esa campaña**, con enlaces para volver al catálogo y reintentar el enlace original. Una respuesta HTTP fallida muestra **No se pudo leer la campaña**: no se presenta como una campaña inexistente.

La pantalla de recuperación forma parte del paquete inicial y está fuera del contenedor de navegación diferido. Por ello puede mostrarse después de un error de red sin pedir otra pantalla al servidor. El reintento solo admite rutas internas de campañas y VTT. Volver al catálogo o cargar una campaña que aún no se haya visitado seguirá necesitando los recursos correspondientes si no están disponibles localmente.

El dato de campaña leído correctamente se conserva por ID durante esta sesión para que la comprobación y la pantalla consuman la misma lectura. Los fallos y las lecturas canceladas no se conservan como campañas válidas. Recargar la aplicación inicia una lectura nueva. Las fichas editadas siguen obteniéndose del servicio compartido y no se alteran sus claves de guardado.

Esta corrección no escribe ni borra partidas, fichas o tableros. No cambia los datos de las campañas.

Las regresiones cubren campaña válida, identificador desconocido, error HTTP, reintento correcto, lectura compartida con el consumidor, cancelación y rechazo de reintentos externos. La comprobación visual valida el aviso de ausencia desde campaña y VTT, el regreso al catálogo y la apertura de una campaña válida.
