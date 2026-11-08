#!/usr/bin/env node
'use strict';

/**
 * Check local links and anchors in the static site.
 *
 * Usage: node scripts/check-site-links.cjs [site-dir]
 * External http(s), mailto, tel, data and protocol-relative links are skipped.
 */

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(process.argv[2] || 'website');
if (!fs.existsSync(root)) {
  console.error(`Site directory not found: ${root}`);
  process.exit(2);
}

const pages = fs
  .readdirSync(root)
  .filter((name) => name.endsWith('.html'))
  .sort();

const problems = [];
let checked = 0;

function idsOf(html) {
  return new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]));
}

function checkPage(page) {
  const file = path.join(root, page);
  const html = fs.readFileSync(file, 'utf8');
  const ids = idsOf(html);

  for (const match of html.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
    const raw = match[1].trim();
    if (!raw) continue;
    if (/^(https?:|mailto:|tel:|data:|javascript:|\/\/)/i.test(raw)) continue;

    checked++;

    if (raw.startsWith('#')) {
      const anchor = decodeURIComponent(raw.slice(1));
      if (anchor && !ids.has(anchor)) {
        problems.push(`${page}: missing anchor ${raw}`);
      }
      continue;
    }

    const [targetPart, hash = ''] = raw.split('#');
    const [pathPart] = targetPart.split('?');
    if (!pathPart) continue;

    const resolved = path.resolve(path.dirname(file), decodeURIComponent(pathPart));
    if (resolved !== root && !resolved.startsWith(root + path.sep)) {
      problems.push(`${page}: link escapes the site root: ${raw}`);
      continue;
    }
    if (!fs.existsSync(resolved)) {
      problems.push(`${page}: missing file ${raw}`);
      continue;
    }

    if (hash && resolved.endsWith('.html')) {
      const targetHtml = fs.readFileSync(resolved, 'utf8');
      if (!idsOf(targetHtml).has(decodeURIComponent(hash))) {
        problems.push(`${page}: missing anchor ${raw}`);
      }
    }
  }
}

for (const page of pages) {
  checkPage(page);
}

if (problems.length) {
  console.error(`Broken local links (${problems.length}):`);
  for (const problem of problems) console.error(`- ${problem}`);
  process.exit(1);
}

console.log(`Checked ${checked} local links across ${pages.length} page(s): OK.`);
