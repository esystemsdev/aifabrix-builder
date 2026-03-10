/**
 * Normalizes system file authentication.security and configuration keyvault entries.
 * @fileoverview Repair auth/config KV_* names and path-style kv:// values
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

const { systemKeyToKvPrefix, securityKeyToVar, kvEnvKeyToPath } = require('../utils/credential-secrets-env');

/**
 * Returns true if a kv value looks like legacy format (KeyVault suffix or no path segments).
 * @param {string} val - Value from authentication.security or configuration
 * @returns {boolean}
 */
function isLegacyKvValue(val) {
  if (typeof val !== 'string' || !val.trim().toLowerCase().startsWith('kv://')) return false;
  const after = val.trim().slice(5); // after 'kv://'
  return after.includes('KeyVault') || !after.includes('/');
}

/**
 * Normalizes authentication.security keyvault entries to path-style kv:// values (kv://systemKey/variable).
 * @param {Object} security - authentication.security object (mutated)
 * @param {string} prefix - KV prefix (e.g. 'HUBSPOT')
 * @param {string} systemKey - System key for path namespace
 * @param {string[]} changes - Array to append change descriptions to
 * @returns {boolean} True if any change was made
 */
function normalizeSecuritySection(security, prefix, systemKey, changes) {
  let updated = false;
  for (const key of Object.keys(security)) {
    const val = security[key];
    if (typeof val !== 'string' || !isLegacyKvValue(val)) continue;
    const envName = `KV_${prefix}_${securityKeyToVar(key)}`;
    const pathVal = kvEnvKeyToPath(envName, systemKey);
    if (pathVal) {
      security[key] = pathVal;
      changes.push(`authentication.security.${key}: normalized to path-style ${pathVal}`);
      updated = true;
    }
  }
  return updated;
}

/**
 * Normalizes configuration array keyvault entries to canonical KV_* names and path-style values.
 * @param {Object[]} config - configuration array (mutated)
 * @param {string} prefix - KV prefix (e.g. 'HUBSPOT')
 * @param {string} systemKey - System key for path namespace
 * @param {string[]} changes - Array to append change descriptions to
 * @returns {boolean} True if any change was made
 */
function normalizeConfigurationSection(config, prefix, systemKey, changes) {
  let updated = false;
  for (let i = 0; i < config.length; i++) {
    const entry = config[i];
    if (!entry || !entry.name || (entry.location !== 'keyvault' && !String(entry.name).startsWith('KV_'))) continue;
    const afterPrefix = entry.name.startsWith(`KV_${prefix}_`)
      ? entry.name.slice(`KV_${prefix}_`.length)
      : entry.name.replace(/^KV_[A-Z0-9]+_/, '');
    const normalizedVar = afterPrefix.replace(/_/g, '').toUpperCase();
    const canonicalName = `KV_${prefix}_${normalizedVar}`;
    const pathVal = kvEnvKeyToPath(canonicalName, systemKey);
    if (!pathVal) continue;
    const pathValWithoutPrefix = pathVal.replace(/^kv:\/\//, '');
    const valueLegacy = typeof entry.value === 'string' && (entry.value.includes('KeyVault') || !entry.value.includes('/'));
    if (entry.name !== canonicalName || (valueLegacy && entry.value !== pathValWithoutPrefix)) {
      config[i] = { ...entry, name: canonicalName, value: pathValWithoutPrefix, location: 'keyvault' };
      changes.push(`configuration: normalized ${entry.name} → ${canonicalName}, value → path-style`);
      updated = true;
    }
  }
  return updated;
}

/**
 * Normalizes system file authentication.security and configuration keyvault entries to canonical
 * KV_* names and path-style kv:// values so upload validation and env.template align.
 *
 * @param {Object} systemParsed - Parsed system config (mutated)
 * @param {string} systemKey - System key (e.g. 'hubspot')
 * @param {string[]} changes - Array to append change descriptions to
 * @returns {boolean} True if any change was made
 */
function normalizeSystemFileAuthAndConfig(systemParsed, systemKey, changes) {
  const prefix = systemKeyToKvPrefix(systemKey);
  if (!prefix) return false;
  const security = systemParsed.authentication?.security;
  let updated = (security && typeof security === 'object' && normalizeSecuritySection(security, prefix, systemKey, changes));
  const config = systemParsed.configuration;
  if (Array.isArray(config)) {
    updated = normalizeConfigurationSection(config, prefix, systemKey, changes) || updated;
  }
  return updated;
}

module.exports = { normalizeSystemFileAuthAndConfig, isLegacyKvValue };
