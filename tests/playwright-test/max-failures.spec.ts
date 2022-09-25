/**
 * Copyright Microsoft Corporation. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { test, expect, stripAnsi } from './playwright-test-fixtures';

test('max-failures should work', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.js': `
      const { test } = pwt;
      for (let i = 0; i < 10; ++i) {
        test('fail_' + i, () => {
          expect(true).toBe(false);
        });
      }
    `,
    'b.spec.js': `
      const { test } = pwt;
      for (let i = 0; i < 10; ++i) {
        test('fail_' + i, () => {
          expect(true).toBe(false);
        });
      }
    `
  }, { 'max-failures': 8 });
  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(8);
  expect(result.output.split('\n').filter(l => l.includes('expect(')).length).toBe(16);
  expect(result.report.suites[0].specs.map(spec => spec.tests[0].results.length)).toEqual(new Array(10).fill(1));
  expect(result.report.suites[1].specs.map(spec => spec.tests[0].results.length)).toEqual(new Array(10).fill(1));
});

test('-x should work', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.js': `
      const { test } = pwt;
      for (let i = 0; i < 10; ++i) {
        test('fail_' + i, () => {
          expect(true).toBe(false);
        });
      }
    `,
    'b.spec.js': `
      const { test } = pwt;
      for (let i = 0; i < 10; ++i) {
        test('fail_' + i, () => {
          expect(true).toBe(false);
        });
      }
    `
  }, { '-x': true });
  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);
  expect(result.output.split('\n').filter(l => l.includes('expect(')).length).toBe(2);
});

test('max-failures should work with retries', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.js': `
      const { test } = pwt;
      for (let i = 0; i < 10; ++i) {
        test('fail_' + i, () => {
          expect(true).toBe(false);
        });
      }
    `,
  }, { 'max-failures': 2, 'retries': 4 });
  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);
  expect(result.output.split('\n').filter(l => l.includes('Received:')).length).toBe(2);
});

test('max-failures should stop workers', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.js': `
      const { test } = pwt;
      test('passed', async () => {
        await new Promise(f => setTimeout(f, 2000));
      });
      test('failed', async () => {
        test.expect(1).toBe(2);
      });
    `,
    'b.spec.js': `
      const { test } = pwt;
      test('passed short', async () => {
        await new Promise(f => setTimeout(f, 1));
      });
      test('interrupted reported as interrupted', async () => {
        console.log('\\n%%interrupted');
        await new Promise(f => setTimeout(f, 5000));
      });
      test('skipped', async () => {
        console.log('\\n%%skipped');
      });
    `,
  }, { 'max-failures': 1, 'workers': 2 });
  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(2);
  expect(result.failed).toBe(1);
  expect(result.interrupted).toBe(1);
  expect(result.skipped).toBe(1);
  expect(result.output).toContain('%%interrupted');
  expect(result.output).not.toContain('%%skipped');
});

test('max-failures should properly shutdown', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      const config = {
        testDir: './',
        maxFailures: 1,
      };
      export default config;
    `,
    'test1.spec.ts': `
      const { test } = pwt;
      test.describe('spec 1', () => {
        test('test 1', async () => {
          expect(false).toBeTruthy()
        })
      });
    `,
    'test2.spec.ts': `
      const { test } = pwt;
      test.describe('spec 2', () => {
        test('test 2', () => {
          expect(true).toBeTruthy()
        })
      });
    `,
  }, { workers: 1 });
  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);
  expect(stripAnsi(result.output)).toContain('expect(false).toBeTruthy()');
});
