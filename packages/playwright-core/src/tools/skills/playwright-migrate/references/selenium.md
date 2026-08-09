# Selenium → Playwright

Examples are Python/Java-flavoured Selenium translated to JavaScript Playwright; the shape is
the same in every binding, and Playwright ships Python, Java and .NET clients with matching
APIs.

## What disappears

Three whole categories of Selenium code have no Playwright equivalent because the problem
they solve does not exist:

- **Explicit and implicit waits.** `WebDriverWait`, `ExpectedConditions`, `implicitly_wait`
  — actions auto-wait for actionability, assertions retry. Delete them.
- **`StaleElementReferenceException` handling.** Locators re-resolve on every use, so
  re-finding elements after a re-render is unnecessary.
- **Driver management.** No `webdriver-manager`, no `chromedriver` on PATH, no
  `driver.quit()` in a `finally`. `npx playwright install` fetches browsers; the runner
  manages lifecycle.

```js
// Selenium
WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.ID, "submit"))).click()

// Playwright — auto-waits for visible, stable, enabled and receiving events
await page.locator('#submit').click();
```

## Cheat sheet

| Selenium | Playwright |
|---|---|
| `webdriver.Chrome()` | `await chromium.launch()` (or the `page` fixture) |
| `driver.get(url)` | `await page.goto(url)` |
| `driver.find_element(By.ID, 'x')` | `page.locator('#x')` |
| `driver.find_element(By.CSS_SELECTOR, 's')` | `page.locator('s')` |
| `driver.find_element(By.XPATH, '//b')` | `page.locator('xpath=//b')` — prefer a role/text locator |
| `driver.find_element(By.LINK_TEXT, 'Home')` | `page.getByRole('link', { name: 'Home' })` |
| `driver.find_element(By.NAME, 'q')` | `page.locator('[name="q"]')` |
| `driver.find_elements(...)` | same locator — `.all()`, `.nth(i)`, `.count()` |
| `element.click()` | `await locator.click()` |
| `element.send_keys('hi')` | `await locator.fill('hi')` |
| `element.clear()` | `await locator.clear()` |
| `element.text` | `await locator.textContent()`, or assert with `toHaveText` |
| `element.get_attribute('href')` | `await locator.getAttribute('href')` |
| `element.is_displayed()` | `await expect(locator).toBeVisible()` |
| `element.is_enabled()` | `await expect(locator).toBeEnabled()` |
| `element.is_selected()` | `await expect(locator).toBeChecked()` |
| `driver.execute_script(js)` | `await page.evaluate(js)` |
| `driver.get_screenshot_as_file(p)` | `await page.screenshot({ path: p })` |
| `driver.back()` / `.forward()` | `await page.goBack()` / `.goForward()` |
| `driver.refresh()` | `await page.reload()` |
| `driver.title` | `await expect(page).toHaveTitle(...)` |
| `driver.current_url` | `await expect(page).toHaveURL(...)` |
| `driver.set_window_size(w, h)` | `test.use({ viewport: { width: w, height: h } })` |
| `driver.quit()` | handled by the runner |

## Select elements

Selenium's `Select` class becomes one method:

| Selenium | Playwright |
|---|---|
| `Select(el).select_by_visible_text('Blue')` | `await locator.selectOption({ label: 'Blue' })` |
| `Select(el).select_by_value('blue')` | `await locator.selectOption('blue')` |
| `Select(el).select_by_index(2)` | `await locator.selectOption({ index: 2 })` |
| `Select(el).select_by_*` (multi) | `await locator.selectOption(['red', 'green'])` |

## Actions

`ActionChains` mostly collapses into single locator methods:

| Selenium | Playwright |
|---|---|
| `ActionChains(d).move_to_element(el).perform()` | `await locator.hover()` |
| `ActionChains(d).drag_and_drop(a, b).perform()` | `await a.dragTo(b)` |
| `ActionChains(d).context_click(el).perform()` | `await locator.click({ button: 'right' })` |
| `ActionChains(d).double_click(el).perform()` | `await locator.dblclick()` |
| `ActionChains(d).send_keys(Keys.ENTER)` | `await page.keyboard.press('Enter')` |
| `ActionChains(d).key_down(Keys.SHIFT)...` | `await locator.click({ modifiers: ['Shift'] })` |

For genuinely low-level sequences, `page.mouse` and `page.keyboard` remain available.

## Frames and windows

```js
// Selenium: driver.switch_to.frame('checkout'); ... ; driver.switch_to.default_content()
// Playwright: no mode switching — the frame is part of the locator
await page.frameLocator('#checkout').getByRole('button', { name: 'Pay' }).click();
```

```js
// Selenium: driver.switch_to.window(driver.window_handles[1])
// Playwright: wait for the popup as it opens
const popupPromise = page.waitForEvent('popup');
await page.getByRole('link', { name: 'Terms' }).click();
const popup = await popupPromise;
await expect(popup).toHaveTitle(/Terms/);
```

Existing tabs are `context.pages()`. Alerts need no switching either — register a `dialog`
handler before the action that triggers it.

## Page objects

Page objects port over directly and remain a good pattern; store locators as fields, and let
them be lazy rather than resolving in the constructor:

```ts
export class LoginPage {
  constructor(private page: Page) {}

  // A locator, not an element — safe to build once and use after re-renders.
  readonly email = () => this.page.getByLabel('Email');

  async login(email: string, password: string) {
    await this.email().fill(email);
    await this.page.getByLabel('Password').fill(password);
    await this.page.getByRole('button', { name: 'Sign in' }).click();
  }
}
```

Drop `PageFactory` / `@FindBy` annotations and any `WebDriverWait` fields — locators cover both.

## Grid and parallelism

Selenium Grid has no direct counterpart and is usually not needed: Playwright parallelises
across worker processes locally and shards across CI machines.

| Selenium | Playwright |
|---|---|
| Grid nodes for parallelism | `workers` in the config (defaults to CPU-based) |
| Grid for cross-browser | `projects` for chromium/firefox/webkit |
| Grid for scale-out CI | `--shard=1/4` across CI jobs, then `merge-reports` |
| Remote WebDriver URL | run tests where the browsers are, or use `browserType.connect()` |
