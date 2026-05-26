/**
 * Full Jest config (default + all isolated projects). `npm test` uses split configs via test-wrapper.
 * @fileoverview
 */

const { allProjects, globalLiveFabrixHooks } = require('./jest.projects');

module.exports = {
  ...globalLiveFabrixHooks,
  projects: allProjects
};
