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

  // Patch 3: Extract onnxruntime-node binaries to real filesystem so dlopen can find the .dylib
  const extractOnnx = `
const _fs = require('fs');
const _path = require('path');
const _os = require('os');
const onnxTmpDir = _path.join(_os.tmpdir(), 'application-tracker-onnx-v3');
const targetFile = _path.join(onnxTmpDir, 'napi-v3', process.platform, process.arch, 'onnxruntime_binding.node');
try {
  if (!_fs.existsSync(targetFile)) {
    if (!_fs.existsSync(onnxTmpDir)) {
      _fs.mkdirSync(onnxTmpDir, { recursive: true });
    }
    _fs.cpSync(_path.join(__dirname, 'onnx-bin'), onnxTmpDir, { recursive: true, force: true });
    
    function restoreBinaries(dir) {
      const items = _fs.readdirSync(dir);
      for (const item of items) {
        const fullPath = _path.join(dir, item);
        if (_fs.statSync(fullPath).isDirectory()) {
          restoreBinaries(fullPath);
        } else if (item.endsWith('.pkgasset')) {
          _fs.renameSync(fullPath, fullPath.slice(0, -9));
        }
      }
    }
    restoreBinaries(onnxTmpDir);
  }
} catch (e) {
  console.warn('Failed to extract onnx binaries:', e.message);
}
`;

  serverJs = inspectorMock + '\n' + extractOnnx + '\n' + serverJs;
  
  fs.writeFileSync(serverJsPath, serverJs);
}

console.log('Copying all onnxruntime-node binaries to standalone directory...');
const onnxSrcBin = path.join(__dirname, '../node_modules/onnxruntime-node/bin');
const onnxDestBin = path.join(standaloneDir, 'onnx-bin');
if (fs.existsSync(onnxSrcBin)) {
  fs.cpSync(onnxSrcBin, onnxDestBin, { recursive: true });
  
  function renameBinaries(dir) {
    const items = fs.readdirSync(dir);
    for (const item of items) {
      const fullPath = path.join(dir, item);
      if (fs.statSync(fullPath).isDirectory()) {
        renameBinaries(fullPath);
      } else if (item.endsWith('.node') || item.endsWith('.dylib') || item.endsWith('.so') || item.endsWith('.dll')) {
        fs.renameSync(fullPath, fullPath + '.pkgasset');
      }
    }
  }
  renameBinaries(onnxDestBin);
}

console.log('Patching onnxruntime-node binding.js to point to extracted binaries...');
const bindingJsPath = path.join(standaloneDir, 'node_modules/onnxruntime-node/dist/binding.js');
if (fs.existsSync(bindingJsPath)) {
  let bindingJs = fs.readFileSync(bindingJsPath, 'utf8');
  bindingJs = bindingJs.replace(
    /\`\.\.\/bin\/napi-v3\/\$\{process\.platform\}\/\$\{process\.arch\}\/onnxruntime_binding\.node\`/g,
    `require('path').join(require('os').tmpdir(), 'application-tracker-onnx-v3', 'napi-v3', process.platform, process.arch, 'onnxruntime_binding.node')`
  );
  fs.writeFileSync(bindingJsPath, bindingJs);
}

console.log('Packaging into standalone executables using @yao-pkg/pkg...');
try {
  let target = '';
  if (process.platform === 'win32') target = 'node24-win-x64';
  else if (process.platform === 'darwin') target = 'node24-macos-x64,node24-macos-arm64';
  else target = 'node24-linux-x64';
  
  execSync(`npx @yao-pkg/pkg package.json -t ${target} --out-path bin`, { stdio: 'inherit' });
  
  // Rename the generated binaries to match the exact requested format
  const files = fs.readdirSync(binDir);
  files.forEach(file => {
    if (file.startsWith('app-')) return; // Already renamed

    const oldPath = path.join(binDir, file);
    let newName = '';
    
    if (process.platform === 'linux') {
      newName = 'app-linux';
    } else if (process.platform === 'win32') {
      newName = 'app-windows.exe';
    } else if (process.platform === 'darwin') {
      if (file.includes('arm64')) newName = 'app-macos-arm64';
      else newName = 'app-macos';
    }
    
    if (newName) {
      fs.renameSync(oldPath, path.join(binDir, newName));
    }
  });

  console.log('Packaging successful. Binaries are available in the "bin" directory.');
} catch (error) {
  console.error('Packaging failed:', error.message);
  process.exit(1);
}
