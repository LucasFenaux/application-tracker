const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const standaloneDir = path.join(__dirname, '../.next/standalone');
const publicDir = path.join(__dirname, '../public');
const staticDir = path.join(__dirname, '../.next/static');

const standalonePublicDir = path.join(standaloneDir, 'public');
const standaloneStaticDir = path.join(standaloneDir, '.next/static');
const binDir = path.join(__dirname, '../bin');

console.log('Building Next.js application...');
execSync('npm run build', { stdio: 'inherit' });

console.log('Copying static assets to standalone directory...');
if (!fs.existsSync(standalonePublicDir)) {
  fs.mkdirSync(standalonePublicDir, { recursive: true });
}
if (fs.existsSync(publicDir)) {
  fs.cpSync(publicDir, standalonePublicDir, { recursive: true });
}

if (!fs.existsSync(standaloneStaticDir)) {
  fs.mkdirSync(standaloneStaticDir, { recursive: true });
}
if (fs.existsSync(staticDir)) {
  fs.cpSync(staticDir, standaloneStaticDir, { recursive: true });
}

if (!fs.existsSync(binDir)) {
  fs.mkdirSync(binDir, { recursive: true });
}

console.log('Packaging into standalone executables using pkg...');
try {
  execSync('npx pkg package.json --out-path bin', { stdio: 'inherit' });
  console.log('Packaging successful. Binaries are available in the "bin" directory.');
} catch (error) {
  console.error('Packaging failed:', error.message);
  process.exit(1);
}
