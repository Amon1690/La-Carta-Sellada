# Encuentros del jugador dentro de campaña

La sección **Encuentros** aparece en la navegación de la campaña, junto a
**Fichas PJs**. Lista solo tableros compartidos en los que hay alguna instancia
de un personaje actualmente asignado al jugador. Si hay varios, **Ver como**
permite elegir una instancia propia. Durante su turno puede moverla y usar sus
ataques preparados contra objetivos visibles permitidos.

El director abre el VTT, entra en **Visión** y pulsa **Compartir encuentro con
jugadores**. Se comparte también el nombre del tablero. Cada instancia de PJ
asignado recibe una imagen protegida. Los personajes incluidos en la lista activa
comparten la unión de su visión; los que estén fuera conservan la vista individual.
Cambiar de lista o sus integrantes actualiza esas imágenes. Los observadores
ocultos no contribuyen y la exploración opaca sigue cubriendo el mapa.
**Dejar de compartir encuentro** retira la publicación.
Mientras el tablero está abierto, todos los navegadores consultan cambios cada
segundo. Las imágenes solo se descargan al cambiar la revisión del encuentro.
El director recibe movimientos, ataques, turnos, niebla y cambios del tablero;
las fichas compartidas también se actualizan. Al salir se envía una
última imagen y queda disponible la última vista publicada. Si falla la red,
no se puede garantizar actualizar o retirar esa última imagen: hay que
reintentar desde el tablero. Los guardados locales se conservan.

El alcance registrado funciona con cualquier clima y también sin entorno
confirmado. La niebla manual se aplica siempre, aunque el director oculte su
capa. En oscuridad, la visión normal muestra solo las zonas iluminadas dentro
de su alcance; visión en la oscuridad, visión ciega y visión verdadera usan
sus rangos registrados. La ceguera, los sentidos concedidos y las zonas
explícitas de oscuridad mágica u ocultación fuerte se aplican a sus ámbitos.
Estas zonas opacas proyectan sombra detrás de ellas. El sentido sísmico no
se convierte en visión. Los muros, puertas y ventanas se trazan explícitamente
en el tablero y recortan la vista según sus bloqueos; la niebla manual se conserva
por separado. Un perfil o unas condiciones desconocidos siguen pendientes.

En **Visión**, despliega un personaje para registrar sentidos especiales y
la luz de un objeto: radio de luz intensa, radio total de penumbra y fuente
de los datos. No se deducen del equipo ni del nombre. La luz acompaña a esa
instancia y otros personajes pueden ver su área iluminada; apagarla o borrar
su portador la retira. Los nuevos anclajes son opcionales y conservan versión
y guardados anteriores. Lluvia, nieve y niebla ligera tienen efectos visuales
que no interceptan clics y respetan la preferencia de reducir movimiento.
La vista del jugador anima también el clima sobre la imagen protegida. Lluvia
y nieve usan partículas a distintas velocidades y profundidades; la niebla
usa tres capas que se desplazan por separado. Ninguna capa intercepta clics.

Las tiradas usan la visión personal, no la lista de observadores del director.
No ver al objetivo da desventaja al ataque; que el objetivo no vea al atacante
da ventaja, y ambas se anulan según el motor existente. Se evalúa cada objetivo
de acciones múltiples y las respuestas por separado. Penumbra no penaliza
ataques por sí sola. **Fichas → Percepción visual** permite indicar el
bonificador de la ficha y la posición observada: tira dos dados y usa el menor
si hay oscurecimiento ligero, o indica fallo sin tirar si depende de ver una
zona que el personaje no puede ver. Visión en la oscuridad convierte penumbra
en luz normal y oscuridad en penumbra dentro de su rango. Oído, sentido sísmico,
rasgos especiales, cobertura y otras condiciones mantienen revisión de dirección.
No se inventan penalizaciones mecánicas por lluvia o nieve. La niebla del selector
representa niebla ligera; la ocultación fuerte es un efecto explícito aparte.

