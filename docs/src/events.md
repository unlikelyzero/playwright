---
id: events
title: "Events"
---

Playwright allows listening to various types of events happening on the web page, such as network requests, creation of child pages, dedicated workers etc. There are several ways to subscribe to such events such as waiting for events or adding or removing event listeners.

## Waiting for event

Most of the time, scripts will need to wait for a particular event to happen. Below are some of the typical event awaiting patterns.

Wait for a request with the specified url using [`method: Page.waitForRequest`]:

```js
// Note that Promise.all prevents a race condition
// between clicking and waiting for the request.
const [request] = await Promise.all([
  page.waitForRequest('**/*logo*.png'),
  // This action triggers the request
  page.goto('https://wikipedia.org')
]);
console.log(request.url());
```

```java
// The callback lambda defines scope of the code that is expected to
// trigger request.
Request request = page.waitForRequest("**/*logo*.png", () -> {
  page.navigate("https://wikipedia.org");
});
System.out.println(request.url());
```

```python async
async with page.expect_request("**/*logo*.png") as first:
  await page.goto("https://wikipedia.org")
first_request = await first.value
print(first_request.url)
```

```python sync
with page.expect_request("**/*logo*.png") as first:
  page.goto("https://wikipedia.org")
print(first.value.url)
```

```csharp
var waitForRequestTask = page.WaitForRequestAsync("**/*logo*.png");
await page.GotoAsync("https://wikipedia.org");
var request = await waitForRequestTask;
Console.WriteLine(request.Url);
```

Wait for popup window:

```js
// Note that Promise.all prevents a race condition
// between clicking and waiting for the popup.
const [popup] = await Promise.all([
  // It is important to call waitForEvent first.
  page.waitForEvent('popup'),
  // This action triggers the popup
  page.evaluate('window.open()')
]);
await popup.goto('https://wikipedia.org');
```

```java
// The callback lambda defines scope of the code that is expected to
// create popup window.
Page popup = page.waitForPopup(() -> {
  page.evaluate("window.open()");
});
popup.navigate("https://wikipedia.org");
```

```python async
async with page.expect_popup() as popup:
  await page.evaluate("window.open()")
child_page = await popup.value
await child_page.goto("https://wikipedia.org")
```

```python sync
with page.expect_popup() as popup:
  page.evaluate("window.open()")
popup.value.goto("https://wikipedia.org")
```

```csharp
var popup = await page.RunAndWaitForPopupAsync(async =>
{
    await page.EvaluateAsync("window.open()");
});
await popup.GotoAsync("https://wikipedia.org");
```

## Adding/removing event listener

Sometimes, events happen in random time and instead of waiting for them, they need to be handled. Playwright supports traditional language mechanisms for subscribing and unsubscribing from the events:

```js
page.on('request', request => console.log(`Request sent: ${request.url()}`));
const listener = request => console.log(`Request finished: ${request.url()}`);
page.on('requestfinished', listener);
await page.goto('https://wikipedia.org');

page.off('requestfinished', listener);
await page.goto('https://www.openstreetmap.org/');
```

```java
page.onRequest(request -> System.out.println("Request sent: " + request.url()));
Consumer<Request> listener = request -> System.out.println("Request finished: " + request.url());
page.onRequestFinished(listener);
page.navigate("https://wikipedia.org");

// Remove previously added listener, each on* method has corresponding off*
page.offRequestFinished(listener);
page.navigate("https://www.openstreetmap.org/");
```

```python async
def print_request_sent(request):
  print("Request sent: " + request.url)

def print_request_finished(request):
  print("Request finished: " + request.url)

page.on("request", print_request_sent)
page.on("requestfinished", print_request_finished)
await page.goto("https://wikipedia.org")

page.remove_listener("requestfinished", print_request_finished)
await page.goto("https://www.openstreetmap.org/")
```

```python sync
def print_request_sent(request):
  print("Request sent: " + request.url)

def print_request_finished(request):
  print("Request finished: " + request.url)

page.on("request", print_request_sent)
page.on("requestfinished", print_request_finished)
page.goto("https://wikipedia.org")

page.remove_listener("requestfinished", print_request_finished)
page.goto("https://www.openstreetmap.org/")
```

```csharp
page.Request += (_, request) => Console.WriteLine("Request sent: " + request.Url);
void listener(object sender, IRequest request)
{
    Console.WriteLine("Request finished: " + request.Url);
};
page.RequestFinished += listener;
await page.GotoAsync("https://wikipedia.org");

// Remove previously added listener.
page.RequestFinished -= listener;
await page.GotoAsync("https://www.openstreetmap.org/");
```

## Adding one-off listeners
* langs: js, python, java

If a certain event needs to be handled once, there is a convenience API for that:

```js
page.once('dialog', dialog => dialog.accept("2021"));
await page.evaluate("prompt('Enter a number:')");
```

```java
page.onceDialog(dialog -> dialog.accept("2021"));
page.evaluate("prompt('Enter a number:')");
```

```python async
page.once("dialog", lambda dialog: dialog.accept("2021"))
await page.evaluate("prompt('Enter a number:')")
```

```python sync
page.once("dialog", lambda dialog: dialog.accept("2021"))
page.evaluate("prompt('Enter a number:')")
```
