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
  
  // Patch 1: Remove process.chdir as it's not supported in pkg virtual filesystem
  serverJs = serverJs.replace(
    /process\.chdir\([^)]+\);?/g,
    '// process.chdir removed for pkg'
  );
  
  // Patch 2: Inject a mock for 'node:inspector' because pkg base binaries often disable it,
  // which causes Next.js require-hook to crash with ERR_INSPECTOR_NOT_AVAILABLE.
  const inspectorMock = `
const _Module = require('module');
const _originalRequire = _Module.prototype.require;
_Module.prototype.require = function(id) {
  if (id === 'inspector' || id === 'node:inspector') {
    return {
      Session: class Session {
        connect() {}
        disconnect() {}
        post() {}
      },
      open: () => {},
      close: () => {},
      url: () => undefined
    };
  }
  return _originalRequire.apply(this, arguments);
};
`;

  serverJs = inspectorMock + '\n' + serverJs;
  
  fs.writeFileSync(serverJsPath, serverJs);
}

console.log('Packaging into standalone executables using @yao-pkg/pkg...');
try {
  let target = '';
  let outputName = '';
  if (process.platform === 'win32') {
    target = 'node24-win-x64';
    outputName = 'app-windows.exe';
  } else if (process.platform === 'darwin') {
    if (process.arch === 'arm64') {
      target = 'node24-macos-arm64';
      outputName = 'app-macos-arm64';
    } else {
      target = 'node24-macos-x64';
      outputName = 'app-macos-x64';
    }
  } else {
    target = 'node24-linux-x64';
    outputName = 'app-linux';
  }
  
  execSync(`npx @yao-pkg/pkg package.json -t ${target} --output bin/${outputName}`, { stdio: 'inherit' });

  console.log('Packaging successful. Binaries are available in the "bin" directory.');
} catch (error) {
  console.error('Packaging failed:', error.message);
  process.exit(1);
}
