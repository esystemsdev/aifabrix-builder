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
  // Top-level so Jest actually applies it (project-level testTimeout is ignored in some Jest versions)
  testTimeout: 60000,
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
      maxWorkers: 1
    }
  ]
};
