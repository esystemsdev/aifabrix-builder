/**
 * JSON Pointer segment escaping for RFC 6902 paths.
 *
 * @fileoverview JSON Pointer helpers
 * @author AI Fabrix Team
 * @version 2.0.0
 */

/**
 * @param {string} token - Unescaped segment
 * @returns {string}
 */
function escapeJsonPointerToken(token) {
  return String(token).replace(/~/g, '~0').replace(/\//g, '~1');
}

/**
 * @param {...string} segments
 * @returns {string} Path starting with /
 */
function jsonPointerPath(...segments) {
  if (segments.length === 0) {
    return '';
  }
  return `/${segments.map(escapeJsonPointerToken).join('/')}`;
}

module.exports = {
  escapeJsonPointerToken,
  jsonPointerPath
};
