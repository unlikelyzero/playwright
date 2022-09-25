/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License");
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

import type { BrowserType } from '../browserType';
import { BrowserDispatcher } from './browserDispatcher';
import type * as channels from '@protocol/channels';
import type { RootDispatcher } from './dispatcher';
import { Dispatcher } from './dispatcher';
import { BrowserContextDispatcher } from './browserContextDispatcher';
import type { CallMetadata } from '../instrumentation';
import { JsonPipeDispatcher } from '../dispatchers/jsonPipeDispatcher';
import { getUserAgent } from '../../common/userAgent';
import * as socks from '../../common/socksProxy';
import EventEmitter from 'events';
import { ProgressController } from '../progress';
import type { Progress } from '../progress';
import { WebSocketTransport } from '../transport';
import { findValidator, ValidationError, type ValidatorContext } from '../../protocol/validator';
import { fetchData } from '../../common/netUtils';
import type { HTTPRequestParams } from '../../common/netUtils';
import type http from 'http';

export class BrowserTypeDispatcher extends Dispatcher<BrowserType, channels.BrowserTypeChannel, RootDispatcher> implements channels.BrowserTypeChannel {
  _type_BrowserType = true;
  constructor(scope: RootDispatcher, browserType: BrowserType) {
    super(scope, browserType, 'BrowserType', {
      executablePath: browserType.executablePath(),
      name: browserType.name()
    });
  }

  async launch(params: channels.BrowserTypeLaunchParams, metadata: CallMetadata): Promise<channels.BrowserTypeLaunchResult> {
    const browser = await this._object.launch(metadata, params);
    return { browser: new BrowserDispatcher(this, browser) };
  }

  async launchPersistentContext(params: channels.BrowserTypeLaunchPersistentContextParams, metadata: CallMetadata): Promise<channels.BrowserTypeLaunchPersistentContextResult> {
    const browserContext = await this._object.launchPersistentContext(metadata, params.userDataDir, params);
    return { context: new BrowserContextDispatcher(this, browserContext) };
  }

  async connectOverCDP(params: channels.BrowserTypeConnectOverCDPParams, metadata: CallMetadata): Promise<channels.BrowserTypeConnectOverCDPResult> {
    const browser = await this._object.connectOverCDP(metadata, params.endpointURL, params, params.timeout);
    const browserDispatcher = new BrowserDispatcher(this, browser);
    return {
      browser: browserDispatcher,
      defaultContext: browser._defaultContext ? new BrowserContextDispatcher(browserDispatcher, browser._defaultContext) : undefined,
    };
  }

  async connect(params: channels.BrowserTypeConnectParams, metadata: CallMetadata): Promise<channels.BrowserTypeConnectResult> {
    const controller = new ProgressController(metadata, this._object);
    controller.setLogName('browser');
    return await controller.run(async progress => {
      const paramsHeaders = Object.assign({ 'User-Agent': getUserAgent() }, params.headers || {});
      const wsEndpoint = await urlToWSEndpoint(progress, params.wsEndpoint);

      const transport = await WebSocketTransport.connect(progress, wsEndpoint, paramsHeaders, true);
      let socksInterceptor: SocksInterceptor | undefined;
      const pipe = new JsonPipeDispatcher(this);
      transport.onmessage = json => {
        if (json.method === '__create__' && json.params.type === 'SocksSupport')
          socksInterceptor = new SocksInterceptor(transport, params.socksProxyRedirectPortForTest, json.params.guid);
        if (socksInterceptor?.interceptMessage(json))
          return;
        const cb = () => {
          try {
            pipe.dispatch(json);
          } catch (e) {
            transport.close();
          }
        };
        if (params.slowMo)
          setTimeout(cb, params.slowMo);
        else
          cb();
      };
      pipe.on('message', message => {
        transport.send(message);
      });
      transport.onclose = () => {
        socksInterceptor?.cleanup();
        pipe.wasClosed();
      };
      pipe.on('close', () => transport.close());
      return { pipe };
    }, params.timeout || 0);
  }
}

class SocksInterceptor {
  private _handler: socks.SocksProxyHandler;
  private _channel: channels.SocksSupportChannel & EventEmitter;
  private _socksSupportObjectGuid: string;
  private _ids = new Set<number>();

