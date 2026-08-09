# Cypress → Playwright

## The two differences that drive everything else

**Chains are not promises.** `cy.get('#a').click()` enqueues commands that Cypress runs
later; Playwright is plain `async`/`await` that runs now. Every ported line needs `await`.

**Retryability moves.** Cypress retries the last query in a chain until the trailing
`should()` passes. Playwright puts the retry in the assertion: `expect(locator)` polls,
`locator` itself does not. So a Cypress chain splits into a locator plus an assertion.

```js
// Cypress
cy.get('.cart').should('contain.text', '3 items');

// Playwright
await expect(page.locator('.cart')).toContainText('3 items');
```

## Cheat sheet

| Cypress | Playwright |
|---|---|
| `cy.visit('/x')` | `await page.goto('/x')` |
| `cy.get('.sel')` | `page.locator('.sel')` |
| `cy.get('[data-cy=submit]')` | `page.getByTestId('submit')` (set `testIdAttribute: 'data-cy'`) |
| `cy.contains('Save')` | `page.getByText('Save')` |
| `cy.get('button').contains('Save')` | `page.getByRole('button', { name: 'Save' })` |
| `cy.get('.sel').eq(2)` | `page.locator('.sel').nth(2)` |
| `cy.get('.sel').first()` / `.last()` | `.first()` / `.last()` |
| `cy.get('.sel').find('.child')` | `page.locator('.sel').locator('.child')` |
| `.click()` | `await locator.click()` |
| `.type('hi')` | `await locator.fill('hi')` (use `.pressSequentially()` only for key-by-key) |
| `.clear()` | `await locator.clear()` |
| `.check()` / `.uncheck()` | `await locator.check()` / `.uncheck()` |
| `.select('Blue')` | `await locator.selectOption({ label: 'Blue' })` |
| `.trigger('mouseover')` | `await locator.hover()` |
| `.scrollIntoView()` | usually unnecessary — actions auto-scroll |
| `.selectFile('f.pdf')` | `await locator.setInputFiles('f.pdf')` |
| `cy.go('back')` | `await page.goBack()` |
| `cy.reload()` | `await page.reload()` |
| `cy.url()` | `page.url()`, or `await expect(page).toHaveURL(...)` |
| `cy.title()` | `await expect(page).toHaveTitle(...)` |
| `cy.viewport(1280, 720)` | `test.use({ viewport: { width: 1280, height: 720 } })` |
| `cy.screenshot()` | `await page.screenshot({ path: 's.png' })` |
| `cy.wait(500)` | delete it — see SKILL.md |
| `cy.log(...)` | `console.log(...)`, or `test.step()` for structure |
| `Cypress.env('KEY')` | `process.env.KEY` |
| `cy.wrap(x)` | not needed — use `x` |

## Assertions

Cypress `should()` maps onto web-first assertions, which retry:

| Cypress | Playwright |
|---|---|
| `.should('be.visible')` | `await expect(locator).toBeVisible()` |
| `.should('not.exist')` | `await expect(locator).toHaveCount(0)` |
| `.should('be.disabled')` | `await expect(locator).toBeDisabled()` |
| `.should('be.checked')` | `await expect(locator).toBeChecked()` |
| `.should('have.text', 'x')` | `await expect(locator).toHaveText('x')` |
| `.should('contain.text', 'x')` | `await expect(locator).toContainText('x')` |
| `.should('have.value', 'x')` | `await expect(locator).toHaveValue('x')` |
| `.should('have.class', 'x')` | `await expect(locator).toHaveClass(/x/)` |
| `.should('have.attr', 'a', 'b')` | `await expect(locator).toHaveAttribute('a', 'b')` |
| `.should('have.length', 3)` | `await expect(locator).toHaveCount(3)` |
| `.should('have.css', 'color', 'red')` | `await expect(locator).toHaveCSS('color', 'rgb(255, 0, 0)')` |

For a condition with no built-in assertion, wrap it in `expect.toPass()` rather than looping:

