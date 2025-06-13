import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // This allows access from other devices on the network
    port: 5173,
    strictPort: true, // Don't try other ports if 5173 is taken
    proxy: {
      // Add any proxy configuration if needed
    }
  },
})
