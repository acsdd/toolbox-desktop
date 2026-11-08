#!/usr/bin/env node
'use strict';

/**
 * Build a categorized release-notes draft from git history.
 *
 * Usage:
 *   node scripts/release-notes.cjs [--to <ref>] [--from <ref>] [--out <file>]
 *
 * With no --from, the previous tag is used. When there is no previous tag
 * (first release), all history up to --to is included.
 */

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

function tryGit(args) {
  try {
    return execFileSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
  } catch {
    return '';
  }
}

const argv = process.argv.slice(2);
function argValue(name) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

const to = argValue('--to') || 'HEAD';
const outFile = argValue('--out');
let from = argValue('--from');

if (!from) {
  from = tryGit(['describe', '--tags', '--abbrev=0', `${to}^`]);
}

let raw;
if (from) {
  raw = tryGit(['log', '--no-merges', '--pretty=format:%H%x09%s', `${from}..${to}`]);
} else {
  // First release: include the whole history reachable from the target.
  raw = tryGit(['log', '--no-merges', '--pretty=format:%H%x09%s', to]);
}

const commits = raw
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean)
  .map((line) => {
    const tab = line.indexOf('\t');
    return { hash: line.slice(0, tab), subject: line.slice(tab + 1) };
  });

const CATEGORY_ORDER = [
  'Features',
  'Fixes',
  'Performance',
  'Docs',
  'Website',
  'Build and CI',
  'Tests',
  'Maintenance',
  'Other'
];

const buckets = new Map(CATEGORY_ORDER.map((name) => [name, []]));

function categorize(commit) {
  const match = /^(\w+)(?:\([^)]*\))?!?:\s*(.+)$/.exec(commit.subject);
  if (match) {
    const kind = match[1].toLowerCase();
    const text = match[2].trim();
    const map = {
      feat: 'Features',
      feature: 'Features',
      fix: 'Fixes',
      bugfix: 'Fixes',
      perf: 'Performance',
      docs: 'Docs',
      doc: 'Docs',
      build: 'Build and CI',
      ci: 'Build and CI',
      test: 'Tests',
      tests: 'Tests',
      refactor: 'Maintenance',
      chore: 'Maintenance',
      style: 'Maintenance'
    };
    return { category: map[kind] || 'Other', text };
  }

  // No conventional prefix: infer from the touched paths.
  const paths = tryGit(['show', '--name-only', '--pretty=format:', commit.hash])
    .split('\n')
    .map((value) => value.trim())
    .filter(Boolean);

  if (paths.length && paths.every((file) => file.startsWith('docs/'))) {
    return { category: 'Docs', text: commit.subject };
  }
  if (paths.length && paths.every((file) => file.startsWith('website/'))) {
    return { category: 'Website', text: commit.subject };
  }
  if (
    paths.length &&
    paths.every((file) => file.startsWith('.github/') || file.startsWith('scripts/'))
  ) {
    return { category: 'Build and CI', text: commit.subject };
  }
  return { category: 'Other', text: commit.subject };
}

for (const commit of commits) {
  const { category, text } = categorize(commit);
  buckets.get(category).push(`- ${text} (${commit.hash.slice(0, 7)})`);
}

const sections = [];
if (from) {
  sections.push(`Changes since \`${from}\`.`);
}
for (const name of CATEGORY_ORDER) {
  const items = buckets.get(name);
  if (items.length) {
    sections.push(`### ${name}\n\n${items.join('\n')}`);
  }
}

if (sections.length === 0) {
  sections.push('_No user-facing changes._');
}

const notes = `## What's changed\n\n${sections.join('\n\n')}\n`;

if (outFile) {
  const target = path.resolve(root, outFile);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, notes, 'utf8');
  process.stdout.write(`Wrote ${path.relative(root, target)} (${commits.length} commits).\n`);
} else {
  process.stdout.write(notes);
}