Reglas verificadas en las [reglas oficiales de 2024](https://www.dndbeyond.com/sources/dnd/br-2024/playing-the-game)
y su [glosario de sentidos](https://www.dndbeyond.com/sources/dnd/br-2024/rules-glossary).

La imagen se compone en el navegador del director y se convierte en PNG
después de recortar el mapa y descartar fichas ocultas o parcialmente cubiertas.
El servidor conserva además un snapshot privado del director para sincronizar
los navegadores y las acciones. Al jugador no le envía mapa original, fichas
completas, PG ajenos, iniciativa ni registros de dirección. Solo recibe su
imagen, posición propia, objetivos visibles y acciones preparadas autorizadas.
Comprueba sesión, campaña, PJ y audiencia de publicación en cada consulta.
Un personaje recién reasignado no obtiene imágenes de una audiencia anterior
hasta que el director vuelva a publicar. Cambiar su perfil de visión invalida
la imagen anterior, también si pertenece a otro PJ que aporta visión a su lista
compartida. Si aporta visión un PJ sin dueño y sin imagen publicada propia,
cualquier edición de fichas exige regenerar la imagen para evitar usar su perfil
anterior. La lista no concede control sobre personajes ajenos: turnos, movimiento,
ataques y tiradas siguen usando las capacidades personales y sus permisos actuales.
Los conflictos de revisión conservan los cambios locales
en `la-carta-sellada:encounter-conflict:<clave del tablero>` antes de adoptar
la versión compartida; no descartan el historial de conflictos.

## Movimiento y ataques del jugador

El director mantiene abierto el encuentro compartido y activa el turno de un
PJ. El jugador puede arrastrar su token, moverlo con las flechas del teclado o
pulsar **Mover tu token** y elegir una casilla resaltada. El destino completo
debe ser visible y estar dentro del mapa. El recorrido, las paredes y el gasto
de movimiento se supervisan manualmente por el director: esta fase no deduce
velocidad ni permite acciones fuera de turno.

El encuentro seleccionado utiliza toda la zona disponible junto al menú de la
aplicación. La franja de acciones de la izquierda conserva **Mover tu token** y
**Atacar** visibles: se habilitan con el turno y los permisos vigentes. El mapa
se ajusta sin deformarse y la franja no tapa los tokens.

Al pulsar **Atacar**, en **Ataque preparado** se elige una opción revisada en la ficha y un objetivo
visible dentro del alcance. El motor existente calcula la tirada, condiciones,
recursos y daño. Las situaciones con datos de visión sin confirmar no se
resuelven automáticamente. Si hay reacciones o efectos pendientes, el director
los resuelve desde el panel habitual de combate antes de continuar.

El **Registro de combate** del jugador se actualiza con los resultados resueltos:
participantes visibles, fallo o daño final. No incluye capacidades, dados,
bonificadores, CA, reacciones, recursos ni notas privadas del director. Si el
atacante está oculto se presenta como «Alguien»; si solo se ve al atacante, no se
identifica su objetivo ni su resultado. Los sucesos completamente fuera de vista
se omiten. La visibilidad y la audiencia quedan fijadas al resolver cada acción,
por personaje; una reasignación posterior no concede el historial anterior a
otro jugador. Se conservan los últimos 200 sucesos en el estado del combate y
se pueden consultar tras recargar; cerrar el panel permite despejar el mapa.
Los registros privados antiguos se conservan para el director y no se convierten
en relatos públicos. El diálogo de preparar ficha y recursos no muestra el
registro; el director conserva su registro en el tablero.

Cada acción lleva un identificador único y la revisión observada. El servidor
comprueba sesión, campaña, personaje, audiencia, turno vigente y permisos en
la última publicación. Solo admite una acción pendiente por encuentro y caduca
tras quince segundos sin resolución. El navegador del director la resuelve y
confirma resultado, estado e imágenes mediante una escritura con revisión;
dos navegadores no pueden aplicar dos veces la misma acción. Si se pierde la
respuesta, **Consultar o reintentar la misma acción** conserva el identificador
y el cuerpo original para evitar repetir ataques o gastar recursos dos veces.
Sin director conectado, se conserva la última vista pero se rechazan acciones.
Retirar y volver a compartir conserva revisiones únicas para invalidar cachés.

Las publicaciones se conservan en el estado local existente del servidor,
en una colección opcional `encounters`, sin modificar su versión ni las
fichas. Los tableros originales siguen en las mismas claves del navegador;
no se migran, borran ni sustituyen. Campaña, tipo, entrada y `run` forman la
clave independiente de cada publicación. Estas imágenes no sustituyen las
copias de seguridad de partidas. Se admiten hasta 30 vistas por tablero,
100 publicaciones por campaña, PNG de 1536×1024 de hasta 8,5 millones de
caracteres codificados por vista y 16 MiB por solicitud; si se supera un límite
se conserva la publicación anterior y se muestra un aviso para reintentar.

Comprobaciones: herramientas, workflow, datos, compilación, Angular y servidor.
Las regresiones cubren mapas fuera del alcance y niebla realmente descartados,
dos observadores con imágenes distintas, ceguera/datos desconocidos, campañas,
partidas, audiencia, retirada, revisión de fichas, persistencia y salida antes
de que venza la actualización diferida.
