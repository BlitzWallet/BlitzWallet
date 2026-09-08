import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import lucideIconFile, {
  ALIASES,
} from '../../../app/functions/CustomElements/lucideIconFile';

const root = path.join(__dirname, '../../..');
const ICON_DIR = path.join(
  __dirname,
  '../../../node_modules/lucide-react-native/dist/esm/icons',
);
const files = new Set(
  fs.readdirSync(ICON_DIR).filter(f => f.endsWith('.js') && f !== 'index.js'),
);

// Every name lucide exports, and the file it actually lives in.
const exported = {};
for (const line of fs
  .readFileSync(path.join(ICON_DIR, '../lucide-react-native.js'), 'utf8')
  .split('\n')) {
  const m = line.match(/^export \{(.*)\} from '\.\/icons\/(.*)\.js';$/);
  if (!m) continue;
  for (const part of m[1].split(',')) {
    const n = part.trim().match(/default as (\w+)/);
    if (n) exported[n[1]] = m[2];
  }
}

describe('lucideIconFile', () => {
  it('maps every alias to a file that exists', () => {
    for (const [name, file] of Object.entries(ALIASES)) {
      expect(files.has(`${file}.js`)).toBe(true);
      expect(exported[name]).toBe(file);
    }
  });

  it('resolves every icon name the app asks for', () => {
    // ThemeIcon looks icons up by string, so a bad name renders nothing with no
    // error. Catch that here instead of in the UI.
    const iconFiles = execSync(
      "grep -rl --include='*.js' --include='*.tsx' '' " +
        'app context-store navigation',
      { cwd: root, encoding: 'utf8' },
    )
      .trim()
      .split('\n');
    const names = new Set();
    for (const f of iconFiles) {
      const src = fs.readFileSync(path.join(root, f), 'utf8');
      for (const m of src.matchAll(/'([A-Z][A-Za-z0-9]*)'/g)) names.add(m[1]);
    }
    // Files carry plenty of unrelated strings; only names lucide actually
    // exports have to resolve.
    const used = [...names].filter(n => exported[n]);
    expect(used.length).toBeGreaterThan(150);

    const unresolved = used.filter(
      n => lucideIconFile(n) !== exported[n] || !files.has(`${exported[n]}.js`),
    );
    expect(unresolved).toEqual([]);
  });
});
