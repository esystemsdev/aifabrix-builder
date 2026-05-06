/**
 * Clone testPayload.scenarios rows when copying a capability.
 *
 * @fileoverview Used by applyCapabilityCopy when includeTestPayload is true
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const { jsonPointerPath } = require('./json-pointer');
const { storageOpsKey } = require('./capability-storage-keys');

/**
 * @param {unknown} o
 * @returns {unknown}
 */
function deepClone(o) {
  return JSON.parse(JSON.stringify(o));
}

/**
 * @param {object[]} initialScenarios
 * @param {Set<string>} aliases
 * @param {string} resolvedAs
 * @param {boolean} overwrite
 * @returns {{ sourceMatches: object[], finalScenarios: object[] }}
 */
function computeScenarioClone(initialScenarios, aliases, resolvedAs, overwrite) {
  const sourceMatches = initialScenarios.filter((s) => s && aliases.has(s.operation));
  let base = [...initialScenarios];
  if (overwrite) {
    const lower = String(resolvedAs).toLowerCase();
    base = base.filter((s) => !s || String(s.operation).toLowerCase() !== lower);
  }
  const opKey = storageOpsKey(resolvedAs);
  const clones = sourceMatches.map((s) => {
    const c = deepClone(s);
    c.operation = opKey;
    return c;
  });
  return { sourceMatches, clones, finalScenarios: [...base, ...clones] };
}

/**
 * Dry-run JSON Patch: only the additions (incremental array append or new testPayload.scenarios).
 *
 * @param {boolean} hadTestPayloadRoot
 * @param {boolean} hadScenariosArray
 * @param {object[]} clones - New scenario rows only
 * @param {object[]} patchOperations
 * @returns {void}
 */
function pushTestPayloadScenarioPatches(
  hadTestPayloadRoot,
  hadScenariosArray,
  clones,
  patchOperations
) {
  if (clones.length === 0) {
    return;
  }
  const clonedRows = clones.map((c) => deepClone(c));

  if (!hadTestPayloadRoot) {
    patchOperations.push({
      op: 'add',
      path: '/testPayload',
      value: { scenarios: clonedRows }
    });
    return;
  }
  if (!hadScenariosArray) {
    patchOperations.push({
      op: 'add',
      path: jsonPointerPath('testPayload', 'scenarios'),
      value: clonedRows
    });
    return;
  }
  for (const row of clonedRows) {
    patchOperations.push({
      op: 'add',
      path: '/testPayload/scenarios/-',
      value: row
    });
  }
}

/**
 * @param {object} doc
 * @param {object} opts
 * @param {{ openapiKey: string, cipKey: string, logicalFrom: string }} fromKeys
 * @param {string} resolvedAs
 * @param {object[]} patchOperations
 * @param {string[]} updatedSections
 * @returns {void}
 */
function copyTestPayloadScenarios(doc, opts, fromKeys, resolvedAs, patchOperations, updatedSections) {
  if (!opts.includeTestPayload) {
    return;
  }
  const { openapiKey, cipKey, logicalFrom } = fromKeys;
  const aliases = new Set([logicalFrom, openapiKey, cipKey].filter(Boolean));

  const initialScenarios = Array.isArray(doc.testPayload?.scenarios)
    ? doc.testPayload.scenarios
    : [];

  const hadTestPayloadRoot =
    doc.testPayload !== undefined &&
    doc.testPayload !== null &&
    typeof doc.testPayload === 'object';
  const hadScenariosArray = hadTestPayloadRoot && Array.isArray(doc.testPayload.scenarios);

  const { sourceMatches, clones, finalScenarios } = computeScenarioClone(
    initialScenarios,
    aliases,
    resolvedAs,
    Boolean(opts.overwrite)
  );

  if (sourceMatches.length === 0) {
    updatedSections.push('testPayload.scenarios: (no rows matched source operation)');
    return;
  }

  if (!doc.testPayload) {
    doc.testPayload = {};
  }
  doc.testPayload.scenarios = finalScenarios;

  pushTestPayloadScenarioPatches(hadTestPayloadRoot, hadScenariosArray, clones, patchOperations);
  updatedSections.push(
    `testPayload.scenarios: +${sourceMatches.length} clone(s) → operation "${resolvedAs}"`
  );
}

module.exports = {
  copyTestPayloadScenarios
};
