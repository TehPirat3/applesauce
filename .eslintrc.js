module.exports = {
    parser: '@typescript-eslint/parser', // Specifies the ESLint parser
    env: {
        browser: true,
        node: true
    },
    root: true,
    parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
        project: './tsconfig.json',
        tsconfigRootDir: __dirname,
        createDefaultProgram: true
    },
    extends: [
        // 'plugin:jsx-a11y/recommended',

        'plugin:@typescript-eslint/recommended',
        'prettier', //Turns off rules that may conflict
        'plugin:prettier/recommended'
    ],
    rules: {
        '@typescript-eslint/explicit-module-boundary-types': 'error',
        '@typescript-eslint/ban-ts-comment': 'off',

        // A temporary hack related to IDE not resolving correct package.json
        'import/no-extraneous-dependencies': 'off',
        'react/prop-types': ['off'],
        'react-hooks/exhaustive-deps': ['off'],

        'no-shadow': 'off',
        '@typescript-eslint/no-shadow': 'error',

        '@typescript-eslint/no-non-null-assertion': 'warn',
        '@typescript-eslint/no-explicit-any': 'warn',
        '@typescript-eslint/no-unused-vars': 'warn',
        '@typescript-eslint/no-unsafe-return': 'error',

        'no-return-await': 'off',
        '@typescript-eslint/return-await': 'warn',

        quotes: 'off',
        '@typescript-eslint/quotes': [
            'error',
            'single',
            {
                avoidEscape: true
            }
        ],

        'no-useless-constructor': 'off',
        '@typescript-eslint/no-useless-constructor': ['error'],

        '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],

        '@typescript-eslint/no-empty-interface': [
            'error',
            {
                allowSingleExtends: false
            }
        ],

        '@typescript-eslint/no-misused-new': 'error'

        // '@typescript-eslint/no-misused-promises': [
        //     'error',
        //     {
        //         checksConditionals: true,
        //         checksVoidReturn: true
        //     }
        // ]
    },
    settings: {
        'import/resolver': {
            // See https://github.com/benmosher/eslint-plugin-import/issues/1396#issuecomment-575727774 for line below
            node: {}
        },
        'import/parsers': {
            '@typescript-eslint/parser': ['.ts', '.tsx']
        }
    }
};
