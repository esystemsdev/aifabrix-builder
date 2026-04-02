/**
 * @fileoverview Merge a Builder dev SSH Host alias into ~/.ssh/config (Mutagen / interactive SSH).
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs').promises;
const path = require('path');
const { ensureSshDir } = require('./ssh-key-helper');

/**
 * Derive SSH config Host alias: sync user + real hostname (e.g. dev01.builder02.local).
 * @param {string} sshUser - sync-ssh-user
 * @param {string} sshHost - sync-ssh-host (HostName)
 * @returns {string}
 */
function getDevSshHostAlias(sshUser, sshHost) {
  return `${sshUser}.${sshHost}`;
}

/**
 * Parse ssh config into Host blocks (lines before the first Host are ignored).
 * @param {string} content
 * @returns {{ aliases: string[], body: string[] }[]}
 */
function parseSshHostBlocks(content) {
  const lines = (content || '').split(/\r?\n/);
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const m = lines[i].match(/^Host\s+(.+?)\s*$/i);
    if (!m) {
      i++;
      continue;
    }
    const aliases = m[1].trim().split(/\s+/).filter(Boolean);
    i++;
    const body = [];
    while (i < lines.length && !/^Host\s/i.test(lines[i])) {
      body.push(lines[i]);
      i++;
    }
    blocks.push({ aliases, body });
  }
  return blocks;
}

/**
 * First value for a directive inside a Host block body (e.g. HostName, User).
 * @param {string[]} bodyLines
 * @param {string} directive - e.g. HostName
 * @returns {string|null}
 */
function getHostBlockDirective(bodyLines, directive) {
  const re = new RegExp(`^\\s+${directive}\\s+(.+)$`, 'i');
  for (const line of bodyLines) {
    const m = line.match(re);
    if (m) return m[1].trim();
  }
  return null;
}

/**
 * Find a Host block whose HostName and User match (exact trim match).
 * @param {string} content
 * @param {string} hostname
 * @param {string} user
 * @returns {{ aliases: string[], body: string[] }|null}
 */
function findMatchingHostBlockForUserHost(content, hostname, user) {
  for (const block of parseSshHostBlocks(content)) {
    const hn = getHostBlockDirective(block.body, 'HostName');
    const u = getHostBlockDirective(block.body, 'User');
    if (hn === hostname && u === user) {
      return block;
    }
  }
  return null;
}

/**
 * SSH Host alias to suggest for ssh(1) when a block already exists.
 * @param {{ aliases: string[] }} matchedBlock
 * @param {string} canonicalAlias - e.g. dev01.builder02.local
 * @returns {string}
 */
function resolveConnectAlias(matchedBlock, canonicalAlias) {
  if (matchedBlock.aliases.includes(canonicalAlias)) {
    return canonicalAlias;
  }
  return matchedBlock.aliases[0] || canonicalAlias;
}

/**
 * Replace an existing Host block for hostAlias, or append a new block at EOF.
 * @param {string} content - Existing ssh config (may be empty)
 * @param {string} hostAlias - Host keyword value (single alias)
 * @param {string} hostname - HostName directive
 * @param {string} user - User directive
 * @returns {string} Updated config
 */
function upsertSshHostBlock(content, hostAlias, hostname, user) {
  const lines = (content || '').split(/\r?\n/);
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const m = line.match(/^Host\s+(.+?)\s*$/i);
    if (m) {
      const aliases = m[1].trim().split(/\s+/).filter(Boolean);
      if (aliases.includes(hostAlias)) {
        i++;
        while (i < lines.length && !/^Host\s/i.test(lines[i])) {
          i++;
        }
        continue;
      }
    }
    out.push(line);
    i++;
  }
  const block = [
    `Host ${hostAlias}`,
    `    HostName ${hostname}`,
    `    User ${user}`,
    '    IdentitiesOnly yes'
  ].join('\n');
  const trimmed = out.join('\n').replace(/\s+$/, '');
  const prefix = trimmed.length ? `${trimmed}\n\n` : '';
  return `${prefix}${block}\n`;
}

/**
 * @param {string} sshUser
 * @param {string} sshHost
 * @returns {{ error: string }|{ user: string, host: string, hostAlias: string }}
 */
function parseEnsureSshInputs(sshUser, sshHost) {
  if (!sshUser || typeof sshUser !== 'string' || !sshUser.trim()) {
    return { error: 'missing ssh user' };
  }
  if (!sshHost || typeof sshHost !== 'string' || !sshHost.trim()) {
    return { error: 'missing ssh host' };
  }
  const user = sshUser.trim();
  const host = sshHost.trim();
  return { user, host, hostAlias: getDevSshHostAlias(user, host) };
}

/**
 * Ensure ~/.ssh/config contains a Host entry for interactive SSH / tooling.
 * @param {string} sshUser - SSH user (sync-ssh-user)
 * @param {string} sshHost - Real hostname (sync-ssh-host)
 * @param {string} [sshDir] - SSH directory (default ~/.ssh)
 * @returns {Promise<{ ok: boolean, configPath?: string, hostAlias?: string, error?: string, skippedDuplicate?: boolean }>}
 */
async function ensureDevSshConfigBlock(sshUser, sshHost, sshDir) {
  const parsed = parseEnsureSshInputs(sshUser, sshHost);
  if ('error' in parsed) {
    return { ok: false, error: parsed.error };
  }
  const { user, host, hostAlias } = parsed;
  const dir = ensureSshDir(sshDir);
  const configPath = path.join(dir, 'config');
  let existing = '';
  try {
    existing = await fs.readFile(configPath, 'utf8');
  } catch (e) {
    if (e.code !== 'ENOENT') {
      return { ok: false, error: e.message || String(e) };
    }
  }
  const matched = findMatchingHostBlockForUserHost(existing, host, user);
  if (matched) {
    return {
      ok: true,
      configPath,
      hostAlias: resolveConnectAlias(matched, hostAlias),
      skippedDuplicate: true
    };
  }
  const next = upsertSshHostBlock(existing, hostAlias, host, user);
  if (next === existing) {
    return { ok: true, configPath, hostAlias };
  }
  await fs.writeFile(configPath, next, { mode: 0o600 });
  return { ok: true, configPath, hostAlias };
}

module.exports = {
  getDevSshHostAlias,
  findMatchingHostBlockForUserHost,
  resolveConnectAlias,
  upsertSshHostBlock,
  ensureDevSshConfigBlock
};
