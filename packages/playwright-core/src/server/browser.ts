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

import type * as types from './types';
import type * as channels from '@protocol/channels';
import { BrowserContext, validateBrowserContextOptions } from './browserContext';
import { Page } from './page';
import { Download } from './download';
import type { ProxySettings } from './types';
import type { ChildProcess } from 'child_process';
import type { RecentLogsCollector } from '../common/debugLogger';
import type { CallMetadata } from './instrumentation';
import { SdkObject } from './instrumentation';
import { Artifact } from './artifact';
import type { Selectors } from './selectors';

export interface BrowserProcess {
  onclose?: ((exitCode: number | null, signal: string | null) => void);
  process?: ChildProcess;
  kill(): Promise<void>;
  close(): Promise<void>;
}

export type PlaywrightOptions = {
  rootSdkObject: SdkObject;
  selectors: Selectors;
  socksProxyPort?: number;
  sdkLanguage: string,
};

export type BrowserOptions = PlaywrightOptions & {
  name: string,
  isChromium: boolean,
  channel?: string,
  artifactsDir: string;
  downloadsPath: string,
  tracesDir: string,
  headful?: boolean,
  persistent?: channels.BrowserNewContextParams,  // Undefined means no persistent context.
  browserProcess: BrowserProcess,
  customExecutablePath?: string;
  proxy?: ProxySettings,
  protocolLogger: types.ProtocolLogger,
  browserLogsCollector: RecentLogsCollector,
  slowMo?: number;
  wsEndpoint?: string;  // Only there when connected over web socket.
  originalLaunchOptions: types.LaunchOptions;
};

export abstract class Browser extends SdkObject {
  static Events = {
    Disconnected: 'disconnected',
  };

  readonly options: BrowserOptions;
  private _downloads = new Map<string, Download>();
  _defaultContext: BrowserContext | null = null;
  private _startedClosing = false;
  readonly _idToVideo = new Map<string, { context: BrowserContext, artifact: Artifact }>();
  private _contextForReuse: { context: BrowserContext, hash: string } | undefined;

  constructor(options: BrowserOptions) {
    super(options.rootSdkObject, 'browser');
    this.attribution.browser = this;
    this.options = options;
    this.instrumentation.onBrowserOpen(this);
  }

  abstract doCreateNewContext(options: channels.BrowserNewContextParams): Promise<BrowserContext>;
  abstract contexts(): BrowserContext[];
  abstract isConnected(): boolean;
  abstract version(): string;
  abstract userAgent(): string;

  async newContext(metadata: CallMetadata, options: channels.BrowserNewContextParams): Promise<BrowserContext> {
    validateBrowserContextOptions(options, this.options);
    const context = await this.doCreateNewContext(options);
    if (options.storageState)
      await context.setStorageState(metadata, options.storageState);
    return context;
  }

  async newContextForReuse(params: channels.BrowserNewContextForReuseParams, metadata: CallMetadata): Promise<{ context: BrowserContext, needsReset: boolean }> {
    const hash = BrowserContext.reusableContextHash(params);
    for (const context of this.contexts()) {
      if (context !== this._contextForReuse?.context)
        await context.close(metadata);
    }
    if (!this._contextForReuse || hash !== this._contextForReuse.hash || !this._contextForReuse.context.canResetForReuse()) {
      if (this._contextForReuse)
        await this._contextForReuse.context.close(metadata);
      this._contextForReuse = { context: await this.newContext(metadata, params), hash };
      return { context: this._contextForReuse.context, needsReset: false };
    }
    return { context: this._contextForReuse.context, needsReset: true };
  }

  _downloadCreated(page: Page, uuid: string, url: string, suggestedFilename?: string) {
    const download = new Download(page, this.options.downloadsPath || '', uuid, url, suggestedFilename);
    this._downloads.set(uuid, download);
  }

  _downloadFilenameSuggested(uuid: string, suggestedFilename: string) {
    const download = this._downloads.get(uuid);
    if (!download)
      return;
    download._filenameSuggested(suggestedFilename);
  }

  _downloadFinished(uuid: string, error?: string) {
    const download = this._downloads.get(uuid);
    if (!download)
      return;
    download.artifact.reportFinished(error);
    this._downloads.delete(uuid);
  }

  _videoStarted(context: BrowserContext, videoId: string, path: string, pageOrError: Promise<Page | Error>) {
    const artifact = new Artifact(context, path);
    this._idToVideo.set(videoId, { context, artifact });
    pageOrError.then(page => {
      if (page instanceof Page) {
        page._video = artifact;
        page.emitOnContext(BrowserContext.Events.VideoStarted, artifact);
        page.emit(Page.Events.Video, artifact);
      }
    });
  }

  _takeVideo(videoId: string): Artifact | undefined {
    const video = this._idToVideo.get(videoId);
    this._idToVideo.delete(videoId);
    return video?.artifact;
  }

  _didClose() {
    for (const context of this.contexts())
      context._browserClosed();
    if (this._defaultContext)
      this._defaultContext._browserClosed();
    this.emit(Browser.Events.Disconnected);
    this.instrumentation.onBrowserClose(this);
  }

  async close() {
    if (!this._startedClosing) {
      this._startedClosing = true;
      await this.options.browserProcess.close();
    }
    if (this.isConnected())
      await new Promise(x => this.once(Browser.Events.Disconnected, x));
  }

  async killForTests() {
    await this.options.browserProcess.kill();
  }
}
