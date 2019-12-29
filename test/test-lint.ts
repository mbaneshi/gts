/**
 * Copyright 2017 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';

import { Options } from '../src/cli';
import { TSLINT_CONFIG } from '../src/init';
import { nop } from '../src/util';

import { withFixtures } from 'inline-fixtures';
import { describe, it } from 'mocha';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const format: any = {};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const lint: any = {};

describe('lint', () => {
  const OPTIONS: Options = {
    gtsRootDir: path.resolve(__dirname, '../..'),
    targetRootDir: './',
    dryRun: false,
    yes: false,
    no: false,
    logger: { log: nop, error: nop, dir: nop },
  };

  const BAD_CODE = `throw 'hello world';`;
  const GOOD_CODE = `throw new Error('hello world');`;

  // missing semicolon, array-type simple.
  const FIXABLE_CODE = 'const x : Array<string> = [];';
  const FIXABLE_CODE_FIXED = 'const x : string[] = [];';

  it('createProgram should return an object', () => {
    return withFixtures({ 'tsconfig.json': '{}' }, async () => {
      const program = lint.createProgram(OPTIONS);
      assert.ok(program);
    });
  });

  it('lint should return true on good code', () => {
    return withFixtures(
      {
        'tsconfig.json': JSON.stringify({ files: ['a.ts'] }),
        'a.ts': GOOD_CODE,
      },
      async () => {
        const okay = lint.lint(OPTIONS);
        assert.strictEqual(okay, true);
      }
    );
  });

  it('lint should return false on bad code', () => {
    return withFixtures(
      {
        'tsconfig.json': JSON.stringify({ files: ['a.ts'] }),
        'a.ts': BAD_CODE,
      },
      async () => {
        const okay = lint.lint(OPTIONS);
        assert.strictEqual(okay, false);
      }
    );
  });

  it('lint should auto fix fixable errors', () => {
    return withFixtures(
      {
        'tsconfig.json': JSON.stringify({ files: ['a.ts'] }),
        'a.ts': FIXABLE_CODE,
      },
      async fixturesDir => {
        const okay = lint.lint(OPTIONS, [], true);
        assert.strictEqual(okay, true);
        const contents = fs.readFileSync(
          path.join(fixturesDir, 'a.ts'),
          'utf8'
        );
        assert.deepStrictEqual(contents, FIXABLE_CODE_FIXED);
      }
    );
  });

  it('lint should not auto fix on dry-run', () => {
    return withFixtures(
      {
        'tsconfig.json': JSON.stringify({ files: ['a.ts'] }),
        'a.ts': FIXABLE_CODE,
      },
      async fixturesDir => {
        const optionsWithDryRun = Object.assign({}, OPTIONS, { dryRun: true });
        const okay = lint.lint(optionsWithDryRun, [], true);
        assert.strictEqual(okay, false);
        const contents = fs.readFileSync(
          path.join(fixturesDir, 'a.ts'),
          'utf8'
        );
        assert.deepStrictEqual(contents, FIXABLE_CODE);
      }
    );
  });

  it('lint should lint files listed in tsconfig.files', () => {
    return withFixtures(
      {
        'tsconfig.json': JSON.stringify({ files: ['a.ts'] }),
        'a.ts': GOOD_CODE,
        'b.ts': BAD_CODE,
      },
      async () => {
        const okay = lint.lint(OPTIONS);
        assert.strictEqual(okay, true);
      }
    );
  });

  it('lint should lint *.ts files when no files or include has been specified', () => {
    return withFixtures(
      {
        'tsconfig.json': JSON.stringify({}),
        'a.ts': GOOD_CODE,
        'b.ts': BAD_CODE,
      },
      async () => {
        const okay = lint.lint(OPTIONS);
        assert.strictEqual(okay, false);
      }
    );
  });

  it('lint should lint files listed in tsconfig.files when empty list is provided', () => {
    return withFixtures(
      {
        'tsconfig.json': JSON.stringify({ files: ['a.ts'] }),
        'a.ts': FIXABLE_CODE,
        'b.ts': BAD_CODE,
      },
      async fixturesDir => {
        const okay = lint.lint(OPTIONS, [], true);
        assert.strictEqual(okay, true);
        const contents = fs.readFileSync(
          path.join(fixturesDir, 'a.ts'),
          'utf8'
        );
        assert.deepStrictEqual(contents, FIXABLE_CODE_FIXED);
      }
    );
  });

  it('lint should not lint files listed in exclude', () => {
    return withFixtures(
      {
        'tsconfig.json': JSON.stringify({ exclude: ['b.*'] }),
        'a.ts': GOOD_CODE,
        'b.ts': BAD_CODE,
      },
      async () => {
        const okay = lint.lint(OPTIONS);
        assert.strictEqual(okay, true);
      }
    );
  });

  it('lint should lint globs listed in include', () => {
    return withFixtures(
      {
        'tsconfig.json': JSON.stringify({ include: ['dirb/*'] }),
        dira: { 'a.ts': GOOD_CODE },
        dirb: { 'b.ts': BAD_CODE },
      },
      async () => {
        const okay = lint.lint(OPTIONS);
        assert.strictEqual(okay, false);
      }
    );
  });

  it('lint should lint only specified files', () => {
    return withFixtures(
      {
        'tsconfig.json': JSON.stringify({}),
        dira: { 'a.ts': GOOD_CODE },
        dirb: { 'b.ts': BAD_CODE },
      },
      async () => {
        const aOkay = lint.lint(OPTIONS, ['dira/a.ts']);
        assert.strictEqual(aOkay, true);
        const bOkay = lint.lint(OPTIONS, ['dirb/b.ts']);
        assert.strictEqual(bOkay, false);
      }
    );
  });

  it('lint should throw for unrecognized files', () => {
    return withFixtures(
      {
        'tsconfig.json': JSON.stringify({}),
        'a.ts': GOOD_CODE,
      },
      async () => {
        assert.throws(() => {
          lint.lint(OPTIONS, ['z.ts']);
        });
      }
    );
  });

  it('lint should prefer user config file over default', async () => {
    const CUSTOM_LINT_CODE = 'debugger;';

    // By default the above should fail lint.
    await withFixtures(
      {
        'tsconfig.json': JSON.stringify({ files: ['a.ts'] }),
        'a.ts': CUSTOM_LINT_CODE,
      },
      async () => {
        const okay = lint.lint(OPTIONS);
        assert.strictEqual(okay, false);
      }
    );

    // User should be able to override the default config.
    return withFixtures(
      {
        'tsconfig.json': JSON.stringify({ files: ['a.ts'] }),
        'tslint.json': JSON.stringify({}),
        'a.ts': CUSTOM_LINT_CODE,
      },
      async () => {
        const okay = lint.lint(OPTIONS);
        assert.strictEqual(okay, true);
      }
    );
  });

  it('lint for specific files should use file-specific config', () => {
    const CODE_WITH_PARSEINT = 'parseInt(42);';
    let logBuffer = '';
    const optionsWithLog = Object.assign({}, OPTIONS, {
      logger: {
        log: (...args: string[]) => {
          logBuffer += args.join(' ');
        },
        error: nop,
        dir: nop,
      },
    });
    return withFixtures(
      {
        dira: {
          'a.ts': CODE_WITH_PARSEINT,
          // no tslint, so default should apply.
        },
        dirb: { 'b.ts': CODE_WITH_PARSEINT, 'tslint.json': JSON.stringify({}) },
      },
      async () => {
        const okay = lint.lint(optionsWithLog, ['dira/a.ts', 'dirb/b.ts']);
        assert.strictEqual(okay, false);
        assert.ok(/dira\/a\.ts/.test(logBuffer));
        assert.ok(!/dirb\/b\.ts/.test(logBuffer));
      }
    );
  });

  it('should not conflict with format', async () => {
    const FIXTURE = {
      'tsconfig.json': JSON.stringify({ files: ['far.ts'] }),
      'far.ts': `export function far(
  ceiling: string,
  vines: string,
  sailed: number,
  ocean: number,
  tumbled: string,
): string {
  return 'where the wild things are';
}
`,
    };

    // tslint should not complain about the trailing comma in functions,
    // and let prettier complain.
    await withFixtures(FIXTURE, async () => {
      const lintOkay = await lint.lint(OPTIONS, [], false);
      assert.strictEqual(lintOkay, true);
      const formatOkay = await format.format(OPTIONS, [], false);
      assert.strictEqual(formatOkay, false);
    });

    const fixtureWithPrettierConfig = {
      ...FIXTURE,
      'prettier.config.js': `module.exports = {
  singleQuote: true,
  trailingComma: 'all',
};`,
    };

    // Both the linter and the formatter should be okay with this.
    await withFixtures(fixtureWithPrettierConfig, async () => {
      const lintOkay = await lint.lint(OPTIONS, [], false);
      assert.strictEqual(lintOkay, true);
      const formatOkay = await format.format(OPTIONS, [], false);
      assert.strictEqual(formatOkay, true);
    });
  });

  it('should handle json files correctly resolveJsonModule', () => {
    return withFixtures(
      {
        'tsconfig.json': JSON.stringify({
          include: ['src'],
          compilerOptions: {
            module: 'commonjs',
            resolveJsonModule: true,
            esModuleInterop: true,
          },
        }),
        'tslint.json': JSON.stringify(TSLINT_CONFIG),
        node_modules: {
          gts: {
            'tslint-rules.json': fs.readFileSync('tslint-rules.json', 'utf8'),
            'tslint.json': fs.readFileSync('tslint.json', 'utf8'),
          },
        },
        src: {
          'a.ts': `import settings from "./test.json";`,
          'test.json': JSON.stringify({
            dry: false,
            debug: false,
          }),
        },
      },
      async () => {
        const okay = lint.lint(OPTIONS);
        assert.strictEqual(okay, true);
      }
    );
  });

  // TODO: test for when tsconfig.json is missing.
});
