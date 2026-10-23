module.exports = {
  preset: 'jest-expo',
  testMatch: ['<rootDir>/tests/ui/**/*.test.js'],
  setupFilesAfterEnv: ['<rootDir>/tests/ui/setup.js'],
  clearMocks: true,
  collectCoverageFrom: ['src/screens/**/*.js', 'src/context/**/*.js', 'src/api/**/*.js', 'src/components/**/*.js', 'src/utils/**/*.js'],
  coverageDirectory: 'dist/test-coverage/ui',
  coverageReporters: ['text-summary', 'json-summary', 'html'],
};
