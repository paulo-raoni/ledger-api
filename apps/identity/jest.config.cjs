module.exports = {
  testEnvironment: 'node',
  testMatch: [
    '**/src/application/usecases/__tests__/**/*.test.js',
    '**/src/events/__tests__/**/*.test.js',
    '**/src/http/__tests__/**/*.test.js',
  ],
  clearMocks: true,
};
