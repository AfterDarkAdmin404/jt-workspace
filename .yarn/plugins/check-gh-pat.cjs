'use strict';

const path = require('node:path');
const { assertGhPat } = require(
  path.resolve(__dirname, '../../tools/scripts/check-gh-pat.js'),
);

module.exports = {
  name: 'check-gh-pat',
  factory: (requireFromYarn) => {
    const { MessageName } = requireFromYarn('@yarnpkg/core');

    return {
      hooks: {
        async validateProject(_project, report) {
          try {
            assertGhPat();
          } catch (err) {
            report.reportError(MessageName?.UNNAMED ?? 0, err.message);
          }
        },
      },
    };
  },
};
