/**
 * @fileoverview Tests for repair-openapi-sync helper
 */

jest.mock('../../../lib/utils/controller-url', () => ({
  resolveControllerUrl: jest.fn().mockResolvedValue('http://controller')
}));
jest.mock('../../../lib/utils/token-manager', () => ({
  getDeploymentAuth: jest.fn().mockResolvedValue({ type: 'bearer', token: 't' }),
  requireBearerForDataplanePipeline: jest.fn()
}));
jest.mock('../../../lib/utils/dataplane-resolver', () => ({
  resolveDataplaneUrl: jest.fn().mockResolvedValue('http://dataplane')
}));
jest.mock('../../../lib/utils/file-upload', () => ({
  uploadFileAs: jest.fn().mockResolvedValue({ success: true })
}));
jest.mock('../../../lib/api/external-systems.api', () => ({
  listOpenAPIFiles: jest.fn().mockResolvedValue({ success: true, data: { data: [] } })
}));

const path = require('path');
const fs = require('fs');

const { uploadFileAs } = require('../../../lib/utils/file-upload');
const { listOpenAPIFiles } = require('../../../lib/api/external-systems.api');
const { maybeSyncOpenApiFilesForMcp, documentKeyToLocalOpenApiPath } = require('../../../lib/commands/repair-openapi-sync');

const DEFAULT_OPENAPI_LIST = { success: true, data: { data: [] } };

describe('repair-openapi-sync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    listOpenAPIFiles.mockResolvedValue(DEFAULT_OPENAPI_LIST);
    uploadFileAs.mockResolvedValue({ success: true });
  });

  it('maps documentKey to openapi/<suffix>.json', () => {
    const p = documentKeyToLocalOpenApiPath('/x/app', 'sys', 'sys-contacts');
    expect(p).toBe(path.join('/x/app', 'openapi', 'contacts.json'));
  });

  it('no-op when disabled or dryRun', async() => {
    const out = await maybeSyncOpenApiFilesForMcp({
      enabled: false,
      dryRun: false,
      appPath: '/x',
      systemKey: 'sys',
      datasourceFiles: []
    });
    expect(out).toEqual([]);
  });

  it('uploads files with filename override based on documentKey', async() => {
    const appPath = '/tmp/integration/sys';
    const systemKey = 'sys';
    const datasourceFiles = ['sys-datasource-contacts.json'];

    const accessSpy = jest.spyOn(fs.promises, 'access').mockResolvedValue();
    const existsSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    const loadConfigFile = jest.spyOn(require('../../../lib/utils/config-format'), 'loadConfigFile');
    loadConfigFile.mockReturnValue({ openapi: { documentKey: 'sys-contacts' } });

    try {
      const lines = await maybeSyncOpenApiFilesForMcp({
        enabled: true,
        dryRun: false,
        appPath,
        systemKey,
        datasourceFiles
      });

      expect(lines.join('\n')).toContain('Uploaded 1 OpenAPI file(s) for MCP');
      expect(listOpenAPIFiles).toHaveBeenCalledWith(
        'http://dataplane',
        'sys',
        expect.any(Object),
        expect.objectContaining({ pageSize: 100 })
      );
      expect(uploadFileAs).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/specs/upload?systemIdOrKey=sys'),
        path.join(appPath, 'openapi', 'contacts.json'),
        'sys-contacts.json',
        'file',
        expect.any(Object)
      );
    } finally {
      accessSpy.mockRestore();
      existsSpy.mockRestore();
      loadConfigFile.mockRestore();
    }
  });

  it('no-op when OpenAPI key already exists remotely', async() => {
    listOpenAPIFiles.mockResolvedValue({ success: true, data: { data: [{ key: 'sys-contacts' }] } });

    const appPath = '/tmp/integration/sys';
    const systemKey = 'sys';
    const datasourceFiles = ['sys-datasource-contacts.json'];

    const accessSpy = jest.spyOn(fs.promises, 'access').mockResolvedValue();
    const existsSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    const loadConfigFile = jest.spyOn(require('../../../lib/utils/config-format'), 'loadConfigFile');
    loadConfigFile.mockReturnValue({ openapi: { documentKey: 'sys-contacts' } });

    try {
      const lines = await maybeSyncOpenApiFilesForMcp({
        enabled: true,
        dryRun: false,
        appPath,
        systemKey,
        datasourceFiles
      });

      expect(lines).toEqual([]);
      expect(uploadFileAs).not.toHaveBeenCalled();
    } finally {
      accessSpy.mockRestore();
      existsSpy.mockRestore();
      loadConfigFile.mockRestore();
    }
  });
});

