/**
 * Canonical infra host/port defaults (formerly lib/schema/env-config.yaml).
 *
 * @fileoverview Builder-owned defaults for docker/local env interpolation
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

/** @type {Object} Same shape as legacy env-config.yaml */
const DEFAULT_ENV_CONFIG = {
  environments: {
    docker: {
      DB_HOST: 'postgres',
      DB_PORT: 5432,
      REDIS_HOST: 'redis',
      REDIS_PORT: 6379,
      MISO_HOST: 'miso-controller',
      MISO_PORT: 3000,
      MISO_PUBLIC_PORT: 3000,
      KEYCLOAK_HOST: 'keycloak',
      KEYCLOAK_PORT: 8080,
      KEYCLOAK_PUBLIC_PORT: 8082,
      MORI_HOST: 'mori-controller',
      MORI_PORT: 3004,
      OPENWEBUI_HOST: 'openwebui',
      OPENWEBUI_PORT: 3003,
      FLOWISE_HOST: 'flowise',
      FLOWISE_PORT: 3002,
      DATAPLANE_HOST: 'dataplane',
      DATAPLANE_PORT: 3001,
      DATAPLANE_PUBLIC_PORT: 3001,
      NODE_ENV: 'production',
      PYTHONUNBUFFERED: 1,
      PYTHONDONTWRITEBYTECODE: 1,
      PYTHONIOENCODING: 'utf-8'
    },
    local: {
      DB_HOST: 'localhost',
      DB_PORT: 5432,
      REDIS_HOST: 'localhost',
      REDIS_PORT: 6379,
      MISO_HOST: 'localhost',
      MISO_PORT: 3010,
      MISO_PUBLIC_PORT: 3010,
      KEYCLOAK_HOST: 'localhost',
      KEYCLOAK_PORT: 8082,
      KEYCLOAK_PUBLIC_PORT: 8082,
      MORI_HOST: 'localhost',
      MORI_PORT: 3014,
      OPENWEBUI_HOST: 'localhost',
      OPENWEBUI_PORT: 3013,
      FLOWISE_HOST: 'localhost',
      FLOWISE_PORT: 3012,
      DATAPLANE_HOST: 'localhost',
      DATAPLANE_PORT: 3011,
      DATAPLANE_PUBLIC_PORT: 3011,
      NODE_ENV: 'development',
      PYTHONUNBUFFERED: 1,
      PYTHONDONTWRITEBYTECODE: 1,
      PYTHONIOENCODING: 'utf-8'
    }
  }
};

/**
 * Deep clone of default env-config (docker/local hosts and ports).
 * @returns {Object}
 */
function getDefaultEnvConfig() {
  return JSON.parse(JSON.stringify(DEFAULT_ENV_CONFIG));
}

module.exports = {
  getDefaultEnvConfig,
  DEFAULT_ENV_CONFIG
};
