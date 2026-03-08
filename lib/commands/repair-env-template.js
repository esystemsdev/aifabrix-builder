/**
 * Helpers for repairing env.template from system config (KV_* names, path-style kv://).
 * @fileoverview Repair env.template to match system file
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

const path = require('path');
const fs = require('fs');
const { systemKeyToKvPrefix, kvEnvKeyToPath, securityKeyToVar } = require('../utils/credential-secrets-env');
const { extractEnvTemplate } = require('../generator/split');

/**
 * Normalizes a keyvault config entry to canonical KV_* name and path-style value.
 * @param {Object} entry - Config entry with name, value, location
 * @param {string} prefix - KV prefix (e.g. HUBSPOT)
 * @returns {{ name: string, value: string }|null}
 */
function normalizeKeyvaultEntry(entry, prefix) {
  const afterPrefix = entry.name.startsWith(`KV_${prefix}_`)
    ? entry.name.slice(`KV_${prefix}_`.length)
    : entry.name.replace(/^KV_[A-Z0-9]+_/, '');
  const normalizedVar = afterPrefix.replace(/_/g, '').toUpperCase();
  const normalizedName = `KV_${prefix}_${normalizedVar}`;
  const pathVal = kvEnvKeyToPath(normalizedName);
  if (!pathVal) return null;
  return {
    name: normalizedName,
    value: pathVal.replace(/^kv:\/\//, ''),
    location: 'keyvault'
  };
}

/**
 * Adds effective config entries from system configuration array.
 * @param {Array} effective - Mutable result array
 * @param {Array} config - System configuration array
 * @param {string} prefix - KV prefix
 * @param {Set<string>} seenNames - Mutable set of names already added
 */
function addFromConfiguration(effective, config, prefix, seenNames) {
  for (const entry of config) {
    if (!entry || !entry.name) continue;
    if (entry.location === 'keyvault') {
      const normalized = normalizeKeyvaultEntry(entry, prefix);
      if (normalized && !seenNames.has(normalized.name)) {
        effective.push(normalized);
        seenNames.add(normalized.name);
      }
    } else if (!seenNames.has(entry.name)) {
      effective.push({
        name: entry.name,
        value: String(entry.value ?? ''),
        location: entry.location
      });
      seenNames.add(entry.name);
    }
  }
}

/**
 * Adds effective config entries from authentication.security.
 * @param {Array} effective - Mutable result array
 * @param {Object} systemParsed - Parsed system config
 * @param {string} prefix - KV prefix
 * @param {Set<string>} seenNames - Mutable set of names already added
 */
function addFromAuthSecurity(effective, systemParsed, prefix, seenNames) {
  const security = systemParsed.authentication?.security;
  if (!security || typeof security !== 'object') return;
  for (const key of Object.keys(security)) {
    const envName = `KV_${prefix}_${securityKeyToVar(key)}`;
    if (seenNames.has(envName)) continue;
    const pathVal = kvEnvKeyToPath(envName);
    if (pathVal) {
      effective.push({
        name: envName,
        value: pathVal.replace(/^kv:\/\//, ''),
        location: 'keyvault'
      });
      seenNames.add(envName);
    }
  }
}

/**
 * Builds effective configuration array from system (KV_* names, path-style kv://).
 * @param {Object} systemParsed - Parsed system config
 * @param {string} systemKey - System key (e.g. 'hubspot')
 * @returns {Array<{ name: string, value: string, location?: string }>}
 */
function buildEffectiveConfiguration(systemParsed, systemKey) {
  const effective = [];
  const prefix = systemKeyToKvPrefix(systemKey);
  if (!prefix) return effective;
  const seenNames = new Set();
  const config = Array.isArray(systemParsed.configuration) ? systemParsed.configuration : [];
  addFromConfiguration(effective, config, prefix, seenNames);
  addFromAuthSecurity(effective, systemParsed, prefix, seenNames);
  return effective;
}

/**
 * Builds map of env key -> full line (KEY=value) from effective config.
 * @param {Array} effective - Effective configuration array
 * @returns {Map<string, string>}
 */
function buildExpectedByKey(effective) {
  const expectedByKey = new Map();
  const lines = extractEnvTemplate(effective).split('\n').filter(Boolean);
  for (const line of lines) {
    const eq = line.indexOf('=');
    if (eq > 0) {
      const key = line.substring(0, eq).trim();
      expectedByKey.set(key, `${key}=${line.substring(eq + 1)}`);
    }
  }
  return expectedByKey;
}

/**
 * Creates env.template when missing. Returns true if created (and change pushed).
 * @param {string} envPath - Path to env.template
 * @param {Map<string, string>} expectedByKey - Expected key->line map
 * @param {boolean} dryRun - If true, do not write
 * @param {string[]} changes - Array to append to
 * @returns {boolean}
 */
function createEnvTemplateIfMissing(envPath, expectedByKey, dryRun, changes) {
  if (fs.existsSync(envPath)) return false;
  const lines = Array.from(expectedByKey.values());
  const content = lines.join('\n');
  if (!content) return false;
  if (!dryRun) {
    fs.writeFileSync(envPath, content + '\n', { mode: 0o644, encoding: 'utf8' });
  }
  changes.push('Created env.template from system configuration');
  return true;
}

/**
 * Processes one line: keep as-is or replace with expected. Mutates updatedLines, keysWritten, changed.
 * When key is MISO_CONTROLLER_URL and it already exists, the existing value is preserved (only add when missing).
 * @param {string} line - Current line
 * @param {Map<string, string>} expectedByKey - Expected key->line map
 * @param {string[]} updatedLines - Mutable output lines
 * @param {Set<string>} keysWritten - Mutable set of keys written
 * @param {{ value: boolean }} changedRef - Mutable changed flag
 */
function processLine(line, expectedByKey, updatedLines, keysWritten, changedRef) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) {
    updatedLines.push(line);
    return;
  }
  const eq = line.indexOf('=');
  if (eq <= 0) {
    updatedLines.push(line);
    return;
  }
  const key = line.substring(0, eq).trim();
  if (expectedByKey.has(key)) {
    if (key === 'MISO_CONTROLLER_URL') {
      updatedLines.push(line);
    } else {
      const newLine = expectedByKey.get(key);
      if (line !== newLine) changedRef.value = true;
      updatedLines.push(newLine);
    }
    keysWritten.add(key);
  } else {
    updatedLines.push(line);
  }
}

