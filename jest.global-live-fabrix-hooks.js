/**
 * Global Jest hooks and CI guard project for live ~/.aifabrix protection.
 * @fileoverview
 */

/** Once per Jest process — protects live ~/.aifabrix (incl. /workspace/.aifabrix). */
const globalLiveFabrixHooks = {
  globalSetup: '<rootDir>/tests/global-live-fabrix-backup.js',
  globalTeardown: '<rootDir>/tests/global-live-fabrix-backup.js'
};

/**
 * @param {object} opts - CI flag and Babel transform config from jest.projects.js
 * @param {boolean} opts.isCI - Whether CI or CI simulation is active
 * @param {object} opts.sharedTransform - Shared babel-jest transform map
 * @returns {object} Jest project configuration
 */
function createSetupCiLiveFabrixGuardProject({ isCI, sharedTransform }) {
  return {
    displayName: 'setup-ci-live-fabrix-guard',
    testEnvironment: 'node',
    transform: sharedTransform,
    testMatch: ['**/tests/setup-ci-live-fabrix-guard.test.js'],
    testPathIgnorePatterns: ['/node_modules/', '\\\\node_modules\\\\'],
    setupFiles: ['<rootDir>/tests/capture-real-fs.js', '<rootDir>/tests/setup-ci-env.js'],
    setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
    testTimeout: isCI ? 15000 : 8000,
    maxWorkers: 1,
    ...globalLiveFabrixHooks
  };
}

module.exports = {
  globalLiveFabrixHooks,
  createSetupCiLiveFabrixGuardProject
};
