---
id: navigations
title: "Navigations"
---

Playwright can navigate to URLs and handle navigations caused by page interactions. This guide covers common scenarios
to wait for page navigations and loading to complete.

<!-- TOC -->

## Navigation lifecycle

Playwright splits the process of showing a new document in a page into **navigation** and **loading**.

**Navigation starts** by changing the page URL or by interacting with the page (e.g., clicking a link).
The navigation intent may be canceled, for example, on hitting an unresolved DNS address or transformed into a file download.

**Navigation is committed** when the response headers have been parsed and session history is updated. Only after the
navigation succeeds (is committed), the page starts **loading** the document.

**Loading** covers getting the remaining response body over the network, parsing, executing the scripts and firing load
events:
- [`method: Page.url`] is set to the new url
- document content is loaded over network and parsed
- [`event: Page.DOMContentLoaded`] event is fired
- page executes some scripts and loads resources like stylesheets and images
- [`event: Page.load`] event is fired
- page executes dynamically loaded scripts
- `networkidle` is fired when no new network requests are made for 500 ms

## Scenarios initiated by browser UI

Navigations can be initiated by changing the URL bar, reloading the page or going back or forward in session history.

### Auto-wait

Navigating to a URL auto-waits for the page to fire the `load` event. If the page does a client-side redirect before
`load`, [`method: Page.goto`] will auto-wait for the redirected page to fire the `load` event.

```js
// Navigate the page
await page.goto('https://example.com');
```

```java
// Navigate the page
page.navigate("https://example.com");
```

```python async
# Navigate the page
await page.goto("https://example.com")
```

```python sync
# Navigate the page
page.goto("https://example.com")
```

```csharp
// Navigate the page
await page.GotoAsync("https://example.com");
```


### Custom wait

Override the default behavior to wait until a specific event, like `networkidle`.

```js
// Navigate and wait until network is idle
await page.goto('https://example.com', { waitUntil: 'networkidle' });
```

```java
// Navigate and wait until network is idle
page.navigate("https://example.com", new Page.NavigateOptions()
  .setWaitUntil(WaitUntilState.NETWORKIDLE));
```

```python async
# Navigate and wait until network is idle
await page.goto("https://example.com", wait_until="networkidle")
```

```python sync
# Navigate and wait until network is idle
page.goto("https://example.com", wait_until="networkidle")
```

```csharp
// Navigate and wait until network is idle
await page.GotoAsync("https://example.com", new PageGotoOptions { WaitUntil = WaitUntilState.NetworkIdle });
```

### Wait for element

In lazy-loaded pages, it can be useful to wait until an element is visible with [`method: Locator.waitFor`].
Alternatively, page interactions like [`method: Page.click`] auto-wait for elements.

```js
// Navigate and wait for element
await page.goto('https://example.com');
await page.locator('text=Example Domain').waitFor();

// Navigate and click element
// Click will auto-wait for the element
await page.goto('https://example.com');
await page.locator('text=Example Domain').click();
```

```java
// Navigate and wait for element
page.navigate("https://example.com");
page.locator("text=Example Domain").waitFor();

// Navigate and click element
// Click will auto-wait for the element
page.navigate("https://example.com");
page.locator("text=Example Domain").click();
```

```python async
# Navigate and wait for element
await page.goto("https://example.com")
await page.locator("text=example domain").wait_for()

# Navigate and click element
# Click will auto-wait for the element
await page.goto("https://example.com")
await page.locator("text=example domain").click()
```

```python sync
# Navigate and wait for element
page.goto("https://example.com")
page.locator("text=example domain").wait_for()

# Navigate and click element
# Click will auto-wait for the element
page.goto("https://example.com")
page.locator("text=example domain").click()
```

```csharp
// Navigate and wait for element
await page.GotoAsync("https://example.com");
await page.Locator("text=Example Domain").WaitForAsync();

// Navigate and click element
// Click will auto-wait for the element
await page.GotoAsync("https://example.com");
await page.Locator("text=Example Domain").ClickAsync();
```

### API reference
- [`method: Page.goto`]
- [`method: Page.reload`]
- [`method: Page.goBack`]
- [`method: Page.goForward`]

## Scenarios initiated by page interaction

In the scenarios below, [`method: Locator.click`] initiates a navigation and then waits for the navigation to complete.

### Auto-wait

By default, [`method: Locator.click`] will wait for the navigation step to complete. This can be combined with a page interaction on
the navigated page which would auto-wait for an element.

```js
// Click will auto-wait for navigation to complete
await page.locator('text=Login').click();

// Fill will auto-wait for element on navigated page
await page.locator('#username').fill('John Doe');
```

