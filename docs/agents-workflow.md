# Mejora continua local con la suscripción

El desarrollo y la revisión se ejecutan en esta app con la sesión de ChatGPT y su
cuota incluida. No se utilizan claves, API de pago, créditos comprados, recargas
ni reinicios de cuota. Al agotarse el uso incluido, el trabajo espera a que se
recupere. La automatización no garantiza disponibilidad ilimitada.

## Cambio respecto al piloto inicial

Se han eliminado del workflow de GitHub las llamadas a modelos, la lectura de
secretos y las ejecuciones programadas. `AGENTS_MODEL` y `AGENTS_ENABLED` ya no
se utilizan. No hace falta crear `OPENAI_API_KEY`; si llegaste a crear una clave
exclusiva para el piloto, puedes revocarla en OpenAI y quitar su secreto en GitHub.
No se leen ni eliminan claves de otras aplicaciones.

El workflow `Cola de mejoras` solo permite crear manualmente las seis issues
iniciales sin duplicados. Las issues #2 a #7 ya creadas se conservan. La CI de
compilación, datos y pruebas permanece en GitHub. Este repositorio es público y
la CI usa runners estándar; no se contratan runners ni servicios adicionales.
No se promete que futuros cambios de plan o de servicios externos sean gratuitos.

La versión anterior en `main` no desaparece hasta integrar esta PR. Hasta
entonces, mantén `AGENTS_ENABLED` sin configurar o en `false`. La automatización
local comprueba esa integración y no inicia desarrollo antes de ella.

## Automatización local

La automatización `Mejora local · La Carta Sellada` está vinculada a este chat y
se revisa cada hora. Trabaja sobre `D:\Proyectos\La-Carta-Sellada`, lee las reglas
del repositorio y sigue `docs/local-agent-runbook.md`.

- Un desarrollador a la vez y un subagente revisor independiente.
- Una tarea por ejecución, hasta dos tareas nuevas al día en Europe/Madrid.
- Hasta tres propuestas pendientes de revisión.
- No se fusionan PRs, publican versiones ni compra nada automáticamente.
- Las pausas, las tareas y los checkpoints se guardan en `.agent-runtime`,
  ignorado por Git. Se conservan al cerrar la app y apagar el equipo.
- Solo avisa de mejoras comprobadas, fallos nuevos o decisiones necesarias.

El estado local es de esta máquina: no sustituye una copia de seguridad y no se
sincroniza por Git. No borres `.agent-runtime` para limpiar el proyecto.

## Al encender el ordenador

El instalador `tools/agents/install-startup.ps1` crea un acceso directo en la
carpeta Inicio del usuario para abrir la app existente al **iniciar sesión en
Windows**. No almacena contraseñas ni cambia el inicio de sesión de Windows.

La app reutiliza su sesión de ChatGPT mientras siga siendo válida. Si pide
autenticación, debes completarla. No se utiliza el CLI como sustituto de una
sesión ausente ni se cambian los métodos de autenticación.

Una vez Windows ha iniciado sesión, la app está abierta y hay conexión, la
automatización retoma en su siguiente revisión horaria. No hay una garantía
documentada de ejecución inmediata al arrancar ni de recuperar cada horario
perdido durante el apagado. Puedes usar **Run now / Ejecutar ahora** en la
automatización si quieres comenzar inmediatamente. No trabaja con el PC apagado.

Para instalar o quitar ese inicio automático, respectivamente:

```powershell
./tools/agents/install-startup.ps1
./tools/agents/install-startup.ps1 -Remove
```

El instalador solo toca su propio acceso directo, comprueba la app instalada y
permite `-WhatIf`. No cambia tareas de Windows, registro, suspensión o permisos.

## Pausar y reanudar

Pausa la automatización desde Programadas para detener nuevas revisiones. Para
una pausa del proyecto que también respeta una ejecución iniciada:

```sh
npm run agents:pause
npm run agents:resume
npm run agents:status
```

La pausa se comprueba al principio de cada etapa; no interrumpe por la fuerza un
comando ya iniciado. Si quieres parar inmediatamente, detén la ejecución activa
desde la app. Conserva la rama y el checkpoint para la siguiente sesión.

## Comprobaciones

```sh
npm run test:tools
npm run test:workflow
npm run validate:data
npm run build
npm run test:ci
```

Node 22 y Chrome son necesarios. Los fallos de permisos al iniciar Chrome se
declaran como bloqueos, sin rebajar pruebas. Las modificaciones visuales siguen
necesitando comprobación visual antes de preparar una propuesta como aprobada.

Referencias oficiales: [autenticación y sesión](https://learn.chatgpt.com/docs/auth),
[tareas programadas locales](https://learn.chatgpt.com/docs/automations).
