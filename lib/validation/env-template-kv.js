/**
 * env.template kv:// reference validation (syntax only).
 * Skips comment and empty lines. Used by validator.validateEnvTemplate.
 *
 * @fileoverview Kv reference validation for env.template lines
 * @author AI Fabrix Team
 * @version 2.0.0
 */

/**
 * Validates kv:// references in env.template lines; pushes errors into the given array.
 * Skips empty and comment (#) lines.
 *
 * @function validateKvReferencesInLines
 * @param {string[]} lines - Lines of env.template content
 * @param {string[]} errors - Array to push error messages into
 */
function validateKvReferencesInLines(lines, errors) {
  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      return;
    }
    const matches = line.match(/kv:\/\/[^\s]*/g) || [];
    for (const fullRef of matches) {
      const pathMatch = fullRef.match(/^kv:\/\/(.*)$/);
      const pathStr = pathMatch ? pathMatch[1] : '';
      const invalid = !pathStr || pathStr.startsWith('/') || pathStr.endsWith('/');
      if (invalid) {
        const hint = !pathStr
          ? 'path is empty (use kv://secret-key)'
          : pathStr.startsWith('/')
            ? 'path must not start with / (use kv://secret-key not kv:///secret-key)'
            : 'path must not end with / (use kv://secret-key not kv://secret-key/)';
        errors.push(`env.template line ${index + 1}: Invalid kv:// reference "${fullRef}" - ${hint}`);
      }
    }
  });
}

module.exports = { validateKvReferencesInLines };
