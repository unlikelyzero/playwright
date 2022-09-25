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

import { test as it, expect } from './inspectorTest';

it.skip(({ mode }) => mode !== 'default');

let scriptPromise;

it.beforeEach(async ({ page, recorderPageGetter }) => {
  scriptPromise = (async () => {
    await page.pause();
  })();
  await recorderPageGetter();
});

it.afterEach(async ({ recorderPageGetter }) => {
  const recorderPage = await recorderPageGetter();
  recorderPage.click('[title="Resume (F8)"]').catch(() => {});
  await scriptPromise;
  recorderPage.click('[title="Resume (F8)"]').catch(() => {});
});

it('should support playwright.$, playwright.$$', async ({ page }) => {
  const body = await page.evaluateHandle('playwright.$("body")');
  expect(await body.evaluate<string, HTMLBodyElement>((node: HTMLBodyElement) => node.nodeName)).toBe('BODY');
  const length = await page.evaluate('playwright.$$("body").length');
  expect(length).toBe(1);
});

it('should support playwright.selector', async ({ page }) => {
  const length = await page.evaluate('playwright.selector(document.body)');
  expect(length).toBe('body');
});

it('should support playwright.locator.value', async ({ page }) => {
  await page.setContent('<div>Hello<div>');
  const handle = await page.evaluateHandle(`playwright.locator('div', { hasText: 'Hello' }).element`);
  expect(await handle.evaluate<string, HTMLDivElement>((node: HTMLDivElement) => node.nodeName)).toBe('DIV');
});

it('should support playwright.locator.values', async ({ page }) => {
  await page.setContent('<div>Hello<div>Bar</div></div>');
  expect(await page.evaluate(`playwright.locator('div', { hasText: 'Hello' }).elements.length`)).toBe(1);
  expect(await page.evaluate(`playwright.locator('div', { hasText: 'HElLo' }).elements.length`)).toBe(1);
  expect(await page.evaluate(`playwright.locator('div', { hasText: /ELL/ }).elements.length`)).toBe(0);
  expect(await page.evaluate(`playwright.locator('div', { hasText: /ELL/i }).elements.length`)).toBe(1);
  expect(await page.evaluate(`playwright.locator('div', { hasText: /Hello/ }).elements.length`)).toBe(1);
});

it('should support playwright.locator({ has })', async ({ page }) => {
  await page.setContent('<div>Hi</div><div><span>Hello</span></div>');
  expect(await page.evaluate(`playwright.locator('div', { has: playwright.locator('span') }).element.innerHTML`)).toContain('Hello');
  expect(await page.evaluate(`playwright.locator('div', { has: playwright.locator('text=Hello') }).element.innerHTML`)).toContain('span');
});
