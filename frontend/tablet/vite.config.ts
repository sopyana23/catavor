import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  envDir: '../../',
  base: '/tablet/',
  build: {
    outDir: '../../public/tablet',
    // Kosongkan outDir tiap build agar bundel lama tidak menumpuk
    // dan aset usang tidak ikut ter-deploy. Aman: berkas statis di
    // frontend/tablet/public/ disalin ulang secara utuh tiap build.
    emptyOutDir: true,
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name]-[hash]-t.js'
      }
    }
  }
})
