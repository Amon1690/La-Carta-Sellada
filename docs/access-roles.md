# Acceso con usuarios y campañas

`npm start` compila Angular e inicia un servidor local Node 22 en http://localhost:4200. No usa servicios de pago ni dependencias nuevas. Los permisos requieren este servidor; servir solo la carpeta Angular o usar `ng serve` no proporciona el sistema de acceso.

## Cuentas iniciales

En el primer arranque se crean admin/admin (administrador), Director/1234 (director) y Jugador/1234 (jugador). Director y Jugador reciben las campañas del catálogo existente. Arranques posteriores conservan cuentas y contraseñas; no recrean usuarios eliminados. Las contraseñas iniciales son las solicitadas para preparación local: deben cambiarse antes de habilitar acceso exterior.

## Permisos

| Rol | Pantallas y datos |
| --- | --- |
| Administrador | Solo gestión de usuarios: alta, edición, eliminación, rol y campañas. No entra en reglas ni contenido de campañas. |
| Director | Dashboard con sus campañas, todas las secciones de reglas, y contenido completo de las campañas asignadas. Edita PJs y asigna uno o varios jugadores. |
| Jugador | Dashboard con sus campañas; hechizos, dotes, habilidades, equipo y rasgos de clase; consulta de sus fichas en cada campaña. No edita fichas ni abre viajes, escenas, encuentros o VTT de dirección. |

Fichas PJs y Viajes se encuentran dentro de la sección cuyo título es el nombre de la campaña. Al asignar jugadores a una ficha, el servidor les añade esa campaña en la misma operación. Cambiar a un jugador a otro rol o eliminarlo desvincula sus fichas sin borrar personajes. No se puede eliminar ni degradar al último administrador. Los nombres de usuario son únicos también si solo cambian mayúsculas. Al editar, contraseña vacía conserva la actual.

Las credenciales se validan en el servidor. Contraseñas con scrypt y sal aleatoria; cookie de sesión opaca HttpOnly/SameSite=Strict; caducidad por 30 minutos de inactividad y máximo 8 horas; comprobación del origen de escrituras y límite de intentos. Cambiar un usuario revoca sus sesiones. El servidor comprueba permisos y asociaciones en cada petición, incluidas escrituras abiertas antes de una revocación. No devuelve hashes ni contraseñas a la interfaz. Las rutas de Angular son una segunda comprobación de navegación.

Los JSON originales de campañas no se descargan directamente. El jugador recibe solo sus fichas y metadatos mínimos; los secretos y fichas ajenas se omiten. Las imágenes requieren sesión y una relación con las campañas/fichas autorizadas, o ser recursos generales de reglas para el director. La correspondencia de retratos y mapas generales está en `shared/assets.mjs`; conserva allí los recursos compartidos al ampliar los encuentros genéricos.

## Guardado y compatibilidad

Usuarios, hashes, asignaciones y ediciones de PJs se guardan fuera de los recursos públicos, en `.local-server/access.json`, ignorado por Git. La escritura sustituye el archivo completo de forma atómica y un fallo conserva el anterior. Las revisiones evitan que dos directores sobrescriban silenciosamente fichas. Haz copia de `.local-server` con el servidor detenido para conservar el acceso; no publiques ese directorio.

Las claves anteriores del navegador no se borran. Un director puede usar **Importar fichas locales en esta campaña** desde Fichas PJs cuando el navegador contiene la colección antigua. La importación no reemplaza una colección ya guardada y solo se admite un destino para las fichas globales anteriores. Ninguna ficha se asigna automáticamente al usuario que la importa.

En Viajes, **Recuperar viaje local en esta campaña** copia el viaje global anterior al destino elegido; conserva el original, sus grupos, jornadas y encuentros pendientes. El atlas nuevo separa estados por campaña. Los tableros VTT, PNJs y genéricos conservan sus guardados anteriores; viajes y tableros siguen guardándose en ese navegador. Esta funcionalidad no añade sincronización del VTT en directo.

El almacenamiento del navegador depende del origen. Para recuperar datos anteriores entra usando el mismo nombre de servidor, puerto y protocolo que utilizabas; localhost y 127.0.0.1 tienen guardados distintos. No se puede leer automáticamente el guardado de otro navegador u origen. Si falla el guardado de una ficha, el editor conserva sus datos y muestra el error; no cierres el editor antes de recuperarlos.

## Operación local

El servidor escucha exclusivamente en 127.0.0.1. No abre puertos del router ni instala túneles. `CARTA_PORT` permite elegir puerto y `CARTA_STATE_DIR` permite aislar un entorno de prueba. `CARTA_PUBLIC_ORIGIN` se reserva para una futura configuración explícita con HTTPS; no habilita acceso exterior por sí sola. Un reinicio cierra las sesiones, pero conserva usuarios y fichas. Las credenciales de la app y las cuentas de ChatGPT/GitHub son independientes.

Referencias: [control de permisos OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) y [scrypt en Node](https://nodejs.org/docs/latest-v22.x/api/crypto.html#cryptoscryptpassword-salt-keylen-options-callback).

## Verificación

`npm run test:server` comprueba autenticación, roles, campañas y fichas filtradas, altas/vinculación, colisiones de nombres, último administrador, caducidad/cierre, origen, intentos, conflictos, importación, fallo de escritura y revocación mientras una petición está abierta. Las pruebas Angular comprueban navegación por rol, separación de fichas, errores de persistencia y descarte de cachés al cambiar permisos. También se ejecutan las comprobaciones de AGENTS.md y una prueba visual con las tres cuentas en un servidor de datos aislados.
