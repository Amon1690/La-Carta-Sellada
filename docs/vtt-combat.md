# Combate entre tokens en el VTT

## Uso

1. Abre **Turnos** y tira iniciativa. También puedes introducirla y pulsar **Iniciar con esta iniciativa**. La tirada usa el modificador de la ficha; si falta, hay que completar la iniciativa manualmente.
2. Marca el token al que le toca y pulsa **Atacar**. Las demás filas permiten preparar sus fichas y recursos.
3. Revisa el ataque o conjuro antes del primer uso: tipo de resolución, bonificador o salvación/CD, alcance, daño, número de objetivos y condiciones. La preparación muestra el texto original y la descripción del compendio.
4. Si consume espacios, cargas o usos, crea o elige una reserva e indica su capacidad, disponibilidad actual y coste. Reutiliza la misma reserva para opciones que comparten recursos. Una cantidad ausente exige completarla; no se deduce por nivel o nombre.
5. Elige los objetivos disponibles por distancia. Cada casilla equivale a 1,5 m; las diagonales adyacentes cuentan una casilla y se considera el tamaño del token. El alcance largo impone desventaja. Confirma visibilidad, cobertura, área y condiciones de las fichas.
6. Lanza. El resultado queda pendiente: todavía no se descuentan PG. Los conjuros tienen una primera ventana para interrupciones antes de tirar ataque, salvación o daño.
7. Las reacciones de las fichas que cumplen su disparador se ofrecen de forma opcional. Puedes preparar una reacción y su recurso desde esa misma ventana. Usarla consume su reacción y recursos; el cálculo se actualiza antes de aplicar daño.
8. Confirma que no se usan más reacciones y aplica el resultado. Los efectos especiales requieren una cantidad final y una explicación cuando no pueden resolverse de forma completa.

Cerrar la ventana o recargar conserva la tirada pendiente, el gasto y las decisiones. **Continuar ataque pendiente** permite retomarla. Mientras está pendiente se bloquean movimientos, cambios de turno y ediciones de PG que podrían invalidarla. El registro conserva las últimas 200 entradas.

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

La preparación expresa reglas comprobadas por la persona que dirige. No convierte cualquier descripción libre en una regla automática. Las condiciones, inmunidades, resistencias de distinto tipo, concentración, duraciones especiales, restricciones de objetivos y combinaciones de efectos requieren revisión. Cuando hay daño mixto con defensas o reducciones que no admiten un cálculo único, se exige la cantidad final comprobada y una nota. Los cambios de estado que no son PG se anotan y se resuelven manualmente.

El tablero no determina bandos, obstáculos, áreas o línea de visión. La selección de objetivos muestra tokens dentro del alcance; hay que comprobar que el objetivo cumple las condiciones de la opción. El flujo está orientado a acciones entre tokens; no crea objetivos de terreno ni automatiza conjuros personales o descansos.

La preparación pertenece a la ficha compartida. PG, recursos disponibles, turnos y tiradas pertenecen a cada instancia del tablero y a su grupo de encuentro. Dos tokens de la misma ficha conservan reservas independientes. Terminar o reiniciar un combate normal no recarga recursos. Un estado de combate ilegible se conserva y bloquea nuevas acciones; su restablecimiento exige una confirmación explícita y mantiene el mapa y los PG.

## Verificación

Se añadieron regresiones del motor, integración del VTT y conservación de preparación en fichas PJ/PNJ/genéricas. Incluyen el ejemplo 9+4=13 frente a Escudo, consumo de recursos, reanudación sin repetir dados, aplicación única de PG, alcance/tamaño, salvaciones, críticos, interrupciones antes de los dados y resolución explícita de efectos. Se comprobaron además el flujo visual, la recarga con reacción gastada, el registro y un efecto con daño cero y nota.

Referencias de reglas: [Escudo](https://www.dndbeyond.com/sources/dnd/br-2024/spell-descriptions#Shield), [glosario](https://www.dndbeyond.com/sources/dnd/br-2024/rules-glossary/), [equipo](https://www.dndbeyond.com/sources/dnd/br-2024/equipment) y [reglas de juego](https://www.dndbeyond.com/sources/dnd/br-2024/playing-the-game). Las estadísticas siguen siendo las de las fichas locales.
