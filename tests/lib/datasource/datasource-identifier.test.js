/**
 * @fileoverview Unit tests for datasource-identifier.js
 */

const {
  datasourceIdentifierMatchesFile,
  pickIntegrationAppForDatasourceIdentifier,
  appHasDatasourceIdentifier
} = require('../../../lib/datasource/datasource-identifier');

jest.mock('../../../lib/utils/paths', () => ({
  getIntegrationPath: jest.fn((app) => `/integration/${app}`)
}));
jest.mock('../../../lib/utils/app-config-resolver', () => ({
  resolveApplicationConfigPath: jest.fn((p) => `${p}/application.yaml`)
}));
jest.mock('../../../lib/utils/config-format', () => ({
  loadConfigFile: jest.fn()
}));

const fs = require('fs');
const existsSyncSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(true);

const configFormat = require('../../../lib/utils/config-format');

describe('datasource-identifier', () => {
  afterAll(() => {
    existsSyncSpy.mockRestore();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    fs.existsSync.mockReturnValue(true);
  });

  describe('datasourceIdentifierMatchesFile', () => {
    it('matches parsed key', () => {
      expect(
        datasourceIdentifierMatchesFile('test-e2e-hubspot-companies', 'test-e2e-hubspot-datasource-companies.json', {
          key: 'test-e2e-hubspot-companies'
        })
      ).toBe(true);
    });

    it('matches filename stem without .json', () => {
      expect(
        datasourceIdentifierMatchesFile(
          'test-e2e-hubspot-datasource-companies',
          'test-e2e-hubspot-datasource-companies.json',
          { key: 'test-e2e-hubspot-companies' }
        )
      ).toBe(true);
    });

    it('returns false when neither key nor stem match', () => {
      expect(
        datasourceIdentifierMatchesFile('other-key', 'test-e2e-hubspot-datasource-companies.json', {
          key: 'test-e2e-hubspot-companies'
        })
      ).toBe(false);
    });
  });

  describe('pickIntegrationAppForDatasourceIdentifier', () => {
    it('picks longest matching app prefix', () => {
      const app = pickIntegrationAppForDatasourceIdentifier('test-e2e-hubspot-datasource-companies', [
        'test',
        'test-e2e-hubspot',
        'test-e2e'
      ]);
      expect(app).toBe('test-e2e-hubspot');
    });
  });

  describe('appHasDatasourceIdentifier', () => {
    it('returns true when filename stem matches', () => {
      configFormat.loadConfigFile.mockImplementation(filePath => {
        if (filePath.includes('application')) {
          return {
            externalIntegration: {
              dataSources: ['test-e2e-hubspot-datasource-companies.json'],
              schemaBasePath: './'
            }
          };
        }
        return { key: 'test-e2e-hubspot-companies' };
      });
      expect(appHasDatasourceIdentifier('test-e2e-hubspot', 'test-e2e-hubspot-datasource-companies')).toBe(
        true
      );
    });
  });
});
