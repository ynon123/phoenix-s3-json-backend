'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const archiver = require('archiver');

const ROOT_DIR = path.resolve(__dirname, '..');
const DEPLOY_DIR = path.join(ROOT_DIR, '.deploy');
const BUILD_DIR = path.join(DEPLOY_DIR, 'lambda-build');
const ZIP_PATH = path.join(DEPLOY_DIR, 'lambda.zip');

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function rmIfExists(target) {
  if (fs.existsSync(target)) {
    fs.rmSync(target, { recursive: true, force: true });
  }
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.status !== 0) {
    throw new Error(`Command failed: ${command} ${args.join(' ')}`);
  }
}

function createZip(sourceDir, outputPath) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', resolve);
    archive.on('error', reject);

    archive.pipe(output);
    archive.directory(sourceDir, false);
    archive.finalize();
  });
}

async function main() {
  ensureDir(DEPLOY_DIR);
  rmIfExists(BUILD_DIR);
  ensureDir(BUILD_DIR);

  fs.cpSync(path.join(ROOT_DIR, 'src'), path.join(BUILD_DIR, 'src'), { recursive: true });
  fs.copyFileSync(path.join(ROOT_DIR, 'package.json'), path.join(BUILD_DIR, 'package.json'));
  fs.copyFileSync(path.join(ROOT_DIR, 'package-lock.json'), path.join(BUILD_DIR, 'package-lock.json'));

  run('npm', ['ci', '--omit=dev'], BUILD_DIR);

  rmIfExists(ZIP_PATH);
  await createZip(BUILD_DIR, ZIP_PATH);

  console.log(`Lambda package created at ${ZIP_PATH}`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exitCode = 1;
});
