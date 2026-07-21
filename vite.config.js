import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true,
    proxy: {
      '/api-pncp': {
        target: 'https://pncp.gov.br',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api-pncp/, ''),
      },
      '/api-comprasgov': {
        target: 'https://dadosabertos.compras.gov.br',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api-comprasgov/, ''),
      },
    },
  },
});
