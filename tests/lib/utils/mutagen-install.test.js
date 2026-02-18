/**
 * Tests for Mutagen auto-install (platform asset name, fetch release, install).
 * @fileoverview Unit tests for lib/utils/mutagen-install.js
 */

const path = require('path');

jest.mock('../../../lib/utils/paths', () => ({ getAifabrixHome: jest.fn(() => '/home/.aifabrix') }));
jest.mock('https');
jest.mock('fs');
jest.mock('child_process', () => ({ exec: jest.fn() }));

const fs = require('fs');
const https = require('https');
const { exec } = require('child_process');
const mutagenInstall = require('../../../lib/utils/mutagen-install');

describe('mutagen-install', () => {
  const originalPlatform = process.platform;
  const originalArch = process.arch;

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
    Object.defineProperty(process, 'arch', { value: originalArch, configurable: true });
    jest.clearAllMocks();
  });

  describe('getPlatformAssetBasename', () => {
    it('returns mutagen_linux_amd64 for linux x64', () => {
      Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });
      Object.defineProperty(process, 'arch', { value: 'x64', configurable: true });
      expect(mutagenInstall.getPlatformAssetBasename()).toBe('mutagen_linux_amd64');
    });

    it('returns mutagen_darwin_arm64 for darwin arm64', () => {
      Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
      Object.defineProperty(process, 'arch', { value: 'arm64', configurable: true });
      expect(mutagenInstall.getPlatformAssetBasename()).toBe('mutagen_darwin_arm64');
    });

    it('returns mutagen_windows_amd64 for win32 x64', () => {
      Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
      Object.defineProperty(process, 'arch', { value: 'x64', configurable: true });
      expect(mutagenInstall.getPlatformAssetBasename()).toBe('mutagen_windows_amd64');
    });

    it('returns null for unsupported platform', () => {
      Object.defineProperty(process, 'platform', { value: 'sunos', configurable: true });
      expect(mutagenInstall.getPlatformAssetBasename()).toBeNull();
    });
  });

  describe('fetchLatestRelease', () => {
    it('returns tag and assets from GitHub API', async() => {
      const body = JSON.stringify({
        tag_name: 'v0.18.1',
        assets: [{ name: 'mutagen_linux_amd64_v0.18.1.tar.gz', browser_download_url: 'https://example.com/mutagen_linux_amd64_v0.18.1.tar.gz' }]
      });
      const mockRes = {
        statusCode: 200,
        on: jest.fn((ev, fn) => {
          if (ev === 'data') fn(body);
          if (ev === 'end') setImmediate(fn);
          return mockRes;
        })
      };
      https.get.mockImplementation((url, opts, cb) => {
        if (typeof cb === 'function') cb(mockRes);
        return { on: jest.fn(), setTimeout: jest.fn(), destroy: jest.fn() };
      });
      const result = await mutagenInstall.fetchLatestRelease();
      expect(result.tagName).toBe('v0.18.1');
      expect(result.assets).toHaveLength(1);
      expect(result.assets[0].name).toBe('mutagen_linux_amd64_v0.18.1.tar.gz');
    });

    it('rejects when API returns non-200', async() => {
      const mockRes = { statusCode: 404, on: jest.fn() };
      https.get.mockImplementation((url, opts, cb) => {
        if (typeof cb === 'function') cb(mockRes);
        return { on: jest.fn(), setTimeout: jest.fn() };
      });
      await expect(mutagenInstall.fetchLatestRelease()).rejects.toThrow('404');
    });
  });

  describe('installMutagen', () => {
    it('rejects when platform unsupported', async() => {
      Object.defineProperty(process, 'platform', { value: 'sunos', configurable: true });
      await expect(mutagenInstall.installMutagen()).rejects.toThrow('does not provide a binary');
    });
  });
});
