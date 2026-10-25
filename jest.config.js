/**
 * Miroir de la configuration Jest de MRA-ERP, réduite au périmètre de la copie :
 * un seul test UI (finder-ui), transformé par ts-jest, exécuté en jsdom.
 */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/setupTests.ts'],
  moduleNameMapper: {
    '\\.(css|less|scss)$': '<rootDir>/src/__mocks__/styleMock.js',
  },
  testMatch: ['<rootDir>/src/**/__tests__/**/*.test.(ts|tsx)'],
  maxWorkers: 1,
  testEnvironmentOptions: { url: 'http://localhost' },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
}
