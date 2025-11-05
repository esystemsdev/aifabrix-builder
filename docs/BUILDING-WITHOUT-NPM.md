# Packaging and Testing Before npm Publish

Build, package, and test the AI Fabrix Builder in another project before publishing to npm.

## Quick Start

```bash
# 1. Build and package
npm run pack

# 2. Copy to your other project
cp build/@aifabrix-builder-*.tgz ../your-other-project/

# 3. Install and test in other project
cd ../your-other-project
npm install ./@aifabrix-builder-*.tgz
aifabrix --version

# 4. When ready, publish to npm
cd ../aifabrix-builder
npm publish
```

## Detailed Steps

### Step 1: Build and Package

```bash
npm run pack
```

Creates: `build/@aifabrix-builder-2.0.2.tgz` (tar file is in `build/` folder, not tracked by git)

### Step 2: Copy to Other Project

**Windows:**
```powershell
Copy-Item build\@aifabrix-builder-*.tgz C:\path\to\other-project\
```

**Linux/Mac:**
```bash
cp build/@aifabrix-builder-*.tgz /path/to/other-project/
```

### Step 3: Install and Test

```bash
cd /path/to/other-project
npm install ./@aifabrix-builder-*.tgz
aifabrix --version
```

### Step 4: Publish (After Testing)

Update version in `package.json`, then:
```bash
npm run pack
npm publish
```

## Troubleshooting

- **Package too large?** Add `files` field to `package.json` to control what's included
- **CLI doesn't work?** Check `bin/aifabrix.js` has `#!/usr/bin/env node`
- **Version already published?** Increment version in `package.json`
