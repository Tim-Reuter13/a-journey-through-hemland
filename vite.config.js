import { defineConfig } from 'vite';
export default defineConfig({
  resolve: { preserveSymlinks: true },
  // Three ships native ESM; skip dependency rebundling in restricted Windows environments.
  optimizeDeps: { noDiscovery: true, include: [] },
  build: { rollupOptions: { output: {
    manualChunks(id) {
      if (id.includes('/node_modules/three/')) return id.includes('three.core') ? 'three-core' : 'three-renderer';
    },
  } } },
});
