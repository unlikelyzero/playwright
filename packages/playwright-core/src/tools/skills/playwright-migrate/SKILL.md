---
name: playwright-migrate
description: Migrate an existing test suite to Playwright from Cypress, Selenium, Puppeteer or Protractor — translate APIs, drop explicit waits in favour of auto-waiting, and restructure fixtures, interception and auth. Use when asked to port, convert or migrate tests to Playwright.
allowed-tools: Bash(npx:*) Bash(npm:*)
---

# Migrating to Playwright

The API mapping is the easy part. What makes a migration succeed or fail is the *semantic*
difference between frameworks — how they wait, how they retry, and how they isolate tests.
A literal line-by-line translation produces a suite that is slower and flakier than the one
it replaced.

## The rule that matters most

**Delete the waits.** Every explicit wait in the source suite is a workaround for a framework
that could not wait on its own. Playwright actions auto-wait for the element to be actionable,
and `expect(locator)` assertions retry until they pass or time out.

```js
// ✗ literal translation of `cy.wait(500)` / `WebDriverWait(...).until(...)`
await page.waitForTimeout(500);
await expect(page.locator('#total')).toHaveText('42');

// ✓ the assertion already retries
await expect(page.locator('#total')).toHaveText('42');
```

Porting waits across is the single most common migration mistake. If a wait seems genuinely
required, the fix is an assertion on an observable post-condition, `expect.toPass()` for
compound conditions, or `page.waitForResponse()` for a specific network round-trip — never a
fixed sleep.

## Migration workflow

1. **Stand up Playwright alongside the old suite.** `npm init playwright@latest`. Do not
   delete the old suite until the ported one passes in CI; run both for a period.
2. **Port one spec end-to-end first.** The first file surfaces the shared work — auth, base
   URL, fixtures, interception — and that scaffolding makes the rest mechanical.
3. **Port intent, not lines.** Read what the test *asserts*, then write the Playwright test
   that asserts it. Do not transcribe command-by-command.
4. **Move selectors up the priority order** while porting, rather than carrying CSS/XPath
   across verbatim. See "Selectors" below.
5. **Delete every explicit wait**, then run with `--repeat-each=5` to confirm the suite is
   stable without them.
6. **Retire the old runner** once CI is green.

Migrate incrementally: a half-ported suite that runs is worth more than a full rewrite that
does not.

## Cross-cutting differences

### Everything is awaited

Playwright is plain `async`/`await` — no command queue, no chaining. Cypress's implicit
queueing and Protractor's control flow have no equivalent, and forgetting `await` is the
most common bug in a fresh migration. Enable `@typescript-eslint/no-floating-promises`, or
run `npx playwright test --fail-on-flaky-tests` early to catch the resulting races.

### Locators are lazy, and re-resolve on use

A `Locator` is a description of how to find an element, not the element itself. It is
resolved fresh on every action, so Selenium's `StaleElementReferenceException` and the
handle-invalidation class of bug simply do not exist. Do not "re-find" elements after a
navigation or re-render, and avoid `page.$()` / `ElementHandle`, which reintroduce the
problem.

### Assertions retry; queries do not

`expect(locator).toHaveText(...)` polls until it passes. `locator.textContent()` reads once.
Port `should(...)` / `assertEquals(...)` to web-first `expect(locator)` assertions rather
than reading a value into a variable and asserting on it.

```js
// ✗ reads once, races the app
expect(await page.locator('#total').textContent()).toBe('42');

// ✓ retries until it matches
await expect(page.locator('#total')).toHaveText('42');
```

### Tests are isolated by default

Every Playwright test gets a fresh [BrowserContext] — its own cookies, storage and cache.
Suites that relied on state leaking between tests, or that manually cleared it between
tests, need neither the leak nor the cleanup. Share expensive setup (login) through
`storageState` rather than by ordering tests.

### Selectors

Port toward user-facing locators rather than transcribing what the old suite used:

`getByRole` → `getByLabel` / `getByPlaceholder` → `getByText` → `getByTestId` → CSS → XPath.

If the old suite is built on a test-id attribute, configure it once instead of rewriting
every selector:

```ts
// playwright.config.ts — makes getByTestId('submit') match [data-cy="submit"]
use: { testIdAttribute: 'data-cy' }
```

XPath and CSS still work (`page.locator('xpath=//button')`), so a mechanical first pass can
keep them and tighten later — but do not leave them as the end state.

## Framework specifics

- **Cypress** → `references/cypress.md` — chains, `cy.intercept`, `cy.session`, custom
  commands, fixtures, tasks.
- **Selenium** → `references/selenium.md` — waits, `Select`, `Actions`, frames, windows,
  page objects.
- **Puppeteer** — the APIs are close enough that most code ports as-is; the official guide
  has the full cheat sheet: https://playwright.dev/docs/puppeteer. The main changes are
  `ElementHandle` → `Locator` and dropping explicit waits.
- **Protractor** — see https://playwright.dev/docs/protractor. `waitForAngular` has no
  equivalent and is not needed; auto-waiting covers it.

## After the port

Run the new suite under repetition before trusting it — a migrated suite that passes once
often hides races that the old suite's sleeps were papering over:

```bash
npx playwright test --repeat-each=5
```

If a ported test is flaky, `trace actions --pending` identifies actions that ran while
requests were still outstanding — see the `playwright-trace` skill.
