
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, (process as any).cwd(), '');
  return {
    plugins: [react()],
    build: {
      outDir: 'build',
    },
    define: {
      'process.env.API_KEY': JSON.stringify(env.API_KEY),
      'process.env.REACT_APP_API_KEY': JSON.stringify(env.REACT_APP_API_KEY),
      // Shim process.env for code that accesses it directly if necessary, 
      // though accessing specific keys is safer.
    },
    server: {
      port: 3000
    }
  };
});
