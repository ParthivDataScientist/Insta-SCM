import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
    // Load .env from project root (one level up)
    const env = loadEnv(mode, '../', 'VITE_')

    return {
        plugins: [react()],
        server: {
            port: 5173,
        },
        define: {
            // No extra env defines needed for now
        },
    }
})
