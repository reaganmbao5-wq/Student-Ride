const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

const SRC_DIR = path.resolve(__dirname, '../src');

// List of allowed standard JavaScript, browser, and runtime globals
const GLOBAL_WHITELIST = new Set([
  'window', 'document', 'console', 'React', 'setTimeout', 'clearTimeout',
  'setInterval', 'clearInterval', 'localStorage', 'sessionStorage', 'Math',
  'navigator', 'fetch', 'Set', 'Map', 'WeakMap', 'WeakSet', 'Array', 'Object',
  'Number', 'String', 'Boolean', 'Date', 'Error', 'Promise', 'Infinity', 'NaN',
  'JSON', 'location', 'process', 'CustomEvent', 'Event', 'FileReader',
  'requestAnimationFrame', 'cancelAnimationFrame', 'IntersectionObserver',
  'ResizeObserver', 'MutationObserver', 'URL', 'URLSearchParams', 'FormData',
  'Blob', 'File', 'Intl', 'encodeURIComponent', 'decodeURIComponent', 'btoa', 'atob',
  'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'RegExp', 'Symbol', 'Proxy',
  'Reflect', 'Audio', 'Image', 'WebSocket', 'history', 'screen',
  'alert', 'confirm', 'prompt', 'performance', 'crypto', 'indexedDB',
  'structuredClone', 'queueMicrotask', 'TextEncoder', 'TextDecoder',
  'AbortController', 'AbortSignal', 'globalThis', 'self', 'undefined',
  'HTMLImageElement', 'HTMLElement', 'Node', 'Element', 'Notification'
]);

function getAllFiles(dir, exts = ['.js', '.jsx']) {
  let files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== 'build') {
        files = files.concat(getAllFiles(fullPath, exts));
      }
    } else if (exts.some(ext => entry.name.endsWith(ext))) {
      files.push(fullPath);
    }
  }
  return files;
}

console.log('🔍 Running Antigravity Pre-Build Verification on src/...');

const files = getAllFiles(SRC_DIR);
let errorsFound = 0;
let checkedFiles = 0;

for (const filePath of files) {
  const relPath = path.relative(SRC_DIR, filePath);
  const code = fs.readFileSync(filePath, 'utf-8');
  checkedFiles++;

  let ast;
  try {
    ast = parser.parse(code, {
      sourceType: 'module',
      plugins: [
        'jsx',
        'typescript',
        'classProperties',
        'optionalChaining',
        'nullishCoalescingOperator',
        'exportDefaultFrom'
      ]
    });
  } catch (parseErr) {
    console.error(`❌ [SYNTAX ERROR] ${relPath}:${parseErr.loc?.line || '?'}:${parseErr.loc?.column || '?'}`);
    console.error(`   ${parseErr.message}\n`);
    errorsFound++;
    continue;
  }

  // Validate AST scope references for undeclared variables
  try {
    traverse(ast, {
      // Check import targets
      ImportDeclaration(pathNode) {
        const importSrc = pathNode.node.source.value;
        if (importSrc.startsWith('.')) {
          const dir = path.dirname(filePath);
          const resolvedBase = path.resolve(dir, importSrc);
          const extensions = ['', '.js', '.jsx', '.json', '.css', '.svg', '.png', '.jpg'];
          const exists = extensions.some(ext => fs.existsSync(resolvedBase + ext) || fs.existsSync(path.join(resolvedBase, 'index' + ext)));
          if (!exists) {
            console.error(`❌ [BROKEN IMPORT] in ${relPath}:${pathNode.node.loc?.start.line}`);
            console.error(`   Cannot resolve '${importSrc}'\n`);
            errorsFound++;
          }
        }
      },
      // Check identifier references
      ReferencedIdentifier(pathNode) {
        const name = pathNode.node.name;
        
        // Skip JSX tag names, property keys, and globals
        if (GLOBAL_WHITELIST.has(name)) return;
        if (pathNode.parent.type === 'JSXClosingElement') return;
        if (pathNode.parent.type === 'MemberExpression' && pathNode.parent.property === pathNode.node && !pathNode.parent.computed) return;
        if (pathNode.parent.type === 'ObjectProperty' && pathNode.parent.key === pathNode.node && !pathNode.parent.computed) return;
        if (pathNode.parent.type === 'ImportSpecifier' || pathNode.parent.type === 'ImportDefaultSpecifier') return;

        // Check if binding exists in current scope chain
        if (!pathNode.scope.hasBinding(name)) {
          const line = pathNode.node.loc?.start.line;
          const col = pathNode.node.loc?.start.column;
          console.error(`❌ [UNDECLARED VARIABLE / REFERENCE ERROR] in ${relPath}:${line}:${col}`);
          console.error(`   Variable '${name}' is referenced but never defined!\n`);
          errorsFound++;
        }
      }
    });
  } catch (traverseErr) {
    console.error(`⚠️ Error traversing AST for ${relPath}: ${traverseErr.message}`);
  }
}

if (errorsFound > 0) {
  console.error(`\n🚨 BUILD VERIFICATION FAILED! Found ${errorsFound} critical error(s) across ${checkedFiles} files.`);
  console.error(`Please resolve the above errors before proceeding with the build.`);
  process.exit(1);
} else {
  console.log(`✅ Pre-Build Verification Passed! Scanned ${checkedFiles} files with 0 ReferenceErrors, 0 Broken Imports, 0 Syntax Errors.\n`);
}
