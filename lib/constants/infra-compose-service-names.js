/**
 * Infra compose service names accepted by `aifabrix restart` and {@link restartService}.
 *
 * @fileoverview Single source of truth for CLI help + validation
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

/** @type {ReadonlyArray<{ name: string, description: string }>} */
const RESTARTABLE_INFRA_SERVICES = Object.freeze([
  { name: 'postgres', description: 'PostgreSQL database' },
  { name: 'redis', description: 'Redis' },
  { name: 'pgadmin', description: 'pgAdmin 4 web UI (only if enabled when you ran up-infra)' },
  { name: 'redis-commander', description: 'Redis Commander web UI (only if enabled when you ran up-infra)' },
  { name: 'traefik', description: 'Traefik reverse proxy (only if enabled when you ran up-infra)' }
]);

/**
 * @returns {string[]} service names in compose order
 */
function getRestartableInfraServiceNames() {
  return RESTARTABLE_INFRA_SERVICES.map((s) => s.name);
}

/**
 * Aligned lines for Commander `addHelpText('after', …)`.
 * @returns {string}
 */
function buildRestartInfraHelpLines() {
  const col = 22;
  return RESTARTABLE_INFRA_SERVICES.map((s) => `  ${s.name.padEnd(col)}${s.description}`).join('\n');
}

module.exports = {
  RESTARTABLE_INFRA_SERVICES,
  getRestartableInfraServiceNames,
  buildRestartInfraHelpLines
};
