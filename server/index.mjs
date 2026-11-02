import { createCartaServer } from './app.mjs';
const server = await createCartaServer({ publicOrigin: process.env.CARTA_PUBLIC_ORIGIN || '', ...(process.env.CARTA_STATE_DIR ? { stateDir: process.env.CARTA_STATE_DIR } : {}) });
const port = Number(process.env.CARTA_PORT || 4200);
server.listen(port, '127.0.0.1', () => console.log(`La Carta Sellada: http://localhost:${port}`));