```java
// Click will auto-wait for navigation to complete
page.locator("text=Login").click();

// Fill will auto-wait for element on navigated page
page.locator("#username").fill("John Doe");
```

```python async
# Click will auto-wait for navigation to complete
await page.locator("text=Login").click()

# Fill will auto-wait for element on navigated page
await page.locator("#username").fill("John Doe")
```

```python sync
# Click will auto-wait for navigation to complete
page.locator("text=Login").click()

# Fill will auto-wait for element on navigated page
page.locator("#username").fill("John Doe")
```

```csharp
// Click will auto-wait for navigation to complete
await page.Locator("text=Login").ClickAsync();

// Fill will auto-wait for element on navigated page
await page.Locator("#username").FillAsync("John Doe");
```

### Custom wait

`locator.click` can be combined with [`method: Page.waitForLoadState`] to wait for a loading event.

```js
await page.locator('button').click(); // Click triggers navigation
await page.waitForLoadState('networkidle'); // This resolves after 'networkidle'
```

```java
page.locator("button").click(); // Click triggers navigation
page.waitForLoadState(LoadState.NETWORKIDLE); // This resolves after "networkidle"
```

```python async
await page.locator("button").click(); # Click triggers navigation
await page.wait_for_load_state("networkidle"); # This waits for the "networkidle"
```

```python sync
page.locator("button").click(); # Click triggers navigation
page.wait_for_load_state("networkidle"); # This waits for the "networkidle"
```

```csharp
await page.Locator("button").ClickAsync(); // Click triggers navigation
await page.WaitForLoadStateAsync(LoadState.NetworkIdle); // This resolves after "networkidle"
```

### Wait for element

In lazy-loaded pages, it can be useful to wait until an element is visible with [`method: Locator.waitFor`].
Alternatively, page interactions like [`method: Locator.click`] auto-wait for elements.

```js
// Click will auto-wait for the element and trigger navigation
await page.locator('text=Login').click();
// Wait for the element
await page.locator('#username').waitFor();

// Click triggers navigation
await page.locator('text=Login').click();
// Fill will auto-wait for element
await page.locator('#username').fill('John Doe');
```

```java
// Click will auto-wait for the element and trigger navigation
page.locator("text=Login").click();
// Wait for the element
page.locator("#username").waitFor();

// Click triggers navigation
page.locator("text=Login").click();
// Fill will auto-wait for element
page.locator("#username").fill("John Doe");
```

```python async
# Click will auto-wait for the element and trigger navigation
await page.locator("text=Login").click()
# Wait for the element
await page.locator("#username").wait_for()

# Click triggers navigation
await page.locator("text=Login").click()
# Fill will auto-wait for element
await page.locator("#username").fill("John Doe")
```

```python sync
# Click triggers navigation
page.locator("text=Login").click()
# Click will auto-wait for the element
page.locator("#username").wait_for()

# Click triggers navigation
page.locator("text=Login").click()
# Fill will auto-wait for element
page.locator("#username").fill("John Doe")
```

```csharp
// Click will auto-wait for the element and trigger navigation
await page.Locator("text=Login").ClickAsync();
// Wait for the element
await page.Locator("#username").WaitForAsync();

// Click triggers navigation
await page.Locator("text=Login").ClickAsync();
// Fill will auto-wait for element
await page.Locator("#username").FillAsync("John Doe");
```

### Asynchronous navigation

Clicking an element could trigger asynchronous processing before initiating the navigation. In these cases, it is
recommended to explicitly call [`method: Page.waitForNavigation`]. For example:
* Navigation is triggered from a `setTimeout`
* Page waits for network requests before navigation

```js
// Note that Promise.all prevents a race condition
// between clicking and waiting for a navigation.
await Promise.all([
  // Waits for the next navigation.
  // It is important to call waitForNavigation before click to set up waiting.
  page.waitForNavigation(),
  // Triggers a navigation after a timeout.
  page.locator('div.delayed-navigation').click(),
]);
```

```java
// Using waitForNavigation with a callback prevents a race condition
// between clicking and waiting for a navigation.
page.waitForNavigation(() -> { // Waits for the next navigation
  page.locator("div.delayed-navigation").click(); // Triggers a navigation after a timeout
});
```

```python async
# Waits for the next navigation. Using Python context manager
# prevents a race condition between clicking and waiting for a navigation.
async with page.expect_navigation():
    # Triggers a navigation after a timeout
    await page.locator("div.delayed-navigation").click()
```

```python sync
# Waits for the next navigation. Using Python context manager
# prevents a race condition between clicking and waiting for a navigation.
with page.expect_navigation():
    # Triggers a navigation after a timeout
    page.locator("a").click()
```