/**
 * Merges existing env.template content with expected key=value lines.
 * Preserves comments, blank lines, and vars not in expectedByKey.
 * @param {string} content - Current file content
 * @param {Map<string, string>} expectedByKey - Expected key->line map
 * @returns {{ output: string, changed: boolean }}
 */
function mergeEnvTemplateContent(content, expectedByKey) {
  const lines = content.split(/\r?\n/);
  const updatedLines = [];
  const keysWritten = new Set();
  const changedRef = { value: false };

  for (const line of lines) {
    processLine(line, expectedByKey, updatedLines, keysWritten, changedRef);
  }
  for (const key of expectedByKey.keys()) {
    if (!keysWritten.has(key)) {
      updatedLines.push(expectedByKey.get(key));
      changedRef.value = true;
    }
  }

  const output = updatedLines.join('\n') + (updatedLines.length > 0 ? '\n' : '');
  return { output, changed: changedRef.value };
}

/**
 * Repairs env.template so KV_ names and path-style kv:// values match the system file.
 * @param {string} appPath - Application directory path
 * @param {Object} systemParsed - Parsed system config
 * @param {string} systemKey - System key
 * @param {boolean} dryRun - If true, do not write
 * @param {string[]} changes - Array to append change descriptions to
 * @returns {boolean} True if env.template was repaired or created
 */
function repairEnvTemplate(appPath, systemParsed, systemKey, dryRun, changes) {
  const effective = buildEffectiveConfiguration(systemParsed, systemKey);
  const expectedByKey = buildExpectedByKey(effective);
  const envPath = path.join(appPath, 'env.template');

  if (createEnvTemplateIfMissing(envPath, expectedByKey, dryRun, changes)) {
    return true;
  }
  if (!fs.existsSync(envPath)) {
    return false;
  }

  const content = fs.readFileSync(envPath, 'utf8');
  const { output, changed } = mergeEnvTemplateContent(content, expectedByKey);

  if (changed && !dryRun) {
    fs.writeFileSync(envPath, output, { mode: 0o644, encoding: 'utf8' });
  }
  if (changed) {
    changes.push('Repaired env.template (KV_* names and path-style kv:// values)');
    return true;
  }
  return false;
}

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
 * Normalizes authentication.security values to path-style kv://.
 * @param {Object} security - authentication.security object (mutated)
 * @param {string} prefix - KV prefix (e.g. 'HUBSPOT')
 * @param {string[]} changes - Array to append change descriptions to
 * @returns {boolean} True if any change was made
 */
function normalizeSecuritySection(security, prefix, changes) {
  let updated = false;
  for (const key of Object.keys(security)) {
    const val = security[key];
    if (typeof val !== 'string' || !isLegacyKvValue(val)) continue;
    const envName = `KV_${prefix}_${securityKeyToVar(key)}`;
    const pathVal = kvEnvKeyToPath(envName);
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
 * @param {string[]} changes - Array to append change descriptions to
 * @returns {boolean} True if any change was made
 */
function normalizeConfigurationSection(config, prefix, changes) {
  let updated = false;
  for (let i = 0; i < config.length; i++) {
    const entry = config[i];
    if (!entry || !entry.name || (entry.location !== 'keyvault' && !String(entry.name).startsWith('KV_'))) continue;
    const afterPrefix = entry.name.startsWith(`KV_${prefix}_`)
      ? entry.name.slice(`KV_${prefix}_`.length)
      : entry.name.replace(/^KV_[A-Z0-9]+_/, '');
    const normalizedVar = afterPrefix.replace(/_/g, '').toUpperCase();
    const canonicalName = `KV_${prefix}_${normalizedVar}`;
    const pathVal = kvEnvKeyToPath(canonicalName);
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
 * Normalizes system file authentication.security and configuration keyvault entries.
 * @param {Object} systemParsed - Parsed system config (mutated)
 * @param {string} systemKey - System key (e.g. 'hubspot')
 * @param {string[]} changes - Array to append change descriptions to
 * @returns {boolean} True if any change was made
 */
function normalizeSystemFileAuthAndConfig(systemParsed, systemKey, changes) {
  const prefix = systemKeyToKvPrefix(systemKey);
  if (!prefix) return false;
  const security = systemParsed.authentication?.security;
  let updated = (security && typeof security === 'object' && normalizeSecuritySection(security, prefix, changes));
  const config = systemParsed.configuration;
  if (Array.isArray(config)) {
    updated = normalizeConfigurationSection(config, prefix, changes) || updated;
  }
  return updated;
}

module.exports = {
  buildEffectiveConfiguration,
  repairEnvTemplate,
  normalizeSystemFileAuthAndConfig
};
