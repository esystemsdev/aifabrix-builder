/**
 * Rewrite intra-document capability references when cloning an operation.
 *
 * @fileoverview Structured reference rewrite (no blind string replace)
 * @author AI Fabrix Team
 * @version 2.0.0
 */

/** Keys whose string values may reference another capability name */
const REFERENCE_KEYS = new Set([
  'openapiRef',
  'operation',
  'operationRef',
  'capability',
  'dependsOn',
  'sourceOperation'
]);

/**
 * Deep-walk `node` and replace reference string values `from` → `to`.
 *
 * @param {unknown} node - JSON subtree (openapi operation or CIP operation)
 * @param {string} from - Source capability key
 * @param {string} to - Target capability key
 * @returns {void}
 */
function rewriteCapabilityReferences(node, from, to) {
  if (node === null || node === undefined) {
    return;
  }
  if (Array.isArray(node)) {
    node.forEach((item) => rewriteCapabilityReferences(item, from, to));
    return;
  }
  if (typeof node !== 'object') {
    return;
  }
  for (const key of Object.keys(node)) {
    const val = node[key];
    if (REFERENCE_KEYS.has(key) && val === from) {
      node[key] = to;
    } else if (typeof val === 'object') {
      rewriteCapabilityReferences(val, from, to);
    }
  }
}

module.exports = {
  rewriteCapabilityReferences,
  REFERENCE_KEYS
};
