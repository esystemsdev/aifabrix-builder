/**
 * AI Fabrix Builder Secrets Management
 *
 * This module handles secret resolution and environment file generation.
 * Resolves kv:// references from secrets files and generates .env files.
 *
 * Implementation is split across secrets-load.js, secrets-env-content.js, secrets-admin-env.js, secrets-names.js.
 *
 * @fileoverview Secret resolution and environment management for AI Fabrix Builder
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

const { validateSecrets } = require('../utils/secrets-helpers');
const {
  generateMissingSecrets,
  createDefaultSecrets
} = require('../utils/secrets-generator');
const { loadSecrets } = require('./secrets-load');
const {
  resolveKvReferences,
  generateEnvContent,
  generateEnvFile,
  parseEnvContentToMap,
  mergeEnvMapIntoContent
} = require('./secrets-env-content');
const {
  formatAdminSecretsContent,
  generateAdminSecretsEnv
} = require('./secrets-admin-env');
const { getCanonicalSecretName } = require('./secrets-names');

module.exports = {
  loadSecrets,
  resolveKvReferences,
  generateEnvFile,
  generateEnvContent,
  generateMissingSecrets,
  generateAdminSecretsEnv,
  formatAdminSecretsContent,
  validateSecrets,
  createDefaultSecrets,
  getCanonicalSecretName,
  parseEnvContentToMap,
  mergeEnvMapIntoContent
};
