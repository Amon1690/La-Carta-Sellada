# Previsualización local de visión

La pestaña **Visión** permite activar la niebla de guerra y guardar listas de
observadores por instancia. Seleccionar o cambiar de turno no modifica esas
listas. El director vuelve a sus herramientas mediante **Volver a dirección**.
Al recargar se abre el modo de dirección y se conservan listas y exploración.

La exploración manual permanece independiente: las zonas desconocidas son
opacas. El terreno explorado sin visión se oscurece; la unión de las zonas de
observadores elegidos deja iluminado lo visible. Mover un observador desplaza
su zona sin modificar la exploración. Borrar una instancia limpia sus referencias.

Esta fase ofrece geometría provisional, no un motor completo de sentidos y
efectos. Solo usa vista normal con alcance y fuente explícitos, condiciones
confirmadas, luz intensa o penumbra y clima despejado. Cegado y alcance cero
no aportan vista. Un perfil ausente, oscuridad, clima no resuelto o efectos
activos mantienen la información pendiente. Otros sentidos no se convierten
automáticamente en visión. El reloj real y el clima terrestre no intervienen.

La vista normal se guarda mediante el servicio de fichas compartidas, conservando
los demás sentidos. Los campos exigen alcance y fuente del director. No se
asignan estadísticas a partir de nombres o linajes. La conversión geométrica
respeta la escala actual: 1,5 m por casilla y 0,3048 m por pie.

Una ficha parcialmente cubierta por exploración se omite completa. Para la
visión se comprueba la cobertura de su superficie por la unión de círculos,
incluidas intersecciones y huecos; no basta comprobar sus esquinas. Las fichas
no visibles se eliminan de la representación y de la lista accesible. Al entrar
se cierran fichas y combate, se cancela selección/ataque y se retiran bibliotecas,
turnos, objetivos, registros y herramientas de edición. La capa de exploración
se aplica aunque se haya desactivado su visualización en el editor del director.

Las claves y versiones de guardado no cambian. Las copias existentes incluyen
listas, entorno, perfiles y niebla; una regresión comprueba que la previsualización
sigue siendo la misma tras restaurar dos listas. Las pruebas cubren también
exclusión del DOM, falta de datos, movimiento, listas vacías y recarga.

La comprobación visual local de las dos capas, cambio de lista, movimiento,
recarga y restauración de una copia está registrada en el coordinador. Tras
restaurar se conservan las dos listas, el observador activo, su posición y la
exploración. No se ha realizado una prueba visual en Chrome; se ha utilizado
el navegador integrado de la app.

Esta vista está limitada al director y no transmite el tablero a jugadores.
La propuesta de entrega está en [vtt-player-delivery-proposal.md](vtt-player-delivery-proposal.md)
y necesita revisión humana específica de servidor y permisos.
