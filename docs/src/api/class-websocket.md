# class: WebSocket
* since: v1.8

The [WebSocket] class represents websocket connections in the page.

## event: WebSocket.close
* since: v1.8
- argument: <[WebSocket]>

Fired when the websocket closes.

## event: WebSocket.frameReceived
* since: v1.9
- argument: <[Object]>
  - `payload` <[string]|[Buffer]> frame payload

Fired when the websocket receives a frame.

## event: WebSocket.frameReceived
* since: v1.9
* langs: csharp, java
- argument: <[WebSocketFrame]>

## event: WebSocket.frameSent
* since: v1.9
- argument: <[Object]>
  - `payload` <[string]|[Buffer]> frame payload

Fired when the websocket sends a frame.

## event: WebSocket.frameSent
* since: v1.9
* langs: csharp, java
- argument: <[WebSocketFrame]>

## event: WebSocket.socketError
* since: v1.9
- argument: <[String]>

Fired when the websocket has an error.

## method: WebSocket.isClosed
* since: v1.8
- returns: <[boolean]>

Indicates that the web socket has been closed.

## method: WebSocket.url
* since: v1.8
- returns: <[string]>

Contains the URL of the WebSocket.

## async method: WebSocket.waitForEvent
* since: v1.8
* langs: js, python
  - alias-python: expect_event
- returns: <[any]>

Waits for event to fire and passes its value into the predicate function. Returns when the predicate returns truthy
value. Will throw an error if the webSocket is closed before the event is fired. Returns the event data value.

### param: WebSocket.waitForEvent.event
* since: v1.8
- `event` <[string]>

Event name, same one would pass into `webSocket.on(event)`.

### param: WebSocket.waitForEvent.optionsOrPredicate
* since: v1.8
* langs: js
- `optionsOrPredicate` ?<[function]|[Object]>
  - `predicate` <[function]> receives the event data and resolves to truthy value when the waiting should resolve.
  - `timeout` ?<[float]> maximum time to wait for in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [`method: BrowserContext.setDefaultTimeout`].

Either a predicate that receives an event or an options object. Optional.

## async method: WebSocket.waitForFrameReceived
* since: v1.10
* langs: java
- returns: <[WebSocketFrame]>

Performs action and waits for a frame to be sent. If predicate is provided, it passes
[WebSocketFrame] value into the `predicate` function and waits for `predicate(webSocketFrame)` to return a truthy value.
Will throw an error if the WebSocket or Page is closed before the frame is received.

### option: WebSocket.waitForFrameReceived.predicate
* since: v1.9
- `predicate` <[function]\([WebSocketFrame]\):[boolean]>

Receives the [WebSocketFrame] object and resolves to truthy value when the waiting should resolve.

### option: WebSocket.waitForFrameReceived.timeout = %%-wait-for-event-timeout-%%
* since: v1.9

## async method: WebSocket.waitForFrameSent
* since: v1.10
* langs: java
- returns: <[WebSocketFrame]>

Performs action and waits for a frame to be sent. If predicate is provided, it passes
[WebSocketFrame] value into the `predicate` function and waits for `predicate(webSocketFrame)` to return a truthy value.
Will throw an error if the WebSocket or Page is closed before the frame is sent.

### option: WebSocket.waitForFrameSent.predicate
* since: v1.9
- `predicate` <[function]\([WebSocketFrame]\):[boolean]>

Receives the [WebSocketFrame] object and resolves to truthy value when the waiting should resolve.

### option: WebSocket.waitForFrameSent.timeout = %%-wait-for-event-timeout-%%
* since: v1.9

## async method: WebSocket.waitForEvent2
* since: v1.8
* langs: python
  - alias-python: wait_for_event
- returns: <[any]>

:::note
In most cases, you should use [`method: WebSocket.waitForEvent`].
:::

Waits for given `event` to fire. If predicate is provided, it passes
event's value into the `predicate` function and waits for `predicate(event)` to return a truthy value.
Will throw an error if the socket is closed before the `event` is fired.

### param: WebSocket.waitForEvent2.event = %%-wait-for-event-event-%%
* since: v1.8
### option: WebSocket.waitForEvent2.predicate = %%-wait-for-event-predicate-%%
* since: v1.8
### option: WebSocket.waitForEvent2.timeout = %%-wait-for-event-timeout-%%
* since: v1.8
