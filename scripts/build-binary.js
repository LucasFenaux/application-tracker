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

console.log('Patching server.js to remove process.chdir (not supported in pkg snapshot)...');
const serverJsPath = path.join(standaloneDir, 'server.js');
if (fs.existsSync(serverJsPath)) {
  let serverJs = fs.readFileSync(serverJsPath, 'utf8');
  // Match any variation of process.chdir(...) with optional spaces and semicolons
  serverJs = serverJs.replace(/process\.chdir\s*\([^)]*\)\s*;?/g, '// process.chdir removed for pkg');
  fs.writeFileSync(serverJsPath, serverJs);
}

console.log('Packaging into standalone executables using pkg...');
try {
  let target = '';
  if (process.platform === 'win32') target = 'node18-win-x64';
  else if (process.platform === 'darwin') target = 'node18-macos-x64,node18-macos-arm64';
  else target = 'node18-linux-x64';
  
  execSync(`npx pkg package.json -t ${target} --out-path bin`, { stdio: 'inherit' });
  
  // Rename the generated binaries to match the exact requested format
  const files = fs.readdirSync(binDir);
  files.forEach(file => {
    const oldPath = path.join(binDir, file);
    let newName = '';
    
    if (file.includes('linux')) newName = 'app-linux';
    else if (file.includes('macos-x64')) newName = 'app-macos';
    else if (file.includes('macos-arm64')) newName = 'app-macos-arm64';
    else if (file.includes('win')) newName = 'app-windows.exe';
    
    if (newName) {
      fs.renameSync(oldPath, path.join(binDir, newName));
    }
  });

  console.log('Packaging successful. Binaries are available in the "bin" directory.');
} catch (error) {
  console.error('Packaging failed:', error.message);
  process.exit(1);
}
