/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { test, expect, stripAnsi } from './playwright-test-fixtures';
import path from 'path';

test('should return the location of a syntax error', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'error.spec.js': `
      const x = {
        foo: 'bar';
      };
    `
  });
  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(0);
  expect(result.failed).toBe(0);
  expect(result.output).toContain('error.spec.js');
  expect(result.output).toContain('(6:18)');
});

test('should print an improper error', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'error.spec.js': `
      throw 123;
    `
  });
  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(0);
  expect(result.failed).toBe(0);
  expect(result.output).toContain('123');
});

test('should print a null error', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'error.spec.js': `
      throw null;
    `
  });
  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(0);
  expect(result.failed).toBe(0);
  expect(result.output).toContain('null');
});

test('should return the location of a syntax error in typescript', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'error.spec.ts': `
      const x = {
        foo: 'bar';
      };
    `
  }, {}, {
    FORCE_COLOR: '0'
  });
  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(0);
  expect(result.failed).toBe(0);
  expect(result.output).toContain('error.spec.ts');
  expect(result.output).toContain(`'bar';`);
});

test('should allow export default form the config file', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      export default { timeout: 1000 };
    `,
    'a.test.ts': `
      const { test } = pwt;
      test('fails', async ({}, testInfo) => {
        await new Promise(f => setTimeout(f, 2000));
      });
    `
  });

  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);
  expect(result.output).toContain('Test timeout of 1000ms exceeded.');
});

test('should validate configuration object', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      export default { timeout: '1000' };
    `,
    'a.test.ts': `
      const { test } = pwt;
      test('works', () => {});
    `
  });

  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(0);
  expect(result.output).toContain('playwright.config.ts: config.timeout must be a non-negative number');
});

