/** Pruebas de integración: levantan la app completa y hablan con un PostgreSQL real. */
module.exports = {
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/test/**/*.spec.ts'],
  transform: { '^.+\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json' }] },
  setupFiles: ['<rootDir>/test/entorno.ts'],
  testTimeout: 30000,
};
