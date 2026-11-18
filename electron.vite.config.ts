import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [
      // Bundle the shared widget core instead of externalizing it: the desktop
      // package ships `out/**/*` only, so a node_modules dependency would be
      // missing at runtime (and the workspace link would leak into the ASAR).
      externalizeDepsPlugin({ exclude: ['@toolbox/widgets'] })
    ]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@shared': resolve('src/shared')
      }
    },
    plugins: [react()]
  }
})
