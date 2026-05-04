/**
 * @fileoverview Flatten datasource root `dimensions` for validate CLI output.
 * @author AI Fabrix Team
 * @version 1.0.0
 */

/**
 * @param {Array<{ fk?: string, dimension?: string }>} via - dimensionBinding.via
 * @returns {string}
 */
function formatFkViaChain(via) {
  return via
    .map(v =>
      v && typeof v.fk === 'string' && typeof v.dimension === 'string' ? `${v.fk}→${v.dimension}` : ''
    )
    .filter(Boolean)
    .join(', ');
}

/**
 * @param {unknown} actor - dimensionBinding.actor
 * @returns {string}
 */
function formatFkActorSuffix(actor) {
  return typeof actor === 'string' && actor.length > 0 ? ` (actor: ${actor})` : '';
}

/**
 * Flatten root dimensions: local → metadata.<field>, fk → fk:<chain> (actor: ...).
 * @param {Record<string, unknown>|null|undefined} root - datasource.dimensions
 * @returns {Record<string, string>}
 */
function flattenRootDimensionsForDisplay(root) {
  const rootFlat = {};
  if (!root || typeof root !== 'object' || Array.isArray(root)) {
    return rootFlat;
  }
  for (const [dimKey, binding] of Object.entries(root)) {
    if (!binding || typeof binding !== 'object') {
      continue;
    }
    if (typeof binding.field === 'string') {
      rootFlat[dimKey] = `metadata.${binding.field}`;
      continue;
    }
    if (binding.type !== 'fk' || !Array.isArray(binding.via)) {
      continue;
    }
    const chain = formatFkViaChain(binding.via);
    if (!chain) {
      continue;
    }
    rootFlat[dimKey] = `fk:${chain}${formatFkActorSuffix(binding.actor)}`;
  }
  return rootFlat;
}

module.exports = {
  flattenRootDimensionsForDisplay
};
