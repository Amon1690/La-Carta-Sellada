# Combate entre tokens en el VTT

## Uso

1. Abre **Turnos** y tira iniciativa. También puedes introducirla y pulsar **Iniciar con esta iniciativa**. La tirada usa el modificador de la ficha; si falta, hay que completar la iniciativa manualmente.
2. Marca el token al que le toca y pulsa **Atacar**. El mapa queda libre: clica directamente el token objetivo. Ese clic no mueve ni multiselecciona fichas; Esc o **Cancelar** termina la selección de ataque.
3. Elige el arma o conjuro en el lateral. Se muestran sus valores y las opciones fuera de alcance se desactivan. Una espada con datos completos puede usarse directamente; los alcances, costes o fórmulas dudosos se completan con **Completar datos**. **Preparar ficha** permite revisar recursos sin iniciar un ataque.
4. El VTT calcula ventaja/desventaja a partir de distancia, bandos y condiciones registradas. Si no conoce visión, cobertura o efectos de las fichas, pregunta en el lateral. **Hay condiciones o efectos adicionales** permite aclararlos, elegir una tirada final por un rasgo especial o exigir una resolución manual antes de aplicar daño.
5. Solo se recuerda una aclaración normal en esta sesión mientras no cambien posiciones, fichas o condiciones. Las excepciones de visión, CA, defensas y ventaja adicional se preguntan de nuevo. **Revisar situación antes de este ataque** fuerza una nueva aclaración.
6. Dados, resultado y PG se resuelven sin ventana adicional cuando no hay decisiones pendientes. La última acción queda visible sobre el registro. Un conjuro permite interrupciones antes de sus dados si hay una reacción que pueda aplicarse.
7. Si existe una reacción aplicable, aparece la ventana con las opciones del personaje y sus recursos. Se puede usar una o **Continuar sin más reacciones**. Al resolverlas se vuelve al mapa automáticamente. Los espacios, cargas y usos se descuentan; las cantidades ausentes se completan y las reservas compartidas se configuran explícitamente.
8. Si una reacción permite un ataque de respuesta, se calcula la situación de quien responde y se confirma antes de lanzar sus dados. Un efecto especial o la opción de resolución manual mantiene los PG pendientes hasta introducir cantidad final y explicación. La decisión manual se conserva al recargar.
9. Para opciones con varios objetivos, **Distribuir entre varios objetivos** mantiene la selección avanzada y revisión de área. Los impactos repetidos sobre un mismo token se eligen en el lateral cuando la ficha los permite.

Cerrar la ventana o recargar conserva la tirada pendiente, el gasto y las decisiones. **Continuar ataque pendiente** permite retomarla. Mientras está pendiente se bloquean movimientos, cambios de turno y ediciones de PG que podrían invalidarla. El registro conserva las últimas 200 entradas.

## Condiciones en el mapa

En **Fichas → Estado de combate** se registran bando y condiciones por instancia del token: tumbado, cegado, restringido, envenenado e incapacitado. Los tokens nuevos comienzan sin condiciones activas; los antiguos conservan sus datos y las ausencias se consultan. La ocultación visual del token en el tablero no equivale a invisibilidad reglamentaria.

La inferencia contempla alcance largo, enemigos próximos en ataques a distancia, visión declarada y las condiciones admitidas; ventaja y desventaja se anulan. Restringido también impone desventaja en salvaciones de DES. Incapacitado bloquea ataques y reacciones. Sentidos especiales, otras condiciones y excepciones de rasgos necesitan aclaración; no se deducen de un texto ambiguo. La elección de tirada final es una decisión explícita para esos casos, no una regla inventada.

## Ejemplo: Guardia veterano y Aprendiz arcano

La espada del Guardia tiene +4 y alcanza una casilla contigua. Un 9 natural da un ataque total de 13 contra CA 12. Antes de quitar vida, el Aprendiz puede usar Escudo si tiene reacción y el recurso configurado. Consume un uso o espacio, su CA pasa a 17 y ese ataque falla. Escudo dura hasta el inicio del siguiente turno del Aprendiz; no evita un 20 natural. Al comenzar su turno recupera la reacción, pero no recupera usos ni espacios.

