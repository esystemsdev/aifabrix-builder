'use strict';

/**
 * Protection manifest fixtures for unit tests.
 * Embedded YAML keeps tests passing when `tests/fixtures/protection/` is missing
 * (e.g. sparse CI copy); on-disk fixture is preferred when present.
 */

const fs = require('fs');
const path = require('path');

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

const FIXTURE_REL = '../../fixtures/protection/hubspot-companies.yaml';

/** @type {string|null} Reused across tests in one worker when on-disk fixture is absent. */
let materializedFixturePath = null;

/**
 * Project-local temp root (avoids OS /tmp cleaners racing parallel Jest workers).
 * @returns {string}
 */
function protectionFixtureTempRoot() {
  return path.join(__dirname, '../../../.temp/jest-protection-fixtures');
}

/**
 * Materialize embedded YAML once per worker under tests/.temp (not os.tmpdir).
 * @returns {string} Absolute path to hubspot-companies.yaml
 */
function materializeHubspotCompaniesFixture() {
  const root = protectionFixtureTempRoot();
  fs.mkdirSync(root, { recursive: true });
  const dir = fs.mkdtempSync(path.join(root, 'hubspot-'));
  const dest = path.join(dir, 'hubspot-companies.yaml');
  fs.writeFileSync(dest, HUBSPOT_COMPANIES_YAML, 'utf8');
  materializedFixturePath = dest;
  return dest;
}

/**
 * @param {string} [fromDir] - Directory of the calling test file (__dirname)
 * @returns {string} Absolute path to hubspot-companies.yaml (on disk or materialized temp copy)
 */
function hubspotCompaniesFixturePath(fromDir = __dirname) {
  const onDisk = path.resolve(fromDir, FIXTURE_REL);
  if (fs.existsSync(onDisk)) {
    return onDisk;
  }
  if (materializedFixturePath && fs.existsSync(materializedFixturePath)) {
    return materializedFixturePath;
  }
  return materializeHubspotCompaniesFixture();
}

/**
 * @param {string} [fromDir] - Directory of the calling test file (__dirname)
 * @returns {string} YAML manifest content
 */
function readHubspotCompaniesYaml(fromDir = __dirname) {
  const onDisk = path.resolve(fromDir, FIXTURE_REL);
  if (fs.existsSync(onDisk)) {
    return fs.readFileSync(onDisk, 'utf8');
  }
  return HUBSPOT_COMPANIES_YAML;
}

/**
 * @param {string} targetDir - Directory to write into (e.g. `.protection/`)
 * @param {string} [fileName]
 * @returns {string} Absolute path to the written file
 */
function writeHubspotCompaniesManifest(targetDir, fileName = 'hubspot-companies.yaml') {
  fs.mkdirSync(targetDir, { recursive: true });
  const dest = path.join(targetDir, fileName);
  fs.writeFileSync(dest, readHubspotCompaniesYaml(__dirname), 'utf8');
  return dest;
}

module.exports = {
  HUBSPOT_COMPANIES_YAML,
  hubspotCompaniesFixturePath,
  readHubspotCompaniesYaml,
  writeHubspotCompaniesManifest
};
