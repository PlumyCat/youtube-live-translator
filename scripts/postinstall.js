#!/usr/bin/env node

/**
 * Post-install script to fix Rollup native bindings on Windows
 *
 * This script automatically downloads and installs the Windows-specific
 * Rollup native binary when npm fails to install optional dependencies.
 *
 * Issue: npm has a known bug with optional dependencies when transferring
 * projects between different platforms (Linux/macOS → Windows).
 *
 * Related: https://github.com/npm/cli/issues/4828
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

const ROLLUP_VERSION = '4.52.5';
const PLATFORM = os.platform();
const ARCH = os.arch();

// Only run on Windows x64
if (PLATFORM !== 'win32' || ARCH !== 'x64') {
  console.log('✓ Rollup native bindings not required for this platform');
  process.exit(0);
}

const rollupDir = path.join(__dirname, '..', 'node_modules', '@rollup', 'rollup-win32-x64-msvc');
const rollupBinary = path.join(rollupDir, 'rollup.win32-x64-msvc.node');

// Check if binary already exists
if (fs.existsSync(rollupBinary)) {
  console.log('✓ Rollup Windows binary already installed');
  process.exit(0);
}

console.log('⚙ Installing Rollup Windows native binary...');

const PACKAGE_URL = `https://registry.npmjs.org/@rollup/rollup-win32-x64-msvc/-/rollup-win32-x64-msvc-${ROLLUP_VERSION}.tgz`;
const TGZ_PATH = path.join(__dirname, '..', 'rollup-win.tgz');
const EXTRACT_DIR = path.join(__dirname, '..');

/**
 * Download file from URL
 */
function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);

    https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        // Follow redirect
        return download(response.headers.location, dest).then(resolve).catch(reject);
      }

      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: ${response.statusCode}`));
        return;
      }

      response.pipe(file);

      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlinkSync(dest);
      reject(err);
    });
  });
}

/**
 * Main installation flow
 */
async function install() {
  try {
    // 1. Download the package
    console.log(`  → Downloading from ${PACKAGE_URL}`);
    await download(PACKAGE_URL, TGZ_PATH);
    console.log('  ✓ Downloaded successfully');

    // 2. Extract the tarball
    console.log('  → Extracting package...');
    execSync(`tar -xzf "${TGZ_PATH}"`, { cwd: EXTRACT_DIR, stdio: 'inherit' });
    console.log('  ✓ Extracted successfully');

    // 3. Create @rollup directory if it doesn't exist
    const rollupParentDir = path.dirname(rollupDir);
    if (!fs.existsSync(rollupParentDir)) {
      fs.mkdirSync(rollupParentDir, { recursive: true });
      console.log('  ✓ Created @rollup directory');
    }

    // 4. Move package to correct location
    const packageDir = path.join(EXTRACT_DIR, 'package');
    if (fs.existsSync(rollupDir)) {
      fs.rmSync(rollupDir, { recursive: true, force: true });
    }
    fs.renameSync(packageDir, rollupDir);
    console.log('  ✓ Moved to node_modules/@rollup/rollup-win32-x64-msvc');

    // 5. Cleanup
    fs.unlinkSync(TGZ_PATH);
    console.log('  ✓ Cleaned up temporary files');

    console.log('\n✅ Rollup Windows binary installed successfully!\n');

  } catch (error) {
    console.error('\n❌ Failed to install Rollup Windows binary:');
    console.error(error.message);
    console.error('\nPlease follow manual installation steps in README.md\n');
    process.exit(1);
  }
}

install();
