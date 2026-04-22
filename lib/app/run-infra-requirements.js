/**
 * Derives local infra (Postgres/Redis) needs from application.yaml for `run`.
 *
 * @fileoverview Shared by infra health skip and docker-run-without-compose fallback
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

/**
 * Reads application.yaml `requires` to decide which local infra services apply.
 * Missing `requires` → null (legacy: assume Postgres + Redis may be required).
 *
 * @param {Object} appConfig - Application configuration from application.yaml
 * @returns {null|{ needsPostgres: boolean, needsRedis: boolean }}
 */
function getAppInfraRequirements(appConfig) {
  const r = appConfig && appConfig.requires;
  if (!r || typeof r !== 'object') {
    return null;
  }
  const needsPostgres =
    r.database === true ||
    (Array.isArray(r.databases) && r.databases.length > 0);
  const needsRedis = r.redis === true;
  return { needsPostgres, needsRedis };
}

module.exports = { getAppInfraRequirements };
