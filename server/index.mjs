import {createMapsServer} from './app.mjs';

try { process.loadEnvFile?.('.env'); }
catch (error) { if (error.code !== 'ENOENT') throw error; }

const port = Number(process.env.MAPS_PORT || 8787);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('MAPS_PORT must be between 1 and 65535');
const server = createMapsServer();
server.listen(port, '127.0.0.1', () => {
  console.log('GoreeCloud Maps development server listening on http://127.0.0.1:' + port);
});
