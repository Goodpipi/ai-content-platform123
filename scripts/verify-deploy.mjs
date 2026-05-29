import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const required = [
  'index.html',
  'package.json',
  'src/main.tsx',
  'src/app/App.tsx',
  'server/index.js',
];

const missing = required.filter((rel) => !fs.existsSync(path.join(root, rel)));

if (missing.length) {
  console.error('\n[deploy] 缺少部署必需文件，构建无法继续：');
  missing.forEach((f) => console.error(`  - ${f}`));
  console.error(
    '\n请确认已将完整项目（含 src/、server/）推送到 GitHub，而不是只有 package.json 的残缺包。\n'
  );
  process.exit(1);
}

console.log('[deploy] 源码结构检查通过');
