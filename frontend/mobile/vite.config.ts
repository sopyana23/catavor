import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  envDir: '../../',
  base: '/mobile/',
  build: {
    outDir: '../../public/mobile',
    // Kosongkan outDir tiap build agar bundel lama tidak menumpuk
    // dan aset usang tidak ikut ter-deploy. Aman: berkas statis di
    // frontend/mobile/public/ disalin ulang secara utuh tiap build.
    emptyOutDir: true
  }
})
