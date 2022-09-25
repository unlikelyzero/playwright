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

const DOES_NOT_SUPPORT_UTF8_IN_TERMINAL = process.platform === 'win32' && process.env.TERM_PROGRAM !== 'vscode' && !process.env.WT_SESSION;
const POSITIVE_STATUS_MARK = DOES_NOT_SUPPORT_UTF8_IN_TERMINAL ? 'ok' : '✓ ';
const NEGATIVE_STATUS_MARK = DOES_NOT_SUPPORT_UTF8_IN_TERMINAL ? 'x ' : '✘ ';

test('render each test with project name', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { projects: [
        { name: 'foo' },
        { name: 'bar' },
      ] };
    `,
    'a.test.ts': `
      const { test } = pwt;
      test('fails', async ({}) => {
        expect(1).toBe(0);
      });
      test('passes', async ({}) => {
        expect(0).toBe(0);
      });
      test.skip('skipped', async () => {
      });
    `,
  }, { reporter: 'list', workers: '1' });
  const text = stripAnsi(result.output);

  expect(text).toContain(`${NEGATIVE_STATUS_MARK} 1 [foo] › a.test.ts:6:7 › fails`);
  expect(text).toContain(`${POSITIVE_STATUS_MARK} 2 [foo] › a.test.ts:9:7 › passes`);
  expect(text).toContain(`-  3 [foo] › a.test.ts:12:12 › skipped`);
  expect(text).toContain(`${NEGATIVE_STATUS_MARK} 4 [bar] › a.test.ts:6:7 › fails`);
  expect(text).toContain(`${POSITIVE_STATUS_MARK} 5 [bar] › a.test.ts:9:7 › passes`);
  expect(text).toContain(`-  6 [bar] › a.test.ts:12:12 › skipped`);
  expect(result.exitCode).toBe(1);
});

test('render steps', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      const { test } = pwt;
      test('passes', async ({}) => {
        await test.step('outer 1.0', async () => {
          await test.step('inner 1.1', async () => {});
          await test.step('inner 1.1', async () => {});
        });
        await test.step('outer 2.0', async () => {
          await test.step('inner 2.1', async () => {});
          await test.step('inner 2.1', async () => {});
        });
      });
    `,
  }, { reporter: 'list' }, { PW_TEST_DEBUG_REPORTERS: '1', PWTEST_TTY_WIDTH: '80' });
  const text = stripAnsi(result.output);
  const lines = text.split('\n').filter(l => l.startsWith('0 :'));
  lines.pop(); // Remove last item that contains [v] and time in ms.
  expect(lines).toEqual([
    '0 :      1 a.test.ts:6:7 › passes › outer 1.0',
    '0 :      1 a.test.ts:6:7 › passes › outer 1.0 › inner 1.1',
    '0 :      1 a.test.ts:6:7 › passes › outer 1.0',
    '0 :      1 a.test.ts:6:7 › passes › outer 1.0 › inner 1.1',
    '0 :      1 a.test.ts:6:7 › passes › outer 1.0',
    '0 :      1 a.test.ts:6:7 › passes',
    '0 :      1 a.test.ts:6:7 › passes › outer 2.0',
    '0 :      1 a.test.ts:6:7 › passes › outer 2.0 › inner 2.1',
    '0 :      1 a.test.ts:6:7 › passes › outer 2.0',
    '0 :      1 a.test.ts:6:7 › passes › outer 2.0 › inner 2.1',
    '0 :      1 a.test.ts:6:7 › passes › outer 2.0',
    '0 :      1 a.test.ts:6:7 › passes',
  ]);
});

test('very long console line should not mess terminal', async ({ runInlineTest }) => {
  const TTY_WIDTH = 80;
  const result = await runInlineTest({
    'a.test.ts': `
      const { test } = pwt;
      test('passes', async ({}) => {
        console.log('a'.repeat(80) + 'b'.repeat(20));
      });
    `,
  }, { reporter: 'list' }, { PWTEST_TTY_WIDTH: TTY_WIDTH + '' });

  const renderedText = simpleAnsiRenderer(result.output, TTY_WIDTH);
  if (process.platform === 'win32')
    expect(renderedText).toContain('  ok 1 a.test.ts:6:7 › passes');
  else
    expect(renderedText).toContain('  ✓  1 a.test.ts:6:7 › passes');
  expect(renderedText).not.toContain('     1 a.test.ts:6:7 › passes');
  expect(renderedText).toContain('a'.repeat(80) + '\n' + 'b'.repeat(20));
});

