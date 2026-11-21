#!/usr/bin/env node
'use strict';

const SETUP_ERROR = [
  'ERROR: GH_PAT environment variable is missing or empty.',
  'A GitHub Personal Access Token (with read:packages scope) is required for npm/yarn operations.',
  'See npm-auth-setup.md in the workspace root for setup instructions.',
].join('\n');

function hasValidGhPat(env = process.env) {
  return typeof env.GH_PAT === 'string' && env.GH_PAT.trim().length > 0;
}

function assertGhPat(env = process.env) {
  if (!hasValidGhPat(env)) {
    throw new Error(SETUP_ERROR);
  }
}

if (require.main === module) {
  try {
    assertGhPat();
  } catch (err) {
    process.stderr.write(`${err.message}\n`);
    process.exit(1);
  }
}

module.exports = { hasValidGhPat, assertGhPat, SETUP_ERROR };
