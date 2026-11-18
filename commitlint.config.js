module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      1,
      'always',
      [
        'workspace',
        'nest-lib',
        'ikagi-api',
        'auth',
        'audit',
        'cache',
        'docker',
        'deps',
      ],
    ],
  },
};
