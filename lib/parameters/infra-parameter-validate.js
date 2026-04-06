/**
 * @fileoverview Validate env.template kv:// keys against infra.parameter.yaml catalog
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs');
const path = require('path');
const { listAppDirsForDiscovery, extractKvKeysFromEnvContent } = require('./infra-kv-discovery');

/**
 * Validate that every kv:// key in workspace env.template files has catalog coverage.
 * @param {{ findEntryForKey: Function }} catalog - Loaded catalog API
 * @param {object} pathsUtil - paths module
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateWorkspaceKvRefsAgainstCatalog(catalog, pathsUtil) {
  const errors = [];
  const cwd = process.cwd();

  for (const { dir } of listAppDirsForDiscovery(pathsUtil)) {
    const envPath = path.join(dir, 'env.template');
    if (!fs.existsSync(envPath)) continue;
    let content;
    try {
      content = fs.readFileSync(envPath, 'utf8');
    } catch (e) {
      errors.push(`Could not read ${envPath}: ${e.message}`);
      continue;
    }
    const rel = path.relative(cwd, envPath) || envPath;
    for (const k of extractKvKeysFromEnvContent(content)) {
      if (!catalog.findEntryForKey(k)) {
        errors.push(`Unknown kv:// key "${k}" in ${rel} — extend lib/schema/infra.parameter.yaml`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
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
