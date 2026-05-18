/**
 * Internal semver comparator (no `semver` npm dependency).
 *
 * Supports `MAJOR.MINOR.PATCH` and optional prerelease suffix
 * `-<prerelease>` (e.g. `2.45.0-beta.1`). Optional leading `v` is tolerated.
 * Prerelease versions always rank **before** the same MAJOR.MINOR.PATCH
 * without a prerelease (semver §11.3).
 *
 * @fileoverview Internal semver compare for Builder CLI compatibility gate
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

const SEMVER_PATTERN = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z][-0-9A-Za-z.]*))?$/;

/**
 * Parse a semver-like string into a comparable structure.
 * @param {string} input - Version string (e.g. "2.45.0" or "v2.45.0-beta.1")
 * @returns {{ major:number, minor:number, patch:number, prerelease:string[] }|null}
 *          Parsed parts or null when input does not match the supported grammar
 */
function parseSemver(input) {
  if (typeof input !== 'string') {
    return null;
  }
  const match = SEMVER_PATTERN.exec(input.trim());
  if (!match) {
    return null;
  }
  const [, major, minor, patch, prerelease] = match;
  return {
    major: Number(major),
    minor: Number(minor),
    patch: Number(patch),
    prerelease: prerelease ? prerelease.split('.') : []
  };
}

/**
 * Check whether a string is a supported semver (incl. optional prerelease).
 * @param {string} input
 * @returns {boolean}
 */
function isValidSemver(input) {
  return parseSemver(input) !== null;
}

/**
 * Compare two prerelease identifier arrays per semver §11.4.
 * @private
 * @param {string[]} a
 * @param {string[]} b
 * @returns {-1|0|1}
 */
function comparePrereleaseIds(a, b) {
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i += 1) {
    if (a[i] === undefined) return -1;
    if (b[i] === undefined) return 1;
    const aNum = /^\d+$/.test(a[i]);
    const bNum = /^\d+$/.test(b[i]);
    if (aNum && bNum) {
      const diff = Number(a[i]) - Number(b[i]);
      if (diff !== 0) return diff > 0 ? 1 : -1;
    } else if (aNum) {
      return -1;
    } else if (bNum) {
      return 1;
    } else if (a[i] !== b[i]) {
      return a[i] > b[i] ? 1 : -1;
    }
  }
  return 0;
}

/**
 * Compare two semver strings.
 *
 * @param {string} a
 * @param {string} b
 * @returns {-1|0|1}  `-1` when `a < b`, `0` when equal, `1` when `a > b`
 * @throws {Error} When either argument is not a valid semver
 *
 * @example
 *   compareSemver('2.44.0', '2.45.0') === -1
 *   compareSemver('2.45.0', '2.45.0') === 0
 *   compareSemver('2.45.0-beta.1', '2.45.0') === -1
 */
function compareSemver(a, b) {
  const parsedA = parseSemver(a);
  const parsedB = parseSemver(b);
  if (!parsedA) throw new Error(`Invalid semver: "${a}"`);
  if (!parsedB) throw new Error(`Invalid semver: "${b}"`);

  if (parsedA.major !== parsedB.major) return parsedA.major > parsedB.major ? 1 : -1;
  if (parsedA.minor !== parsedB.minor) return parsedA.minor > parsedB.minor ? 1 : -1;
  if (parsedA.patch !== parsedB.patch) return parsedA.patch > parsedB.patch ? 1 : -1;

  // §11.3 — Prerelease has lower precedence than the same MAJOR.MINOR.PATCH release.
  if (parsedA.prerelease.length === 0 && parsedB.prerelease.length === 0) return 0;
  if (parsedA.prerelease.length === 0) return 1;
  if (parsedB.prerelease.length === 0) return -1;

  return comparePrereleaseIds(parsedA.prerelease, parsedB.prerelease);
}

/**
 * Convenience: true when `current >= required`.
 * Returns `true` when `required` is empty/null/undefined (no enforcement).
 * @param {string} current
 * @param {string} [required]
 * @returns {boolean}
 * @throws {Error} If either provided value is not valid semver
 */
function isAtLeast(current, required) {
  if (required === undefined || required === null || required === '') return true;
  return compareSemver(current, required) >= 0;
}

module.exports = {
  parseSemver,
  isValidSemver,
  compareSemver,
  isAtLeast
};
