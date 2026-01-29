/**
 * Parse full image reference (registry/name:tag or name:tag) into { name, tag }
 *
 * @fileoverview Image reference parsing for compose and run overrides
 * @author AI Fabrix Team
 * @version 2.0.0
 */

/**
 * Parses full image reference (registry/name:tag or name:tag) into { name, tag }
 * @param {string} imageRef - Full image reference (e.g. myreg/keycloak:v1 or keycloak:latest)
 * @returns {{ name: string, tag: string }|null} Parsed name and tag, or null if invalid
 */
function parseImageOverride(imageRef) {
  if (!imageRef || typeof imageRef !== 'string') {
    return null;
  }
  const lastColon = imageRef.lastIndexOf(':');
  if (lastColon <= 0) {
    return { name: imageRef.trim(), tag: 'latest' };
  }
  const name = imageRef.substring(0, lastColon).trim();
  const tag = imageRef.substring(lastColon + 1).trim() || 'latest';
  return { name, tag };
}

module.exports = { parseImageOverride };
