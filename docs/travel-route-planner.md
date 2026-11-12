# Itinerarios por caminos y vías acuáticas

«Calcular por caminos» en el Plan de viaje busca la menor distancia sobre la red
guardada de la campaña. El origen es la posición actual del grupo y el destino
es el lugar seleccionado. Ambos deben coincidir exactamente con nodos declarados;
si varias vías tienen un nodo en el mismo punto, hay que elegir su identificador.
No se añaden rectas al nodo más cercano ni se deducen conexiones de una imagen.

El medio inicial limita los tramos. «Permitir transbordos» habilita el cambio
pie/barco solo en nodos de embarque declarados. «Permitir tramos fuera de camino»
empieza desmarcado y admite únicamente enlaces existentes de ese tipo; no concede
permiso para cruzar agua, zonas desconocidas o huecos de cobertura. Puentes y
vados solo permiten el medio registrado en la red. Se respeta la dirección de
cada tramo. Una red sintética lleva una advertencia visible.

El motor puro aplica Dijkstra con estados nodo/medio, cola mínima y costes
físicos no negativos. Ordena estados y aristas por identificadores estables y
prefiere menos pasos en empates; el resultado no depende del orden importado.
La longitud suma la polilínea completa usando las dos escalas del atlas. El
tiempo es independiente: solo se estima si se declaran velocidades positivas y
finitas para los medios y terrenos de todos los tramos elegidos, con su fuente.
No se inventan velocidades de barco ni se multiplican kilómetros por terreno.
Se optimiza distancia, no un tiempo cuyos parámetros pueden ser desconocidos.

El resultado es una vista previa en azul claro sobre el mapa. Cambiar grupo,
extremos, opciones, velocidades o red la invalida. Salir del panel también la
retira. «Iniciar este itinerario» es una acción explícita: conserva provisiones,
roles y jornadas anteriores y sustituye la ruta desde la posición actual. No se
puede sustituir un itinerario pendiente ni uno con encuentro sin resolver. Para
recalcular, retíralo expresamente; las jornadas y la posición se conservan.

El viaje conserva una instantánea validada de la red completa, su procedencia,
revisión, opciones, geometría y velocidades por medio/terreno. La red de la
campaña puede cambiar sin alterar el viaje. El cursor y las jornadas se guardan
por grupo y campaña y se validan también en las copias. Los guardados anteriores
sin itinerario mantienen sus reglas de ruta manual.

Cada jornada consume horas sucesivamente en sus tramos, a pie y en barco con sus
velocidades declaradas. Al llegar se devuelve el tiempo sobrante. Si falta una
velocidad, se detiene en ese tramo: no se usa la marcha terrestre para el barco.
Los controles globales de ritmo, montura y terreno se reservan a rutas manuales;
en un itinerario se usan las velocidades declaradas para cada medio y terreno.
El director indica las horas del día. Provisiones, tiradas de puestos y encuentros
conservan el funcionamiento existente; un encuentro pendiente impide otra jornada.

Los eventos conservan sus modificadores globales de recorrido: el porcentaje
modifica el rendimiento de la jornada en cada tramo y los km añaden avance por la
misma geometría, sin crear atajos ni cruzar tramos de velocidad desconocida. El
registro muestra km físicos y horas de jornada por separado. `baseHours` del
cursor es la duración equivalente a velocidades declaradas, usada para validar el
cursor y estimar días sin eventos; no suma el tiempo real de las jornadas.

Sin cobertura, nodos o conexión adecuada se explica que no hay itinerario
verificado. «Añadir destino como ruta manual» conserva la acción anterior,
identificada como manual. Las rutas y partidas existentes no cambian de clave,
formato ni significado al abrir el planificador. No se requiere migración.

## Verificación y fuentes

Las pruebas cubren rodeos, enlaces fuera de camino, polilíneas inversas,
puentes/vados, pie/barco, transbordos, dirección, datos y costes inválidos,
cobertura, nodos coincidentes, empates, tiempo desconocido y consumidores reales.
La comprobación visual del 11 de noviembre se realizó en el navegador integrado
de ChatGPT con una campaña sintética aislada: caminos y senderos por defecto,
alternativa fuera de camino, barco, falta de conexión, kilómetros y tiempo
separados, cambio de grupo, conservación de la ruta manual y panel a 390 px.
Se comprobó la línea azul sobre el mapa ampliado y que solo la acción manual
explícita cambia la ruta existente. No se modificaron partidas reales.

Fuentes primarias contrastadas el 11 de noviembre de 2026:

- [Boost.Graph: Dijkstra](https://www.boost.org/doc/libs/latest/libs/graph/doc/html/graph/algorithms/shortest_paths/dijkstra_shortest_paths.html), pesos no negativos y grafos dirigidos/no dirigidos.
- [Reglas gratuitas 2024: viajes y vehículos](https://www.dndbeyond.com/sources/dnd/br-2024/playing-the-game), el vehículo acuático usa su propia velocidad.
- [Herramientas del director 2024: viaje y terreno](https://www.dndbeyond.com/sources/dnd/br-2024/dms-toolbox), distinción entre terreno, carreteras y ritmo.

Estas fuentes no aportan una red cartográfica del atlas. Se conservan sus recursos
y atribución; el cálculo necesita datos propios o importados con procedencia y
uso declarados. Los ejemplos de pruebas no son caminos reales de Faerûn.
