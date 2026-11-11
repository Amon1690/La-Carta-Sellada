# Dibujo de paredes, puertas y ventanas

Petición manual del 11 de noviembre de 2026. Las herramientas Pared, Puerta y
Ventana están en la barra superior del VTT. Arrastrar sobre el mapa crea un
segmento entre los dos puntos elegidos, sin escribir coordenadas ni ajustar
obligatoriamente a casillas. El trazo provisional no se guarda: Esc, cambiar de
herramienta, perder el puntero, cambiar de tablero o entrar en previsualización
lo cancelan. Un clic sin arrastre no crea un segmento.

El panel Trazados reúne la lista, el borrado y la apertura/cierre de puertas.
Al dibujar una puerta se puede marcar «Dibujar puerta con ventana»; también
puede activarse o quitarse esa ventana en una puerta existente, conservando
su identificador, puntos y estado de apertura.

Los segmentos creados por estas herramientas expresan una decisión del director:

- Pared y puerta cerrada: bloquean vista, luz y línea de efecto.
- Ventana y puerta con ventana cerrada: dejan pasar vista/luz y bloquean línea
  de efecto. No se deducen distancias, reglas de conjuros ni material del mapa.
- Una puerta abierta, acristalada o no, no bloquea ninguno de esos canales.

Dirección ve todos los trazados, con colores y patrones distintos. La
previsualización local contiene solo líneas de puertas, recortadas por la misma
visión y exploración. La imagen personal que se compone para los encuentros de
jugadores rasteriza únicamente las puertas dentro del recorte de cada personaje;
la niebla opaca se aplica después. No añade líneas de paredes/ventanas ni envía
sus coordenadas a la respuesta de jugadores. Las imágenes del mapa conservan
los dibujos que ya forman parte del propio recurso gráfico.

Se reutilizan el servicio de visión, su persistencia por tablero y el canal
existente de encuentros. No se abren accesos ni cambian permisos. El contrato
de visión 1 conserva `wall` y `door`, y admite `window` y `door-window`; solo
los tipos de puerta llevan `open`. Los obstáculos anteriores se leen sin
reescribirlos ni cambiar sus banderas de bloqueo. No cambia la clave del guardado,
la exploración, fichas, turnos ni las partidas de otros tableros/campañas.

Las regresiones cubren punteros y escala, cancelación, tipos y transparencia,
puertas acristaladas, recarga, separación de vistas y píxeles del raster personal.
La comprobación visual real queda registrada en `.agent-runtime` antes de entregar.
