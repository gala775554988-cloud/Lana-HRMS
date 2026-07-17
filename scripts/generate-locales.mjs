import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const i18nPath = path.join(__dirname, '../lib/i18n.ts');

const content = fs.readFileSync(i18nPath, 'utf8');

// Extract the dictionaries block roughly or evaluate it inside a clean transpiled scope
const match = content.match(/export const dictionaries = (\{[\s\S]*?\}) as const;/);
if (!match) {
  console.error("Could not match dictionaries object inside lib/i18n.ts");
  process.exit(1);
}

// Convert TypeScript object literal to JS evaluatable string by cleaning type annotations if any inside the dictionary
const dictCode = match[1];
const evaluated = eval(`(${dictCode})`);

const localesDir = path.join(__dirname, '../locales');
if (!fs.existsSync(localesDir)) {
  fs.mkdirSync(localesDir, { recursive: true });
}

fs.writeFileSync(path.join(localesDir, 'en.json'), JSON.stringify(evaluated.en, null, 2), 'utf8');
fs.writeFileSync(path.join(localesDir, 'ar.json'), JSON.stringify(evaluated.ar, null, 2), 'utf8');

console.log("✅ Successfully generated locales/en.json and locales/ar.json from lib/i18n.ts!");
