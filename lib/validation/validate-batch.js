/**
 * Batch validation helpers for validate --integration / --builder.
 * @fileoverview Builds batch results and runs validation across multiple apps
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const { listIntegrationAppNames, listBuilderAppNames } = require('../utils/paths');

/**
 * Collects error strings from a single validation result (various shapes).
 * @param {Object} result - Single-app validation result
 * @returns {string[]} Error messages
 */
function collectResultErrors(result) {
  const errs = [];
  if (result.errors && Array.isArray(result.errors)) {
    errs.push(...result.errors);
  }
  if (result.application && result.application.errors && Array.isArray(result.application.errors)) {
    errs.push(...result.application.errors);
  }
  if (result.steps) {
    ['application', 'components', 'manifest'].forEach(step => {
      const s = result.steps[step];
      if (s && s.errors && Array.isArray(s.errors)) {
        errs.push(...s.errors);
      }
    });
  }
  return errs;
}

/**
 * Collects warning strings from a single validation result.
 * @param {Object} result - Single-app validation result
 * @returns {string[]} Warning messages
 */
function collectResultWarnings(result) {
  const w = [];
  if (result.warnings && Array.isArray(result.warnings)) {
    w.push(...result.warnings);
  }
  if (result.application && result.application.warnings && Array.isArray(result.application.warnings)) {
    w.push(...result.application.warnings);
  }
  if (result.steps) {
    ['application', 'components', 'manifest'].forEach(step => {
      const s = result.steps[step];
      if (s && s.warnings && Array.isArray(s.warnings)) {
        w.push(...s.warnings);
      }
    });
  }
  return w;
}

/**
 * Builds batch result from per-app results. Each item has appName and either result or error.
 * @param {Array<{appName: string, result?: Object, error?: string}>} items - Per-app results
 * @returns {{ batch: true, valid: boolean, results: Array, errors: string[], warnings: string[] }}
 */
function buildBatchResult(items) {
  const errors = [];
  const warnings = [];
  items.forEach(item => {
    if (item.error) {
      errors.push(`${item.appName}: ${item.error}`);
    } else if (item.result) {
      collectResultErrors(item.result).forEach(e => errors.push(`${item.appName}: ${e}`));
      collectResultWarnings(item.result).forEach(w => warnings.push(`${item.appName}: ${w}`));
    }
  });
  const valid = items.every(item => item.result && item.result.valid);
  return {
    batch: true,
    valid,
    results: items,
    errors,
    warnings
  };
}

/**
 * Validates all apps under integration/ (each as external system).
 * @async
 * @param {Function} validateAppOrFile - validateAppOrFile(appName, options) from validate.js
 * @param {Object} [options] - Validation options
 * @returns {Promise<{ batch: true, valid: boolean, results: Array, errors: string[], warnings: string[] }>}
 */
async function validateAllIntegrations(validateAppOrFile, options = {}) {
  const names = listIntegrationAppNames();
  const items = [];
  for (const appName of names) {
    try {
      const result = await validateAppOrFile(appName, options);
      items.push({ appName, result });
    } catch (error) {
      items.push({ appName, error: error.message || String(error) });
    }
  }
  return buildBatchResult(items);
}

/**
 * Validates all apps under builder/.
 * @async
 * @param {Function} validateAppOrFile - validateAppOrFile(appName, options) from validate.js
 * @param {Object} [options] - Validation options
 * @returns {Promise<{ batch: true, valid: boolean, results: Array, errors: string[], warnings: string[] }>}
 */
async function validateAllBuilderApps(validateAppOrFile, options = {}) {
  const names = listBuilderAppNames();
  const items = [];
  for (const appName of names) {
    try {
      const result = await validateAppOrFile(appName, options);
      items.push({ appName, result });
    } catch (error) {
      items.push({ appName, error: error.message || String(error) });
    }
  }
  return buildBatchResult(items);
}

/**
 * Validates all integration and builder apps in one run.
 * @async
 * @param {Function} validateAppOrFile - validateAppOrFile(appName, options) from validate.js
 * @param {Object} [options] - Validation options
 * @returns {Promise<{ batch: true, valid: boolean, results: Array, errors: string[], warnings: string[] }>}
 */
async function validateAll(validateAppOrFile, options = {}) {
  const [integrationResult, builderResult] = await Promise.all([
    validateAllIntegrations(validateAppOrFile, options),
    validateAllBuilderApps(validateAppOrFile, options)
  ]);
  const mergedResults = [...integrationResult.results, ...builderResult.results];
  return buildBatchResult(mergedResults);
}

module.exports = {
  buildBatchResult,
  collectResultErrors,
  collectResultWarnings,
  validateAllIntegrations,
  validateAllBuilderApps,
  validateAll
};
