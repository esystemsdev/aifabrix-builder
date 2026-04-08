/**
 * Default test project only (no isolated suites). Used by test-wrapper pass 1.
 * @fileoverview
 */

const { defaultProject } = require('./jest.projects');

module.exports = {
  projects: [defaultProject]
};
