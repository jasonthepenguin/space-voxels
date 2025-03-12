import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3001, // Use a different port than your backend
    open: true,
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
  // Make environment variables available to the client
  define: {
    'process.env': {}
  }
});