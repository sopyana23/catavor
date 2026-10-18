import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  envDir: '../../',
  base: '/mobile/',
  build: {
    outDir: '../../public/mobile',
    // Kosongkan outDir tiap build. Sebelumnya `false`, sehingga bundel lama
    // menumpuk (5 JS desktop / 3 mobile, hanya 1 yang dirujuk index.html) --
    // repo membengkak dan aset usang ikut ter-deploy. Aman: file statis di
    // frontend/mobile/public/ ikut disalin ulang tiap build.
    emptyOutDir: true
  }
})
