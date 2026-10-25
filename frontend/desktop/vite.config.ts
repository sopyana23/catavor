import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  envDir: '../../',
  base: '/desktop/',
  build: {
    outDir: '../../public/desktop',
    // Kosongkan outDir tiap build agar bundel lama tidak menumpuk
    // dan aset usang tidak ikut ter-deploy. Aman: berkas statis di
    // frontend/desktop/public/ disalin ulang secara utuh tiap build.
    emptyOutDir: true
  }
})
