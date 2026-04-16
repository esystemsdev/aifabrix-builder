/**
 * Full Jest config (default + all isolated projects). `npm test` uses split configs via test-wrapper.
 * @fileoverview
 */

const { allProjects } = require('./jest.projects');

module.exports = {
  projects: allProjects
};
