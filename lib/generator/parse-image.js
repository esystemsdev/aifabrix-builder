/**
 * Parses image reference string into components.
 * @fileoverview Image reference parser for deployment JSON
 * @author AI Fabrix Team
 * @version 2.0.0
 */

/**
 * Parses image reference string into components
 * @function parseImageReference
 * @param {string} imageString - Full image string (e.g., "registry/name:tag")
 * @returns {Object} Object with registry, name, and tag
 */
function parseImageReference(imageString) {
  if (!imageString || typeof imageString !== 'string') {
    return { registry: null, name: null, tag: 'latest' };
  }

  const parts = imageString.split('/');
  let registry = null;
  let nameAndTag = imageString;

  if (parts.length > 1 && parts[0].includes('.')) {
    registry = parts[0];
    nameAndTag = parts.slice(1).join('/');
  }

  const tagIndex = nameAndTag.lastIndexOf(':');
  const name = tagIndex !== -1 ? nameAndTag.substring(0, tagIndex) : nameAndTag;
  const tag = tagIndex !== -1 ? nameAndTag.substring(tagIndex + 1) : 'latest';

  return { registry, name, tag };
}

module.exports = { parseImageReference };
