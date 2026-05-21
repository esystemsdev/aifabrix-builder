'use strict';

/**
 * Protection manifest fixtures for unit tests.
 * Embedded YAML keeps tests passing when `tests/fixtures/protection/` is missing
 * (e.g. sparse CI copy); on-disk fixture is preferred when present.
 */

const path = require('path');
const {
  existsSync,
  writeFileSync,
  mkdirSync
} = require('../../../lib/internal/fs-real-sync');

const HUBSPOT_COMPANIES_YAML = `apiVersion: dataplane.aifabrix.ai/v1
kind: Protection
metadata:
  key: hubspot-country-sales
  displayName: HubSpot Country Sales Access
spec:
  enabled: true
  datasourceKey: hubspot-companies
  mode: replaceForSource
  rules:
    - key: sales-country-users
      principal:
        type: group
        expression: "Sales {{fk.country.metadata.iso3}} Users"
      grants:
        - dimensionKey: country
          valueExpression: "{{fk.country.metadata.iso2}}"
`;

/** Shipped fixture path (anchored to this module, not caller `__dirname`). */
const FIXTURE_ON_DISK = path.join(__dirname, '../../fixtures/protection/hubspot-companies.yaml');

/**
 * Project-local temp root (avoids OS /tmp cleaners racing parallel Jest workers).
 * @returns {string}
 */
function protectionFixtureTempRoot() {
  return path.join(__dirname, '../../../.temp/jest-protection-fixtures');
}

/**
 * Stable materialized path (no mkdtemp) so parallel tests do not orphan random hubspot-* dirs.
 * @returns {string}
 */
function materializedHubspotCompaniesPath() {
  return path.join(protectionFixtureTempRoot(), 'hubspot-companies.yaml');
}

/**
 * Ensure embedded YAML exists on disk under .temp/jest-protection-fixtures/.
 * @returns {string}
 */
function ensureMaterializedHubspotCompaniesFixture() {
  const dest = materializedHubspotCompaniesPath();
  if (!existsSync(dest)) {
    mkdirSync(protectionFixtureTempRoot(), { recursive: true });
    writeFileSync(dest, HUBSPOT_COMPANIES_YAML, 'utf8');
  }
  return dest;
}

/**
 * @returns {string} Absolute path to hubspot-companies.yaml (on disk or materialized temp copy)
 */
function hubspotCompaniesFixturePath() {
  if (existsSync(FIXTURE_ON_DISK)) {
    return FIXTURE_ON_DISK;
  }
  return ensureMaterializedHubspotCompaniesFixture();
}

/**
 * @returns {string} YAML manifest content
 */
function readHubspotCompaniesYaml() {
  if (existsSync(FIXTURE_ON_DISK)) {
    const { readFileSync } = require('../../../lib/internal/fs-real-sync');
    return readFileSync(FIXTURE_ON_DISK, 'utf8');
  }
  return HUBSPOT_COMPANIES_YAML;
}

/**
 * @param {string} targetDir - Directory to write into (e.g. `.protection/`)
 * @param {string} [fileName]
 * @returns {string} Absolute path to the written file
 */
function writeHubspotCompaniesManifest(targetDir, fileName = 'hubspot-companies.yaml') {
  mkdirSync(targetDir, { recursive: true });
  const dest = path.join(targetDir, fileName);
  writeFileSync(dest, readHubspotCompaniesYaml(), 'utf8');
  return dest;
}

module.exports = {
  HUBSPOT_COMPANIES_YAML,
  hubspotCompaniesFixturePath,
  readHubspotCompaniesYaml,
  writeHubspotCompaniesManifest
};