test('render retries', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      const { test } = pwt;
      test('flaky', async ({}, testInfo) => {
        expect(testInfo.retry).toBe(1);
      });
    `,
  }, { reporter: 'list', retries: '1' }, { PW_TEST_DEBUG_REPORTERS: '1', PWTEST_TTY_WIDTH: '80' });
  const text = stripAnsi(result.output);
  const lines = text.split('\n').filter(l => l.startsWith('0 :') || l.startsWith('1 :')).map(l => l.replace(/[\dm]+s/, 'XXms'));

  expect(lines).toEqual([
    `0 :   ${NEGATIVE_STATUS_MARK} 1 a.test.ts:6:7 › flaky (XXms)`,
    `1 :   ${POSITIVE_STATUS_MARK} 2 a.test.ts:6:7 › flaky (retry #1) (XXms)`,
  ]);
});

test('should truncate long test names', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { projects: [
        { name: 'foo' },
      ] };
    `,
    'a.test.ts': `
      const { test } = pwt;
      test('failure in very long name', async ({}) => {
        expect(1).toBe(0);
      });
      test('passes', async ({}) => {
      });
      test('passes 2 long name', async () => {
      });
      test.skip('skipped very long name', async () => {
      });
    `,
  }, { reporter: 'list', retries: 0 }, { PWTEST_TTY_WIDTH: 50 });
  expect(result.exitCode).toBe(1);

  const lines = stripAnsi(result.output).split('\n').slice(3, 11);
  expect(lines.every(line => line.length <= 50)).toBe(true);

  expect(lines[0]).toBe(`     1 … a.test.ts:6:7 › failure in very long name`);

  expect(lines[1]).toContain(`${NEGATIVE_STATUS_MARK} 1 …`);
  expect(lines[1]).toContain(`:6:7 › failure in very long name (`);
  expect(lines[1].length).toBe(50);

  expect(lines[2]).toBe(`     2 [foo] › a.test.ts:9:7 › passes`);

  expect(lines[3]).toContain(`${POSITIVE_STATUS_MARK} 2 [foo] › a.test.ts:9:7 › passes (`);

  expect(lines[4]).toBe(`     3 [foo] › a.test.ts:11:7 › passes 2 long name`);

  expect(lines[5]).toContain(`${POSITIVE_STATUS_MARK} 3 …`);
  expect(lines[5]).toContain(`test.ts:11:7 › passes 2 long name (`);
  expect(lines[5].length).toBe(50);

  expect(lines[6]).toBe(`     4 …› a.test.ts:13:12 › skipped very long name`);

  expect(lines[7]).toBe(`  -  4 …› a.test.ts:13:12 › skipped very long name`);
});

function simpleAnsiRenderer(text, ttyWidth) {
  let lineNumber = 0;
  let columnNumber = 0;
  const screenLines = [];
  const ensureScreenSize = () => {
    if (lineNumber < 0)
      throw new Error('Bad terminal navigation!');
    while (lineNumber >= screenLines.length)
      screenLines.push(new Array(ttyWidth).fill(''));
  };
  const print = ch => {
    ensureScreenSize();
    if (ch === '\n') {
      columnNumber = 0;
      ++lineNumber;
    } else {
      screenLines[lineNumber][columnNumber++] = ch;
      if (columnNumber === ttyWidth) {
        columnNumber = 0;
        ++lineNumber;
      }
    }
    ensureScreenSize();
  };

  let index = 0;

  const ansiCodes = [...text.matchAll(/\u001B\[(\d*)(.)/g)];
  for (const ansiCode of ansiCodes) {
    const [matchText, codeValue, codeType] = ansiCode;
    const code = (codeValue + codeType).toUpperCase();
    while (index < ansiCode.index)
      print(text[index++]);
    if (codeType.toUpperCase() === 'E') {
      // Go X lines down
      lineNumber += +codeValue;
      ensureScreenSize();
    } else if (codeType.toUpperCase() === 'A') {
      // Go X lines up
      lineNumber -= +codeValue;
      ensureScreenSize();
    } else if (code === '2K') {
      // Erase full line
      ensureScreenSize();
      screenLines[lineNumber] = new Array(ttyWidth).fill('');
    } else if (code === '0G') {
      // Go to start
      columnNumber = 0;
    } else {
      // Unsupported ANSI code (e.g. all colors).
    }
    index += matchText.length;
  }
  while (index < text.length)
    print(text[index++]);

  return screenLines.map(line => line.join('')).join('\n');
}

