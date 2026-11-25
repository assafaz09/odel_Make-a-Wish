import path from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

const serverDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../server')

function readServerPort(value: string | undefined): number {
  if (value === undefined || value.trim() === '') {
    return 3001
  }

  const port = Number(value)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid PORT "${value}". Expected an integer between 1 and 65535.`)
  }

  return port
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, serverDir, '')
  const serverPort = readServerPort(env.PORT)

  return {
    plugins: [react()],
    server: {
      host: true,
      port: 5173,
      strictPort: true,
      proxy: {
        '/api': {
          target: `http://127.0.0.1:${serverPort}`,
          changeOrigin: true,
        },
      },
    },
  }
})
