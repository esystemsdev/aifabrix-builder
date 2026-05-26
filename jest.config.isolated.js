/**
 * Isolated test projects only. Used by test-wrapper pass 2 (fresh Node process).
 * @fileoverview
 */

const { isolatedProjects, globalLiveFabrixHooks } = require('./jest.projects');

module.exports = {
  ...globalLiveFabrixHooks,
  projects: isolatedProjects
};