test('should match tests well', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      const { test } = pwt;
      test('works', () => {});
    `,
    'hello.spec.ts': `
      const { test } = pwt;
      test('works', () => {});
    `,
    'test.ts': `
      const { test } = pwt;
      test('works', () => {});
    `,
    'spec.ts': `
      const { test } = pwt;
      test('works', () => {});
    `,
    'strange.....spec.ts': `
      const { test } = pwt;
      test('works', () => {});
    `,
    'badspec.ts': `
      const { test } = pwt;
      test('bad', () => { throw new Error('badspec.ts')});
    `,
    'specspec.ts': `
      const { test } = pwt;
      test('bad', () => { throw new Error('specspec.ts')});
    `,
    'a.testtest.ts': `
      const { test } = pwt;
      test('bad', () => { throw new Error('a.testtest.ts')});
    `,
    'b.testspec.ts': `
      const { test } = pwt;
      test('bad', () => { throw new Error('b.testspec.ts')});
    `
  });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(5);
});

test('should load an mjs file', async ({ runInlineTest }) => {
  const { exitCode, passed } = await runInlineTest({
    'a.spec.mjs': `
        const { test } = pwt;
        test('succeeds', () => {
          expect(1 + 1).toBe(2);
        });
      `
  });
  expect(passed).toBe(1);
  expect(exitCode).toBe(0);
});

test('should allow using import', async ({ runInlineTest }) => {
  const { exitCode } = await runInlineTest({
    'a.spec.js': `
        import fs from 'fs';
        const { test } = pwt;
        test('succeeds', () => {
          expect(1 + 1).toBe(2);
        });
      `
  });
  expect(exitCode).toBe(0);
});

test('should load esm when package.json has type module', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.js': `
      //@no-header
      import * as fs from 'fs';
      export default { projects: [{name: 'foo'}] };
    `,
    'package.json': JSON.stringify({ type: 'module' }),
    'a.esm.test.js': `
      const { test } = pwt;
      test('check project name', ({}, testInfo) => {
        expect(testInfo.project.name).toBe('foo');
      });
    `
  });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

test('should load esm config files', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.mjs': `
      //@no-header
      import * as fs from 'fs';
      export default { projects: [{name: 'foo'}] };
    `,
    'a.test.ts': `
      const { test } = pwt;
      test('check project name', ({}, testInfo) => {
        expect(testInfo.project.name).toBe('foo');
      });
    `
  });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

test('should load ts from esm when package.json has type module', async ({ runInlineTest, nodeVersion }) => {
  // We only support experimental esm mode on Node 16+
  test.skip(nodeVersion.major < 16);
  const result = await runInlineTest({
    'playwright.config.js': `
      //@no-header
      import * as fs from 'fs';
      export default { projects: [{name: 'foo'}] };
    `,
    'package.json': JSON.stringify({ type: 'module' }),
    'a.test.js': `
      //@no-header
      import { test, expect } from '@playwright/test';
      import { bar } from './bar.js';
      test('check project name', ({}, testInfo) => {
        expect(testInfo.project.name).toBe('foo');
      });
    `,
    'bar.ts': `
      import { foo } from './foo.js';
      export const bar = foo;
    `,
    'foo.ts': `
      export const foo: string = 'foo';
    `
  });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  expect(result.output).not.toContain(`is an experimental feature`);
});

test('should filter stack trace for simple expect', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'expect-test.spec.ts': `
      const { test } = pwt;
      test('should work', () => {
        test.expect(1+1).toEqual(3);
      });
    `
  });
  expect(result.exitCode).toBe(1);
  expect(stripAnsi(result.output)).not.toContain(path.sep + `playwright-test`);
  expect(stripAnsi(result.output)).not.toContain(path.sep + `playwright-core`);
  expect(stripAnsi(result.output)).not.toContain('internal');
});

test('should filter stack trace for web-first assertions', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'expect-test.spec.ts': `
      const { test } = pwt;
      test('should work', async ({page}) => {
        await expect(page.locator('x-foo'), 'x-foo must be visible').toBeVisible({timeout: 1});
      });
    `
  });
  expect(result.exitCode).toBe(1);
  expect(stripAnsi(result.output)).not.toContain(path.sep + `playwright-test`);
  expect(stripAnsi(result.output)).not.toContain(path.sep + `playwright-core`);
  expect(stripAnsi(result.output)).not.toContain('internal');
});

test('should filter out event emitter from stack traces', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    'expect-test.spec.ts': `
      const { test } = pwt;
      const EventEmitter = require('events');
      test('should work', async ({}) => {
        const emitter = new EventEmitter();
        emitter.on('event', function handle() { expect(1).toBe(2); });
        emitter.emit('event');
      });
    `
  });
  expect(result.exitCode).toBe(1);
  const outputWithoutGoodStackFrames = stripAnsi(result.output).split('\n').filter(line => !line.includes(testInfo.outputPath())).join('\n');
  expect(outputWithoutGoodStackFrames).not.toContain('EventEmitter.emit');
});

test('should filter out syntax error stack traces', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    'expect-test.spec.ts': `
      const { test } = pwt;
      test('should work', ({}) => {
        // syntax error: cannot have await in non-async function
        await Proimse.resolve();
      });
    `
  });
  expect(result.exitCode).toBe(1);
  expect(stripAnsi(result.output)).not.toContain('babel');
  expect(stripAnsi(result.output)).not.toContain('    at ');
});

test('should filter stack trace for raw errors', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'expect-test.spec.ts': `
      const { test } = pwt;
      test('should work', async ({}) => {
        throw new Error('foobar!');
      });
    `
  });
  expect(result.exitCode).toBe(1);
  expect(stripAnsi(result.output)).toContain('foobar!');
  expect(stripAnsi(result.output)).not.toContain(path.sep + `playwright-test`);
  expect(stripAnsi(result.output)).not.toContain(path.sep + `playwright-core`);
  expect(stripAnsi(result.output)).not.toContain('internal');
});

test('should not filter out POM', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'helper.ts': `
      export function foo() {
        throw new Error('foo');
      }
    `,
    'expect-test.spec.ts': `
      const { test } = pwt;
      const { foo } = require('./helper');
      test('should work', ({}) => {
        foo();
      });
    `
  });
  expect(result.exitCode).toBe(1);
  expect(stripAnsi(result.output)).toContain('foo');
  expect(stripAnsi(result.output)).toContain('helper.ts');
  expect(stripAnsi(result.output)).toContain('expect-test.spec.ts');
  expect(stripAnsi(result.output)).not.toContain(path.sep + `playwright-test`);
  expect(stripAnsi(result.output)).not.toContain(path.sep + `playwright-core`);
  expect(stripAnsi(result.output)).not.toContain('internal');
});

test('should filter stack even without default Error.prepareStackTrace', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'expect-test.spec.ts': `
      const { test } = pwt;
      test('should work', ({}) => {
        Error.prepareStackTrace = undefined;
        throw new Error('foobar');
      });
    `
  });
  expect(result.exitCode).toBe(1);
  expect(stripAnsi(result.output)).toContain('foobar');
  expect(stripAnsi(result.output)).toContain('expect-test.spec.ts');
  expect(stripAnsi(result.output)).not.toContain(path.sep + `playwright-test`);
  expect(stripAnsi(result.output)).not.toContain(path.sep + `playwright-core`);
  expect(stripAnsi(result.output)).not.toContain('internal');
  const stackLines = stripAnsi(result.output).split('\n').filter(line => line.includes('    at '));
  expect(stackLines.length).toBe(1);
});

test('should work with cross-imports - 1', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'test1.spec.ts': `
      const { test } = pwt;
      test('test 1', async ({}) => {
        await new Promise(x => setTimeout(x, 500));
        console.log('running TEST-1');
      });
    `,
    'test2.spec.ts': `
      import * as _ from './test1.spec';
      const { test } = pwt;
      test('test 2', async ({}) => {
        await new Promise(x => setTimeout(x, 500));
        console.log('running TEST-2');
      });
    `
  }, { workers: 2 });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(2);
  expect(result.failed).toBe(0);
  expect(result.output).toContain('TEST-1');
  expect(result.output).toContain('TEST-2');
});

test('should work with cross-imports - 2', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'test1.spec.ts': `
      const { test } = pwt;
      import * as _ from './test2.spec';
      test('test 1', async ({}) => {
        await new Promise(x => setTimeout(x, 500));
        console.log('running TEST-1');
      });
    `,
    'test2.spec.ts': `
      const { test } = pwt;
      test('test 2', async ({}) => {
        await new Promise(x => setTimeout(x, 500));
        console.log('running TEST-2');
      });
    `
  }, { workers: 2, reporter: 'list' });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(2);
  expect(result.failed).toBe(0);
  expect(result.output).toContain('TEST-1');
  expect(result.output).toContain('TEST-2');
});

test('should load web server w/o esm loader in ems module', async ({ runInlineTest, nodeVersion }) => {
  // We only support experimental esm mode on Node 16+
  test.skip(nodeVersion.major < 16);
  const result = await runInlineTest({
    'playwright.config.ts': `
      //@no-header
      export default {
        webServer: {
          command: 'node ws.js',
          port: 9876,
          timeout: 5000,
        },
        projects: [{name: 'foo'}]
      }`,
    'package.json': `{ "type": "module" }`,
    'ws.js': `
      //@no-header
      console.log('NODE_OPTIONS ' + process.env.NODE_OPTIONS);
      setTimeout(() => {}, 100000);
    `,
    'a.test.ts': `
      const { test } = pwt;
      test('passes', () => {});
    `
  }, {}, { ...process.env, DEBUG: 'pw:webserver' });

  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(0);
  expect(result.output).toContain('NODE_OPTIONS undefined');
});
