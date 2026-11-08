#!/usr/bin/env node
'use strict';

/**
 * Keep the three version labels in website/index.html in sync with package.json.
 *
 * Usage:
 *   node scripts/inject-site-version.cjs          # rewrite the file
 *   node scripts/inject-site-version.cjs --check  # exit 1 when out of sync
 */

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const file = path.join(root, 'website', 'index.html');
const original = fs.readFileSync(file, 'utf8');

const replacements = [
  {
    label: 'hero version',
    pattern: /(<span class="eyebrow-version">)v\d+\.\d+\.\d+(<\/span>)/
  },
  {
    label: 'gallery caption version',
    pattern: /(<span class="caption-tag">)v\d+\.\d+\.\d+(<\/span>)/
  },
  {
    label: 'footer version',
    pattern: /(<small>)v\d+\.\d+\.\d+( · Windows x64<\/small>)/
  }
];

let next = original;
const found = [];

for (const { label, pattern } of replacements) {
  if (!pattern.test(next)) {
    console.error(`Could not find the ${label} slot in website/index.html.`);
    process.exit(2);
  }
  next = next.replace(pattern, (_match, before, after) => `${before}v${pkg.version}${after}`);
  found.push(label);
}

const checkOnly = process.argv.includes('--check');
if (checkOnly) {
  if (next !== original) {
    console.error(
      `website/index.html is out of sync with package.json (${pkg.version}). Run: npm run site:version`
    );
    process.exit(1);
  }
  console.log(`Site version matches package.json (v${pkg.version}).`);
} else {
  if (next !== original) {
    fs.writeFileSync(file, next, 'utf8');
  }
  console.log(`Synced ${found.length} version labels to v${pkg.version}.`);
}
