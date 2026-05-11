/**
 * @fileoverview Shared strict check that developer Postgres/Redis infra is running.
 */

'use strict';

const logger = require('../utils/logger');
const infra = require('../infrastructure');
const { formatSuccessLine } = require('../utils/cli-test-layout-chalk');

const DEV_INFRA_DOWN_MESSAGE = 'Infrastructure is not up. Run \'aifabrix up-infra\' first.';

/**
 * Ensures this developer's Postgres/Redis (strict scope) are healthy.
 *
 * @param {{ quietSuccess?: boolean }} [opts] - When `quietSuccess`, omit the success log (e.g. guided spinner shows it).
 * @returns {Promise<void>}
 * @throws {Error} When infra is not healthy
 */
async function assertDevInfraUp(opts = {}) {
  const quietSuccess = Boolean(opts.quietSuccess);
  const health = await infra.checkInfraHealth(undefined, { strict: true });
  const allHealthy = Object.values(health).every((status) => status === 'healthy');
  if (!allHealthy) {
    throw new Error(DEV_INFRA_DOWN_MESSAGE);
  }
  if (!quietSuccess) {
    logger.log(formatSuccessLine('Infrastructure is up'));
  }
}

module.exports = { assertDevInfraUp, DEV_INFRA_DOWN_MESSAGE };
