# La Carta Sellada

Version 1.0 de una herramienta local para dirigir una aventura de Dragones y
Mazmorras 5.5 (2024) en la Costa de la Espada.

## Desarrollo

Para arrancar la aplicacion:

```bash
npm start
```

Despues abre `http://localhost:4200/`.

## Validación y agentes

```bash
npm run test:tools
npm run test:workflow
npm run validate:data
npm run build
npm run test:ci
```

La CI comprueba herramientas, coordinación de agentes, datos, recursos,
compilación y pruebas de Angular. Requiere Node 22 y Chrome.

El mantenimiento continuo usa la sesión local de ChatGPT y su cuota incluida,
sin claves ni llamadas a la API de pago. Conserva checkpoints para reanudar tras
un apagado, con revisión independiente y PRs en borrador. GitHub mantiene la cola
y las comprobaciones convencionales, sin ejecutar agentes. Consulta la
[guía de activación y operación](docs/agents-workflow.md).

## Build

Para compilar la version de produccion:

```bash
npm run build
```

## Alcance 1.0

- Layout principal con barra superior, navegacion lateral y barra de estado.
- Dashboard con catalogo de campañas y seleccion de campaña activa.
- Navegacion contextual: resumen, actos, escenas, encuentros y compendios quedan ligados a la campaña seleccionada.
- Indice de actos y vistas de direccion con paneles de resumen, escenas y encuentros.
- Navegacion por compendio para personajes, documentos, lugares, escenas, encuentros y timeline.
- Busqueda y filtros por etiqueta dentro de cada seccion de compendio.
- Busqueda global desde la barra superior mediante la ruta `/buscar`.
- Secciones dedicadas para PJs sugeridos y opciones de antagonistas.
- Acto II completo con investigacion ramificada, posada de respaldo, cantera, pistas redundantes y combate ajustable para 3-5 PJs.
- Quince fichas de PJ de nivel 5 y 41 fichas de PNJ con estadisticas, personalidad, informacion y reacciones.
- Compendio 2024 con 387 hechizos, 75 dotes, 18 habilidades y 86 objetos de equipo.
- Referencias de pagina al Manual del Jugador en todas las entradas de reglas.
- Datos iniciales de la aventura en `public/data/campaign.json`, cargados desde la app.
- Indice ampliable de campañas en `public/data/campaigns.json`.
- Estilos base compartidos para colores, espaciado, radios y tipografia.
