/**
 * @fileoverview resolveInfraPgpassPath, Python compose reload command helpers
 */

const path = require('path');
const {
  resolveInfraPgpassPath,
  derivePythonImageStartFromReload,
  buildReloadStartCommandForCompose,
  normalizePythonReloadForComposeMounted
} = require('../../../lib/utils/compose-generate-docker-compose');

describe('resolveInfraPgpassPath', () => {
  it('returns system path when pgpass exists under getAifabrixSystemDir', () => {
    const sys = path.join('/sys', '.aifabrix', 'infra', 'pgpass');
    const exists = jest.fn((p) => p === sys);
    const pathsUtil = {
      getAifabrixSystemDir: () => path.join('/sys', '.aifabrix'),
      getAifabrixHome: () => '/home/user'
    };
    expect(resolveInfraPgpassPath(0, pathsUtil, exists)).toBe(sys);
    expect(exists).toHaveBeenCalledWith(sys);
  });

  it('returns legacy path when system pgpass missing, bases differ, legacy file exists', () => {
    const sys = path.join('/sys', '.aifabrix', 'infra', 'pgpass');
    const leg = path.join('/home', 'user', 'infra', 'pgpass');
    const exists = jest.fn((p) => p === leg);
    const pathsUtil = {
      getAifabrixSystemDir: () => path.join('/sys', '.aifabrix'),
      getAifabrixHome: () => path.join('/home', 'user')
    };
    expect(resolveInfraPgpassPath(0, pathsUtil, exists)).toBe(leg);
  });

  it('returns system candidate when home equals system even if file missing', () => {
    const base = path.join('/same', '.aifabrix');
    const expected = path.join(base, 'infra', 'pgpass');
    const exists = jest.fn(() => false);
    const pathsUtil = {
      getAifabrixSystemDir: () => base,
      getAifabrixHome: () => base
    };
    expect(resolveInfraPgpassPath(0, pathsUtil, exists)).toBe(expected);
  });

  it('uses infra-dev{n} directory for non-zero dev id', () => {
    const base = '/x/.aifabrix';
    const expected = path.join(base, 'infra-dev3', 'pgpass');
    const exists = jest.fn((p) => p === expected);
    const pathsUtil = {
      getAifabrixSystemDir: () => base,
      getAifabrixHome: () => '/y'
    };
    expect(resolveInfraPgpassPath(3, pathsUtil, exists)).toBe(expected);
  });
});

describe('derivePythonImageStartFromReload', () => {
  it('maps uvicorn prefix to python -m uvicorn and strips --reload', () => {
    const inStr = 'uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-3001} --reload';
    expect(derivePythonImageStartFromReload(inStr)).toBe(
      'python -m uvicorn app.main:app --host 0.0.0.0 --port $$PORT'
    );
  });

  it('returns null when reloadStart is missing or not uvicorn-based', () => {
    expect(derivePythonImageStartFromReload(undefined)).toBeNull();
    expect(derivePythonImageStartFromReload('gunicorn -k uvicorn.workers.UvicornWorker app:app')).toBeNull();
  });

  it('passes through existing python -m uvicorn command without double prefix', () => {
    const cmd = 'python -m uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-3001} --reload';
    expect(derivePythonImageStartFromReload(cmd)).toBe(
      'python -m uvicorn app.main:app --host 0.0.0.0 --port $$PORT'
    );
  });
});

describe('normalizePythonReloadForComposeMounted', () => {
  it('rewrites uvicorn to python -m uvicorn and normalizes port ref without stripping --reload', () => {
    const raw = 'uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-3001} --reload';
    expect(normalizePythonReloadForComposeMounted(raw)).toBe(
      'python -m uvicorn app.main:app --host 0.0.0.0 --port $$PORT --reload'
    );
  });
});

describe('buildReloadStartCommandForCompose', () => {
  it('returns exec-prefixed image command for python without dev mount', () => {
    const raw = 'uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-3001} --reload';
    expect(buildReloadStartCommandForCompose('python', null, raw)).toBe(
      'exec python -m uvicorn app.main:app --host 0.0.0.0 --port $$PORT'
    );
  });

  it('returns normalized mounted command for python with dev mount', () => {
    const raw = 'uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-3001} --reload';
    expect(buildReloadStartCommandForCompose('python', '/workspace/dataplane', raw)).toBe(
      'python -m uvicorn app.main:app --host 0.0.0.0 --port $$PORT --reload'
    );
  });

  it('passes through raw reload for non-python with dev mount', () => {
    expect(buildReloadStartCommandForCompose('typescript', '/app', 'pnpm run dev')).toBe('pnpm run dev');
  });

  it('uses build.imageRun without dev mount (overrides python derive)', () => {
    const raw = 'uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-3001} --reload';
    expect(
      buildReloadStartCommandForCompose('python', null, raw, {
        imageRun: 'exec gunicorn -b 0.0.0.0:${PORT:-3001} main:app'
      })
    ).toBe('exec gunicorn -b 0.0.0.0:$$PORT main:app');
  });

  it('uses imageRun when reloadStart is empty (typescript, no mount)', () => {
    expect(
      buildReloadStartCommandForCompose('typescript', null, undefined, {
        imageRun: 'node dist/server.js'
      })
    ).toBe('node dist/server.js');
  });

  it('ignores imageRun when dev mount is set', () => {
    const raw = 'uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-3001} --reload';
    expect(
      buildReloadStartCommandForCompose('python', '/workspace/dataplane', raw, {
        imageRun: 'exec gunicorn main:app'
      })
    ).toBe('python -m uvicorn app.main:app --host 0.0.0.0 --port $$PORT --reload');
  });
});
