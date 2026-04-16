/**
 * YAML merge utilities that preserve comments/blank lines for flat secrets files.
 *
 * Intended for `secrets.local.yaml` which is typically a simple `key: value` mapping
 * with user-owned comments. When the file isn't flat (complex YAML), callers should
 * fall back to a full YAML rewrite.
 *
 * @fileoverview Comment-preserving YAML merge helpers
 */

const keyLineRe = /^(\s*)([^#:\n]+):\s*(.*)$/;

function isCommentOrBlank(line) {
  const t = line.trim();
  return !t || t.startsWith('#');
}

function parseFlatKeyLine(line) {
  const m = line.match(keyLineRe);
  if (!m) return null;
  const indent = m[1] || '';
  const key = (m[2] || '').trim();
  const rest = m[3] || '';
  if (!key) return null;
  return { indent, key, rest };
}

function splitInlineComment(rest) {
  const idx = rest.indexOf(' #');
  return { inlineComment: idx >= 0 ? rest.slice(idx) : '' };
}

function formatYamlScalarForFlatLine(yaml, dumpOpts, value) {
  const dumped = yaml.dump({ _k: value }, dumpOpts);
  const lines = dumped.split(/\r?\n/).filter(Boolean);
  if (lines.length !== 1) return null;
  const idx = lines[0].indexOf(':');
  if (idx < 0) return null;
  return lines[0].slice(idx + 1).trimStart();
}

function appendMissingKeys(out, seen, desiredSecrets, yaml, dumpOpts) {
  for (const key of Object.keys(desiredSecrets)) {
    if (seen.has(key)) continue;
    const scalar = formatYamlScalarForFlatLine(yaml, dumpOpts, desiredSecrets[key]);
    if (scalar === null) return null;
    out.push(`${key}: ${scalar}`.trimEnd());
    seen.add(key);
  }
  return out;
}

function mergeExistingLinesPreservingComments(lines, desiredSecrets, yaml, dumpOpts) {
  const out = [];
  const seen = new Set();
  const encountered = new Set();

  for (const line of lines) {
    if (isCommentOrBlank(line)) {
      out.push(line);
      continue;
    }
    const parsed = parseFlatKeyLine(line);
    if (!parsed) return null;
    const { indent, key, rest } = parsed;

    if (encountered.has(key)) continue;
    encountered.add(key);

    if (!Object.prototype.hasOwnProperty.call(desiredSecrets, key)) continue;

    const { inlineComment } = splitInlineComment(rest);
    const scalar = formatYamlScalarForFlatLine(yaml, dumpOpts, desiredSecrets[key]);
    if (scalar === null) return null;
    seen.add(key);
    out.push(`${indent}${key}: ${scalar}${inlineComment}`.trimEnd());
  }

  return { out, seen };
}

/**
 * Merge a desired flat secrets object into existing file content while preserving comments/blank lines.
 * Supports deletes: keys present in existing content but absent in desired are removed.
 *
 * Returns null when content cannot be treated as a flat key-value file.
 *
 * @param {string} existingContent
 * @param {Record<string, any>} desiredSecrets
 * @param {{ yaml: any, dumpOpts: any }} yamlCtx
 * @returns {string|null}
 */
function mergeFlatSecretsYamlPreservingComments(existingContent, desiredSecrets, yamlCtx) {
  if (typeof existingContent !== 'string') return null;
  if (!desiredSecrets || typeof desiredSecrets !== 'object') return null;
  if (!yamlCtx || !yamlCtx.yaml) return null;

  const { yaml, dumpOpts } = yamlCtx;
  const lines = existingContent.split(/\r?\n/);
  const merged = mergeExistingLinesPreservingComments(lines, desiredSecrets, yaml, dumpOpts);
  if (!merged) return null;

  const appended = appendMissingKeys(merged.out, merged.seen, desiredSecrets, yaml, dumpOpts);
  if (appended === null) return null;
  return appended.join('\n');
}

module.exports = { mergeFlatSecretsYamlPreservingComments };

