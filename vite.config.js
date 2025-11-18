// vite.config.js
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        tournament: 'tournament.html',
        program: 'program.html',
        admin: 'admin.html',
        login: 'login.html',
        register: 'register.html',
        dashboard: 'dashboard.html',
        ping: 'ping.html',
      },
    },
  },
});
