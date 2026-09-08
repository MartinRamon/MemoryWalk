import { defineConfig } from 'vitest/config'

// Config de test separada de vite.config.ts a propósito: importar `vitest/config`
// dentro de vite.config.ts choca con los tipos de Vite en `tsc -b`. Aquí no, porque
// este fichero no entra en el typecheck de tsconfig.node.json.
export default defineConfig({
  test: {
    // Fase 0: solo lógica pura y determinista; entorno Node, sin DOM.
    environment: 'node',
    include: ['src/**/*.test.ts', 'server/**/*.test.ts'],
  },
})
