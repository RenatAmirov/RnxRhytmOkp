import { defineConfig } from 'vite';
import { api } from './server/index.mjs';

export default defineConfig({
  plugins: [{
    name: 'ritm-local-api',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (request.url?.startsWith('/api/')) api(request, response);
        else next();
      });
    },
  }],
});
