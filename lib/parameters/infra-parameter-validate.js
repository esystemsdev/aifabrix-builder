/**
 * @fileoverview Validate env.template kv:// keys against infra.parameter.yaml catalog
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const { nodeFs } = require('../internal/node-fs');
const path = require('path');
const {
  listBuilderAppDirsForDiscovery,
  extractKvKeysFromEnvContent
} = require('./infra-kv-discovery');

function _scanEnvTemplate(fs, cwd, envPath) {
  const rel = path.relative(cwd, envPath) || envPath;
  try {
    const content = fs.readFileSync(envPath, 'utf8');
    return { rel, keys: extractKvKeysFromEnvContent(content), readError: null };
  } catch (e) {
    return { rel, keys: [], readError: e };
  }
}

function _scanBuilderEnvTemplates(catalog, pathsUtil) {
  const cwd = process.cwd();
  const fs = nodeFs();
  const errors = [];
  const scannedApps = [];
  const scannedEnvTemplates = [];
  const kvKeysUnique = new Set();

  for (const { dir } of listBuilderAppDirsForDiscovery(pathsUtil)) {
    scannedApps.push(path.relative(cwd, dir) || dir);
    const envPath = path.join(dir, 'env.template');
    if (!fs.existsSync(envPath)) continue;
    const scan = _scanEnvTemplate(fs, cwd, envPath);
    scannedEnvTemplates.push(scan.rel);
    if (scan.readError) {
      errors.push({
        key: '__read_error__',
        envTemplatePath: scan.rel,
        message: scan.readError.message
      });
      continue;
    }
    for (const k of scan.keys) {
      kvKeysUnique.add(k);
      if (!catalog.findEntryForKey(k)) {
        errors.push({ key: k, envTemplatePath: scan.rel });
      }
    }
  }

  return { errors, scannedApps, scannedEnvTemplates, kvKeysUnique };
}

/**
 * Validate that every kv:// key under builder app env.template files has catalog coverage.
 * Integration apps under integration/ are not scanned (they often use ad-hoc kv keys).
 * @param {{ findEntryForKey: Function }} catalog - Loaded catalog API
 * @param {object} pathsUtil - paths module
 * @returns {{
 *   valid: boolean,
 *   errors: { key: string, envTemplatePath: string, message?: string }[],
 *   summary: {
 *     scannedApps: string[],
 *     scannedEnvTemplates: string[],
 *     kvKeysUnique: string[],
 *     kvKeysCount: number
 *   }
 * }}
 */
function validateWorkspaceKvRefsAgainstCatalog(catalog, pathsUtil) {
  const { errors, scannedApps, scannedEnvTemplates, kvKeysUnique } = _scanBuilderEnvTemplates(
    catalog,
    pathsUtil
  );

  return {
    valid: errors.length === 0,
    errors,
    summary: {
      scannedApps: scannedApps.sort(),
      scannedEnvTemplates: scannedEnvTemplates.sort(),
      kvKeysUnique: [...kvKeysUnique].sort(),
      kvKeysCount: kvKeysUnique.size
    }
  };
}

/**
 * Validate catalog entries marked requiredForLocal have a non-empty generator type.
 * @param {object} doc - Parsed catalog root
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateCatalogRequiredGenerators(doc) {
  const errors = [];
  const params = doc && Array.isArray(doc.parameters) ? doc.parameters : [];
  params.forEach((entry, i) => {
    if (!entry.requiredForLocal) return;
    const t = entry.generator && entry.generator.type;
    if (!t) {
      errors.push(`parameters[${i}] requiredForLocal but generator.type is missing`);
    }
  });
  return { valid: errors.length === 0, errors };
}

module.exports = {
  validateWorkspaceKvRefsAgainstCatalog,
  validateCatalogRequiredGenerators
};
