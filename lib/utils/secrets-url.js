/**
 * URL and service port resolution utilities
 *
 * @fileoverview Resolve ports in URLs using env-config and service maps (docker context)
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

const { buildHostnameToServiceMap, resolveUrlPort } = require('./secrets-utils');
const { loadEnvConfig } = require('./env-config-loader');

/**
 * Resolve service ports inside URLs for docker environment (.env content)
 * @async
 * @function resolveServicePortsInEnvContent
 * @param {string} envContent - .env content
 * @param {string} environment - Environment name
 * @returns {Promise<string>} Updated content
 */
async function resolveServicePortsInEnvContent(envContent, environment) {
  if (environment !== 'docker') {
    return envContent;
  }
  const envConfig = await loadEnvConfig();
  const dockerHosts = envConfig.environments.docker || {};
  const hostnameToService = buildHostnameToServiceMap(dockerHosts);
  const urlPattern = /(https?:\/\/)([a-zA-Z0-9.-]+):(\d+)([^\s\n]*)?/g;
  return envContent.replace(urlPattern, (match, protocol, hostname, port, urlPath = '') => {
    return resolveUrlPort(protocol, hostname, port, urlPath || '', hostnameToService);
  });
}

module.exports = {
  resolveServicePortsInEnvContent
};

