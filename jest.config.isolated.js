/**
 * Isolated test projects only. Used by test-wrapper pass 2 (fresh Node process).
 * @fileoverview
 */

const { isolatedProjects } = require('./jest.projects');

module.exports = {
  projects: isolatedProjects
};
