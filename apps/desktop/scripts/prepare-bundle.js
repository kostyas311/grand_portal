const fs = require('fs');
const path = require('path');

const desktopRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(desktopRoot, '..', '..');
const outputRoot = path.join(desktopRoot, 'build', 'app');

const apiRoot = path.join(repoRoot, 'apps', 'api');
const webRoot = path.join(repoRoot, 'apps', 'web');

function ensureExists(targetPath, description) {
  if (!fs.existsSync(targetPath)) {
    throw new Error(`${description} not found: ${targetPath}`);
  }
}

function recreateDirectory(targetPath) {
  fs.rmSync(targetPath, { recursive: true, force: true });
  fs.mkdirSync(targetPath, { recursive: true });
}

function copyIfExists(source, destination) {
  if (!fs.existsSync(source)) {
    return;
  }

  fs.cpSync(source, destination, {
    recursive: true,
    force: true,
  });
}

function main() {
  const apiDist = path.join(apiRoot, 'dist');
  const apiNodeModules = path.join(apiRoot, 'node_modules');
  const apiPrisma = path.join(apiRoot, 'prisma');
  const webStandalone = path.join(webRoot, '.next', 'standalone');
  const webStatic = path.join(webRoot, '.next', 'static');
  const webPublic = path.join(webRoot, 'public');

  ensureExists(apiDist, 'API build output');
  ensureExists(apiNodeModules, 'API node_modules');
  ensureExists(webStandalone, 'Web standalone build output');
  ensureExists(webStatic, 'Web static build output');

  recreateDirectory(outputRoot);

  const bundledApiRoot = path.join(outputRoot, 'api');
  const bundledWebRoot = path.join(outputRoot, 'web');

  fs.mkdirSync(bundledApiRoot, { recursive: true });
  fs.mkdirSync(bundledWebRoot, { recursive: true });

  copyIfExists(apiDist, path.join(bundledApiRoot, 'dist'));
  copyIfExists(apiNodeModules, path.join(bundledApiRoot, 'node_modules'));
  copyIfExists(apiPrisma, path.join(bundledApiRoot, 'prisma'));
  copyIfExists(path.join(apiRoot, 'package.json'), path.join(bundledApiRoot, 'package.json'));
  copyIfExists(path.join(apiRoot, 'package-lock.json'), path.join(bundledApiRoot, 'package-lock.json'));

  copyIfExists(webStandalone, bundledWebRoot);
  copyIfExists(webStatic, path.join(bundledWebRoot, '.next', 'static'));
  copyIfExists(webPublic, path.join(bundledWebRoot, 'public'));

  const envSource = fs.existsSync(path.join(repoRoot, '.env'))
    ? path.join(repoRoot, '.env')
    : path.join(repoRoot, '.env.example');

  copyIfExists(envSource, path.join(outputRoot, '.env'));
  copyIfExists(path.join(repoRoot, '.env.example'), path.join(outputRoot, '.env.example'));

  console.log(`Desktop bundle prepared in ${outputRoot}`);
}

main();
