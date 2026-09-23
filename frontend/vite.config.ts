import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

// /api проксируется на FastAPI (backend), поэтому фронту не нужен CORS и адрес бэкенда
const api = { '/api': process.env.VITE_API_PROXY ?? 'http://localhost:8765' };

export default defineConfig({ plugins: [tailwindcss()], server: { proxy: api }, preview: { proxy: api } });