```csharp
// Using waitForNavigation with a callback prevents a race condition
// between clicking and waiting for a navigation.
await page.RunAndWaitForNavigationAsync(async () =>
{
    // Triggers a navigation after a timeout
    await page.Locator("div.delayed-navigation").ClickAsync();
});
```

### Multiple navigations

Clicking an element could trigger multiple navigations. In these cases, it is recommended to explicitly
[`method: Page.waitForNavigation`] to a specific url. For example:
* Client-side redirects issued after the `load` event
* Multiple pushes to history state

```js
// Note that Promise.all prevents a race condition
// between clicking and waiting for a navigation.
await Promise.all([
  // It is important to call waitForNavigation before click to set up waiting.
  page.waitForNavigation({ url: '**/login' }),
  // Triggers a navigation with a script redirect.
  page.locator('text=Click me').click(),
]);
```

```java
// Running action in the callback of waitForNavigation prevents a race
// condition between clicking and waiting for a navigation.
page.waitForNavigation(new Page.WaitForNavigationOptions().setUrl("**/login"), () -> {
  page.locator("a").click(); // Triggers a navigation with a script redirect
});
```

```python async
# Using Python context manager prevents a race condition
# between clicking and waiting for a navigation.
async with page.expect_navigation(url="**/login"):
    # Triggers a navigation with a script redirect
    await page.locator("a").click()
```

```python sync
# Using Python context manager prevents a race condition
# between clicking and waiting for a navigation.
with page.expect_navigation(url="**/login"):
    # Triggers a navigation with a script redirect
    page.locator("a").click()
```

```csharp
// Running action in the callback of waitForNavigation prevents a race
// condition between clicking and waiting for a navigation.
await page.RunAndWaitForNavigationAsync(async () =>
{
    // Triggers a navigation with a script redirect.
    await page.Locator("a").ClickAsync();
}, new()
{
    UrlString = "**/login"
});
```

### Loading a popup

When popup is opened, explicitly calling [`method: Page.waitForLoadState`] ensures that popup is loaded to the desired
state.

```js
// Note that Promise.all prevents a race condition
// between clicking and waiting for the popup.
const [ popup ] = await Promise.all([
  // It is important to call waitForEvent before click to set up waiting.
  page.waitForEvent('popup'),
  // Opens popup.
  page.locator('a[target="_blank"]').click(),
]);
await popup.waitForLoadState('load');
```

```java
Page popup = page.waitForPopup(() -> {
  page.locator("a[target='_blank']").click(); // Opens popup
});
popup.waitForLoadState(LoadState.LOAD);
```

```python async
async with page.expect_popup() as popup_info:
    await page.locator('a[target="_blank"]').click() # Opens popup
popup = await popup_info.value
await popup.wait_for_load_state("load")
```

```python sync
with page.expect_popup() as popup_info:
    page.locator('a[target="_blank"]').click() # Opens popup
popup = popup_info.value
popup.wait_for_load_state("load")
```

```csharp
var popup = await page.RunAndWaitForPopupAsync(async () =>
{
    await page.Locator("a[target='_blank']").ClickAsync(); // Opens popup
});
popup.WaitForLoadStateAsync(LoadState.Load);
```

### API reference
- [`method: Locator.click`]
- [`method: Page.waitForLoadState`]
- [`method: Page.waitForNavigation`]
- [`method: Page.waitForFunction`]

## Advanced patterns

For pages that have complicated loading patterns, [`method: Page.waitForFunction`] is a powerful and extensible approach
to define a custom wait criteria.

```js
await page.goto('http://example.com');
await page.waitForFunction(() => window.amILoadedYet());
// Ready to take a screenshot, according to the page itself.
await page.screenshot();
```

```java
page.navigate("http://example.com");
page.waitForFunction("() => window.amILoadedYet()");
// Ready to take a screenshot, according to the page itself.
page.screenshot();
```

```python async
await page.goto("http://example.com")
await page.wait_for_function("() => window.amILoadedYet()")
# Ready to take a screenshot, according to the page itself.
await page.screenshot()
```

```python sync
page.goto("http://example.com")
page.wait_for_function("() => window.amILoadedYet()")
# Ready to take a screenshot, according to the page itself.
page.screenshot()
```

```csharp
await page.GotoAsync("http://example.com");
await page.WaitForFunctionAsync("() => window.amILoadedYet()");
// Ready to take a screenshot, according to the page itself.
await page.ScreenshotAsync();
```

### API reference
- [`method: Page.waitForFunction`]
