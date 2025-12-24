/**
 * @fileoverview Datasources API functions
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const coreApi = require('./datasources-core.api');
const extendedApi = require('./datasources-extended.api');

module.exports = {
  ...coreApi,
  ...extendedApi
};
