import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
    // Load .env from project root (one level up)
    const env = loadEnv(mode, '../', 'VITE_')

    return {
        plugins: [react()],
        server: {
            port: 5173,
            strictPort: true,
            proxy: {
                '/api': {
                    target: env.VITE_PROXY_TARGET || 'http://127.0.0.1:8001',
                    changeOrigin: true,
                    secure: false,
                }
            }
        },
        define: {
            // No extra env defines needed for now
        },
    }
})
