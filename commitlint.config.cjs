module.exports = {
  extends: ['@commitlint/config-conventional'],

  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feature',
        'bug',
        'hotfix',
        'refactor',
        'chore',
        'docs',
        'test',
        'performance'
      ]
    ],

    'scope-enum': [
      2,
      'always',
      [
        'backend',
        'database',
        'auth',
        'ui-ux',
        'api',
        'controller',
        'model',
        'script',
        'interface',
        'route',
        'service',
        'util',
        'other'
      ]
    ],

    'scope-empty': [2, 'never'],
    'subject-empty': [2, 'never'],
    'subject-case': [0]
  }
};