Los espacios de conjuro se distinguen de usos y cargas. Se comprueba nivel, disponibilidad y el límite de un espacio gastado por turno. Para un conjuro ofensivo elevado hay que preparar su nivel y fórmula correspondientes: el daño no se escala por suposición. Un contrahechizo puede exigir una salvación del lanzador y devolver su recurso, según la configuración revisada.

## Auditoría de los datos existentes

Las fichas guardaban ataques, conjuros, rasgos y equipo como texto libre. Se revisaron las 15 opciones de PJ, 41 PNJ y 69 fichas genéricas; cuatro PJ de campaña no tenían estadísticas registradas. Esas fichas deben completarse antes de combatir.

- Guardia veterano: CA 17, 32 PG, espada +4 y 1d8+2 cortante, dos ataques según su texto. La formación defensiva es condicional: se comprueba por uso, sin sumarla permanentemente a su CA.
- Aprendiz arcano: CA 12, 14 PG y Escudo en una lista «3/día» cuya agrupación no identifica inequívocamente una reserva compartida. El usuario confirma la reserva y disponibilidad antes de usarlo.
- Muchos ataques a distancia carecen de alcance. Ese dato queda pendiente de preparación; no se asigna el de un arma parecida.
- Hay errores de transcripción en el compendio, incluido «Escupo» para Escudo y fórmulas de daño ilegibles. Se reconoce explícitamente el alias de Escudo sin cambiar los datos de origen. Las fórmulas dudosas no se convierten en estadísticas inventadas.
- Un escudo de equipo no se trata como el conjuro Escudo ni se suma otra vez a una CA que ya incluye armadura.

Se añade una preparación estructurada opcional a las fichas sin sustituir los textos ni las claves de almacenamiento anteriores. Las ediciones del compendio conservan esa preparación. Si cambia el texto de una opción, se exige revisar la nueva opción en lugar de reutilizar silenciosamente una preparación antigua.

## Alcance y límites

El cálculo admite ataques contra CA, críticos y fallos naturales, ventaja/desventaja, salvaciones y mitad de daño, impactos automáticos, varios objetivos/impactos y distintos componentes de daño. Permite configurar reacciones de CA, reducción, mitad de daño, desventaja, interrupción, redirección, respuesta y resolución explícita.

La preparación expresa reglas comprobadas por la persona que dirige. No convierte cualquier descripción libre en una regla automática. Las condiciones, inmunidades, resistencias de distinto tipo, concentración, duraciones especiales, restricciones de objetivos y combinaciones de efectos requieren revisión. Cuando hay daño mixto con defensas o reducciones que no admiten un cálculo único, se exige la cantidad final comprobada y una nota. Los efectos que no se representen entre las condiciones del mapa se anotan y se resuelven manualmente.

El tablero no determina bandos, obstáculos, áreas o línea de visión. La selección de objetivos muestra tokens dentro del alcance; hay que comprobar que el objetivo cumple las condiciones de la opción. El flujo está orientado a acciones entre tokens; no crea objetivos de terreno ni automatiza conjuros personales o descansos.

La preparación pertenece a la ficha compartida. PG, recursos disponibles, turnos y tiradas pertenecen a cada instancia del tablero y a su grupo de encuentro. Dos tokens de la misma ficha conservan reservas independientes. Terminar o reiniciar un combate normal no recarga recursos. Un estado de combate ilegible se conserva y bloquea nuevas acciones; su restablecimiento exige una confirmación explícita y mantiene el mapa y los PG.

## Verificación

Se añadieron regresiones del motor, integración del VTT y conservación de preparación en fichas PJ/PNJ/genéricas. Incluyen el ejemplo 9+4=13 frente a Escudo, consumo de recursos, reanudación sin repetir dados, aplicación única de PG, alcance/tamaño, salvaciones, críticos, interrupciones antes de los dados y resolución explícita de efectos. Se comprobaron además el flujo visual, la recarga con reacción gastada, el registro y un efecto con daño cero y nota.

Referencias de reglas: [Escudo](https://www.dndbeyond.com/sources/dnd/br-2024/spell-descriptions#Shield), [glosario](https://www.dndbeyond.com/sources/dnd/br-2024/rules-glossary/), [equipo](https://www.dndbeyond.com/sources/dnd/br-2024/equipment) y [reglas de juego](https://www.dndbeyond.com/sources/dnd/br-2024/playing-the-game). Las estadísticas siguen siendo las de las fichas locales.
