// Detect CI environment (GitHub Actions, CI simulation, etc.)
const isCI = process.env.CI === 'true' || process.env.CI_SIMULATION === 'true';

module.exports = {
  projects: [
    {
      displayName: 'default',
      testEnvironment: 'node',
      transform: {
        '^.+\\.js$': ['babel-jest', {
          configFile: false,
          babelrc: false,
          presets: [['@babel/preset-env', { targets: { node: 'current' } }]],
          plugins: ['@babel/plugin-syntax-optional-chaining']
        }]
      },
      testMatch: [
        '**/tests/**/*.test.js',
        '**/tests/**/*.spec.js'
      ],
      testPathIgnorePatterns: (() => {
        const patterns = [
          '/node_modules/',
          '\\\\node_modules\\\\',
          '/tests/integration/',
          '\\\\tests\\\\integration\\\\',
          '/tests/manual/',
          '\\\\tests\\\\manual\\\\'
        ];
        if (process.env.INCLUDE_LOCAL_TESTS !== 'true') {
          patterns.push('/tests/local/');
          patterns.push('\\\\tests\\\\local\\\\');
        }
        return patterns;
      })(),
      setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
      testTimeout: isCI ? 10000 : 5000,
      detectOpenHandles: true,
      maxWorkers: isCI ? 2 : '50%'
    }
  ]
};