```js
await expect(async () => {
  const count = await page.locator('.row').count();
  expect(count).toBeGreaterThan(3);
}).toPass();
```

## Network interception

`cy.intercept` + alias + `cy.wait('@alias')` splits into `page.route` for stubbing and
`page.waitForResponse` for synchronising.

```js
// Cypress
cy.intercept('GET', '/api/users', { fixture: 'users.json' }).as('users');
cy.visit('/');
cy.wait('@users');

// Playwright
import users from './fixtures/users.json';

await page.route('**/api/users', route => route.fulfill({ json: users }));
await page.goto('/');
```

Usually the `cy.wait('@alias')` has no replacement at all — assert on what the response
*renders* instead, which is what the test actually cares about:

```js
await expect(page.getByRole('row')).toHaveCount(3);
```

When you genuinely need the response itself, start waiting *before* the action that triggers it:

```js
const responsePromise = page.waitForResponse('**/api/users');
await page.getByRole('button', { name: 'Load' }).click();
const response = await responsePromise;
expect(response.status()).toBe(200);
```

Other mappings: pass-through with modification → `route.fetch()` then `route.fulfill()`;
`{ forceNetworkError: true }` → `route.abort()`; recording/replaying → `page.routeFromHAR()`.

## Auth and sessions

`cy.session` becomes a **setup project** that saves `storageState` once, reused by every test.

```ts
// auth.setup.ts
import { test as setup } from '@playwright/test';

setup('authenticate', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('user@example.com');
  await page.getByLabel('Password').fill('secret');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await page.context().storageState({ path: '.auth/user.json' });
});
```

```ts
// playwright.config.ts
projects: [
  { name: 'setup', testMatch: /auth\.setup\.ts/ },
  {
    name: 'chromium',
    use: { ...devices['Desktop Chrome'], storageState: '.auth/user.json' },
    dependencies: ['setup'],
  },
]
```

Never log in through the UI in each test — that is what the old suite's `cy.session` caching
was working around.

## Fixtures, commands and tasks

| Cypress | Playwright |
|---|---|
| `cy.fixture('users.json')` | `import users from './fixtures/users.json'` |
| `Cypress.Commands.add('login', ...)` | a [test fixture](https://playwright.dev/docs/test-fixtures), or a plain helper function |
| `cy.task('db:seed')` | call Node directly from a fixture or `globalSetup` — Playwright tests already run in Node |
| `beforeEach` | `test.beforeEach`, or a fixture (preferred — fixtures compose and run per-test) |
| plugins in `cypress.config.js` | `playwright.config.ts`, `globalSetup`, or fixtures |

Cypress custom commands usually become fixtures:

```ts
// fixtures.ts
export const test = base.extend<{ loggedInPage: Page }>({
  loggedInPage: async ({ page }, use) => {
    await page.goto('/dashboard');
    await use(page);
  },
});
```

Because Playwright tests run in Node rather than in the browser, `cy.task` and most plugin
escape hatches collapse into ordinary imports — read files, query databases and call APIs
directly.

## Clock and timers

| Cypress | Playwright |
|---|---|
| `cy.clock()` | `await page.clock.install()` |
| `cy.tick(1000)` | `await page.clock.runFor(1000)` |
| `cy.clock(date)` | `await page.clock.install({ time: date })` |
| — | `await page.clock.pauseAt(date)`, `await page.clock.setFixedTime(date)` |

## Things with no equivalent, by design

- **`cy.wrap` / jQuery objects** — Playwright has no jQuery layer; use locators and assertions.
- **`.its()` / `.invoke()`** — use `locator.evaluate()` sparingly, or assert on rendered output.
- **Running in the browser** — Cypress tests execute in-page; Playwright tests execute in Node
  and drive the page. Code that reached into app internals needs rethinking as an
  observable-behaviour assertion, or `page.evaluate()` where truly necessary.
- **`cy.origin`** — not needed; Playwright navigates cross-origin without ceremony.