  constructor(transport: WebSocketTransport, redirectPortForTest: number | undefined, socksSupportObjectGuid: string) {
    this._handler = new socks.SocksProxyHandler(redirectPortForTest);
    this._socksSupportObjectGuid = socksSupportObjectGuid;

    let lastId = -1;
    this._channel = new Proxy(new EventEmitter(), {
      get: (obj: any, prop) => {
        if ((prop in obj) || obj[prop] !== undefined || typeof prop !== 'string')
          return obj[prop];
        return (params: any) => {
          try {
            const id = --lastId;
            this._ids.add(id);
            const validator = findValidator('SocksSupport', prop, 'Params');
            params = validator(params, '', { tChannelImpl: tChannelForSocks, binary: 'toBase64' });
            transport.send({ id, guid: socksSupportObjectGuid, method: prop, params, metadata: { stack: [], apiName: '', internal: true } } as any);
          } catch (e) {
          }
        };
      },
    }) as channels.SocksSupportChannel & EventEmitter;
    this._handler.on(socks.SocksProxyHandler.Events.SocksConnected, (payload: socks.SocksSocketConnectedPayload) => this._channel.socksConnected(payload));
    this._handler.on(socks.SocksProxyHandler.Events.SocksData, (payload: socks.SocksSocketDataPayload) => this._channel.socksData(payload));
    this._handler.on(socks.SocksProxyHandler.Events.SocksError, (payload: socks.SocksSocketErrorPayload) => this._channel.socksError(payload));
    this._handler.on(socks.SocksProxyHandler.Events.SocksFailed, (payload: socks.SocksSocketFailedPayload) => this._channel.socksFailed(payload));
    this._handler.on(socks.SocksProxyHandler.Events.SocksEnd, (payload: socks.SocksSocketEndPayload) => this._channel.socksEnd(payload));
    this._channel.on('socksRequested', payload => this._handler.socketRequested(payload));
    this._channel.on('socksClosed', payload => this._handler.socketClosed(payload));
    this._channel.on('socksData', payload => this._handler.sendSocketData(payload));
  }

  cleanup() {
    this._handler.cleanup();
  }

  interceptMessage(message: any): boolean {
    if (this._ids.has(message.id)) {
      this._ids.delete(message.id);
      return true;
    }
    if (message.guid === this._socksSupportObjectGuid) {
      const validator = findValidator('SocksSupport', message.method, 'Event');
      const params = validator(message.params, '', { tChannelImpl: tChannelForSocks, binary: 'fromBase64' });
      this._channel.emit(message.method, params);
      return true;
    }
    return false;
  }
}

function tChannelForSocks(names: '*' | string[], arg: any, path: string, context: ValidatorContext) {
  throw new ValidationError(`${path}: channels are not expected in SocksSupport`);
}

async function urlToWSEndpoint(progress: Progress, endpointURL: string): Promise<string> {
  if (endpointURL.startsWith('ws'))
    return endpointURL;

  progress.log(`<ws preparing> retrieving websocket url from ${endpointURL}`);
  const fetchUrl = new URL(endpointURL);
  if (!fetchUrl.pathname.endsWith('/'))
    fetchUrl.pathname += '/';
  fetchUrl.pathname += 'json';
  const json = await fetchData({
    url: fetchUrl.toString(),
    method: 'GET',
    timeout: progress.timeUntilDeadline(),
    headers: { 'User-Agent': getUserAgent() },
  }, async (params: HTTPRequestParams, response: http.IncomingMessage) => {
    return new Error(`Unexpected status ${response.statusCode} when connecting to ${fetchUrl.toString()}.\n` +
        `This does not look like a Playwright server, try connecting via ws://.`);
  });
  progress.throwIfAborted();

  const wsUrl = new URL(endpointURL);
  let wsEndpointPath = JSON.parse(json).wsEndpointPath;
  if (wsEndpointPath.startsWith('/'))
    wsEndpointPath = wsEndpointPath.substring(1);
  if (!wsUrl.pathname.endsWith('/'))
    wsUrl.pathname += '/';
  wsUrl.pathname += wsEndpointPath;
  wsUrl.protocol = wsUrl.protocol === 'https:' ? 'wss:' : 'ws:';
  return wsUrl.toString();
}
