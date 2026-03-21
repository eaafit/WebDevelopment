module.exports = {
  displayName: 'billing',
  preset: '../../../jest.preset.js',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^prom-client$': '<rootDir>/src/test-stubs/prom-client.ts',
  },
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../../coverage/libs/api/billing',
};
