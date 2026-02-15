/**
 * Jest Configuration for Manual Tests (real API calls)
 * Runs only tests/manual; requires user to be logged in (validated before run).
 *
 * @fileoverview Jest config for manual tests that call real Controller/Dataplane APIs
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const baseProject = require('./jest.config').projects[0];

module.exports = {
  projects: [
    {
      ...baseProject,
      displayName: 'manual',
      testMatch: [
        '**/tests/manual/**/*.test.js'
      ],
      testPathIgnorePatterns: [
        '/node_modules/',
        '\\\\node_modules\\\\'
      ],
      setupFilesAfterEnv: ['<rootDir>/tests/manual/setup.js'],
      testTimeout: 60000,
      maxWorkers: 1
    }
  ]
};
