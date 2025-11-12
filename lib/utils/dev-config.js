/**
 * Developer Configuration Utilities
 *
 * This module provides utilities for calculating developer-specific ports
 * based on developer ID. Ports are offset by (developer-id * 100).
 *
 * @fileoverview Developer configuration and port calculation utilities
 * @author AI Fabrix Team
 * @version 2.0.0
 */

/**
 * Base ports for infrastructure and applications
 * These are the default ports before any developer offset
 */
const BASE_PORTS = {
  app: 3000,
  postgres: 5432,
  redis: 6379,
  pgadmin: 5050,
  redisCommander: 8081
};

/**
 * Calculates developer-specific ports based on developer ID
 * Formula: basePort + (developerId * 100)
 * Developer ID: 0 = default infra (base ports), > 0 = developer-specific (offset ports)
 *
 * @function getDevPorts
 * @param {number} developerId - Developer ID (0 = default infra, 1, 2, 3, etc. = developer-specific). Must be a number.
 * @returns {Object} Object with calculated ports for all services
 *
 * @example
 * const ports = getDevPorts(0); // Default infra
 * // Returns: { app: 3000, postgres: 5432, redis: 6379, pgadmin: 5050, redisCommander: 8081 }
 * const ports = getDevPorts(1); // Developer-specific
 * // Returns: { app: 3100, postgres: 5532, redis: 6479, pgadmin: 5150, redisCommander: 8181 }
 */
function getDevPorts(developerId) {
  // Only accept numbers, reject strings and other types
  if (typeof developerId !== 'number') {
    throw new Error('Developer ID must be a positive number');
  }

  // Handle invalids
  if (developerId === undefined || developerId === null || Number.isNaN(developerId)) {
    throw new Error('Developer ID must be a positive number');
  }
  if (developerId < 0 || !Number.isInteger(developerId)) {
    throw new Error('Developer ID must be a positive number');
  }

  const idNum = developerId;

  // Developer ID 0 = default infra (base ports, no offset)
  if (idNum === 0) {
    return { ...BASE_PORTS };
  }

  // Developer ID > 0 = developer-specific (add offset)
  const offset = idNum * 100;

  return {
    app: BASE_PORTS.app + offset,
    postgres: BASE_PORTS.postgres + offset,
    redis: BASE_PORTS.redis + offset,
    pgadmin: BASE_PORTS.pgadmin + offset,
    redisCommander: BASE_PORTS.redisCommander + offset
  };
}

/**
 * Gets base ports (for reference/documentation)
 * @returns {Object} Base ports object
 */
function getBasePorts() {
  return { ...BASE_PORTS };
}

module.exports = {
  getDevPorts,
  getBasePorts
};

