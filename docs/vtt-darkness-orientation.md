# Orientación mínima de tokens en oscuridad

La vista del jugador y la previsualización mantienen el token del observador
sobre el mapa oscuro. También presentan tokens de las ocho casillas contiguas,
incluidas las diagonales, cuando la oscuridad es el impedimento visual. Con visión
compartida, esta ayuda se une solo desde los personajes de la lista activa.

Es una ayuda del tablero solicitada por dirección. No añade iluminación ni sentidos
a las fichas, no descubre terreno y no cambia Percepción o las reglas de ataque.
Las paredes, puertas cerradas, invisibilidad, ocultación fuerte, condiciones sin
confirmar y tokens ocultos siguen impidiendo presentar a otros personajes.
La niebla sin explorar conserva el terreno y los tokens ajenos; el observador
mantiene su propia posición como referencia. Un token ocultado por dirección
permanece oculto, incluso si es el observador.

Durante su turno, el jugador puede mover su token un paso en oscuridad a una
casilla contigua explorada, siempre que estén confirmados sus datos y el plano y
que el segmento no cruce un obstáculo que bloquee la línea de efecto. Una ventana
puede permitir presentar al vecino y seguir impidiendo atravesarla. Se mantienen
los controles personales y la validación existente de las órdenes del jugador.

La imagen publicada dibuja únicamente estos tokens sobre fondo oscuro. Cuando
no hay visión del terreno, ni siquiera se carga el mapa para componer esa imagen.
Se conserva el modelo de visión versión1, las claves de guardado y la separación
por campaña y escenario.
