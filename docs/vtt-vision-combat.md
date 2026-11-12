# Visión personal en combate

Cada ataque consulta la vista del atacante al objetivo y la del objetivo al
atacante. La lista compartida sirve para presentar el tablero; no presta sentidos
ni visión para atacar. La penumbra penaliza Percepción visual, sin añadir por sí
sola desventaja a una tirada de ataque.

La vista y la línea de efecto son comprobaciones independientes. Una puerta con
ventana puede dejar ver y bloquear la trayectoria: el ataque se detiene antes de
tirar o consumir recursos. La cobertura parcial, los requisitos especiales de un
conjuro y otros rasgos siguen requiriendo revisión de su texto. El alcance se
comprueba además por separado. No se deducen esas reglas de que un token sea visible.

Cuando el motor personal no puede confirmar vista o geometría, el formulario
pregunta solo los datos ausentes en ambas direcciones y la línea de efecto. Una
confirmación genérica no convierte los valores desconocidos en vista afirmativa.
Las aclaraciones manuales de visión no se recuerdan para futuros ataques. Los
tableros antiguos con visión desactivada conservan su revisión manual anterior.

La revisión normal se recuerda solo para la misma situación: posiciones, fichas,
condiciones, observadores, entorno, obstáculos, efectos y perfiles de sentidos.
Cambiar un dato obliga a revisar la siguiente acción aunque el resultado visual
parezca igual. También se detectan cambios mientras se guarda una ficha, antes
de gastar el ataque. La exploración recordada no modifica decisiones mecánicas.

Los dados ya tirados y sus decisiones pendientes conservan tiradas, reacciones,
recursos y daño. No se vuelve a tirar al cambiar el entorno o recargar; las nuevas
acciones consultan el estado actual. La cola guarda opcionalmente el contexto personal revisado de cada objetivo;
los estados anteriores siguen siendo válidos y las copias validan los contextos
nuevos. No se cambia el acceso de jugadores ni sus permisos. Las instrucciones de sincronización y servidor existentes
siguen siendo decisiones separadas.
