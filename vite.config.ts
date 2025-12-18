import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, (process as any).cwd(), '');
  return {
    plugins: [react()],
    define: {
      // safely expose env vars to the client-side code
      'process.env.API_KEY': JSON.stringify(env.API_KEY),
      'process.env.POLLINATIONS_API_KEY': JSON.stringify(env.POLLINATIONS_API_KEY),
    },
    build: {
      outDir: 'dist',
    }
  };
});