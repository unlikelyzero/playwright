/**
 * Copyright Microsoft Corporation. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import fs from 'fs';
import path from 'path';
import type { TestError, TestInfo, TestStatus } from '../types/test';
import type { FullConfigInternal, FullProjectInternal } from './types';
import type { WorkerInitParams } from './ipc';
import type { Loader } from './loader';
import type { TestCase } from './test';
import { TimeoutManager } from './timeoutManager';
import type { Annotation, TestStepInternal } from './types';
import { addSuffixToFilePath, getContainedPath, normalizeAndSaveAttachment, sanitizeForFilePath, serializeError, trimLongString } from './util';
import { monotonicTime } from 'playwright-core/lib/utils';

export class TestInfoImpl implements TestInfo {
  private _addStepImpl: (data: Omit<TestStepInternal, 'complete'>) => TestStepInternal;
  readonly _test: TestCase;
  readonly _timeoutManager: TimeoutManager;
  readonly _startTime: number;
  readonly _startWallTime: number;
  private _hasHardError: boolean = false;
  readonly _screenshotsDir: string;
  readonly _onTestFailureImmediateCallbacks = new Map<() => Promise<void>, string>(); // fn -> title

  // ------------ TestInfo fields ------------
  readonly repeatEachIndex: number;
  readonly retry: number;
  readonly workerIndex: number;
  readonly parallelIndex: number;
  readonly project: FullProjectInternal;
  config: FullConfigInternal;
  readonly title: string;
  readonly titlePath: string[];
  readonly file: string;
  readonly line: number;
  readonly column: number;
  readonly fn: Function;
  expectedStatus: TestStatus;
  duration: number = 0;
  readonly annotations: Annotation[] = [];
  readonly attachments: TestInfo['attachments'] = [];
  status: TestStatus = 'passed';
  readonly stdout: TestInfo['stdout'] = [];
  readonly stderr: TestInfo['stderr'] = [];
  snapshotSuffix: string = '';
  readonly outputDir: string;
  readonly snapshotDir: string;
  errors: TestError[] = [];
  currentStep: TestStepInternal | undefined;

  get error(): TestError | undefined {
    return this.errors.length > 0 ? this.errors[0] : undefined;
  }

  set error(e: TestError | undefined) {
    if (e === undefined)
      throw new Error('Cannot assign testInfo.error undefined value!');
    if (!this.errors.length)
      this.errors.push(e);
    else
      this.errors[0] = e;
  }

  get timeout(): number {
    return this._timeoutManager.defaultSlotTimings().timeout;
  }

  set timeout(timeout: number) {
    // Ignored.
  }

  constructor(
    loader: Loader,
    project: FullProjectInternal,
    workerParams: WorkerInitParams,
    test: TestCase,
    retry: number,
    addStepImpl: (data: Omit<TestStepInternal, 'complete'>) => TestStepInternal,
  ) {
    this._test = test;
    this._addStepImpl = addStepImpl;
    this._startTime = monotonicTime();
    this._startWallTime = Date.now();

    this.repeatEachIndex = workerParams.repeatEachIndex;
    this.retry = retry;
    this.workerIndex = workerParams.workerIndex;
    this.parallelIndex =  workerParams.parallelIndex;
    this.project = project;
    this.config = loader.fullConfig();
    this.title = test.title;
    this.titlePath = test.titlePath();
    this.file = test.location.file;
    this.line = test.location.line;
    this.column = test.location.column;
    this.fn = test.fn;
    this.expectedStatus = test.expectedStatus;

    this._timeoutManager = new TimeoutManager(this.project.timeout);

    this.outputDir = (() => {
      const relativeTestFilePath = path.relative(this.project.testDir, test._requireFile.replace(/\.(spec|test)\.(js|ts|mjs)$/, ''));
      const sanitizedRelativePath = relativeTestFilePath.replace(process.platform === 'win32' ? new RegExp('\\\\', 'g') : new RegExp('/', 'g'), '-');
      const fullTitleWithoutSpec = test.titlePath().slice(1).join(' ');

      let testOutputDir = trimLongString(sanitizedRelativePath + '-' + sanitizeForFilePath(fullTitleWithoutSpec));
      if (project.id)
        testOutputDir += '-' + sanitizeForFilePath(project.id);
      if (this.retry)
        testOutputDir += '-retry' + this.retry;
      if (this.repeatEachIndex)
        testOutputDir += '-repeat' + this.repeatEachIndex;
      return path.join(this.project.outputDir, testOutputDir);
    })();

    this.snapshotDir = (() => {
      const relativeTestFilePath = path.relative(this.project.testDir, test._requireFile);
      return path.join(this.project.snapshotDir, relativeTestFilePath + '-snapshots');
    })();
    this._screenshotsDir = (() => {
      const relativeTestFilePath = path.relative(this.project.testDir, test._requireFile);
      return path.join(this.project._screenshotsDir, relativeTestFilePath);
    })();
  }

  private _modifier(type: 'skip' | 'fail' | 'fixme' | 'slow', modifierArgs: [arg?: any, description?: string]) {
    if (typeof modifierArgs[1] === 'function') {
      throw new Error([
        'It looks like you are calling test.skip() inside the test and pass a callback.',
        'Pass a condition instead and optional description instead:',
        `test('my test', async ({ page, isMobile }) => {`,
        `  test.skip(isMobile, 'This test is not applicable on mobile');`,
        `});`,
      ].join('\n'));
    }

    if (modifierArgs.length >= 1 && !modifierArgs[0])
      return;

    const description = modifierArgs[1];
    this.annotations.push({ type, description });
    if (type === 'slow') {
      this._timeoutManager.slow();
    } else if (type === 'skip' || type === 'fixme') {
      this.expectedStatus = 'skipped';
      throw new SkipError('Test is skipped: ' + (description || ''));
    } else if (type === 'fail') {
      if (this.expectedStatus !== 'skipped')
        this.expectedStatus = 'failed';
    }
  }

  async _runWithTimeout(cb: () => Promise<any>): Promise<void> {
    const timeoutError = await this._timeoutManager.runWithTimeout(cb);
    // Do not overwrite existing failure upon hook/teardown timeout.
    if (timeoutError && (this.status === 'passed' || this.status === 'skipped')) {
      this.status = 'timedOut';
      this.errors.push(timeoutError);
    }
    this.duration = this._timeoutManager.defaultSlotTimings().elapsed | 0;
  }

  async _runFn(fn: Function, skips?: 'allowSkips'): Promise<TestError | undefined> {
    try {
      await fn();
    } catch (error) {
      if (skips === 'allowSkips' && error instanceof SkipError) {
        if (this.status === 'passed')
          this.status = 'skipped';
      } else {
        const serialized = serializeError(error);
        this._failWithError(serialized, true /* isHardError */);
        return serialized;
      }
    }
  }

  _addStep(data: Omit<TestStepInternal, 'complete'>) {
    return this._addStepImpl(data);
  }

  _failWithError(error: TestError, isHardError: boolean) {
    // Do not overwrite any previous hard errors.
    // Some (but not all) scenarios include:
    //   - expect() that fails after uncaught exception.
    //   - fail after the timeout, e.g. due to fixture teardown.
    if (isHardError && this._hasHardError)
      return;
    if (isHardError)
      this._hasHardError = true;
    if (this.status === 'passed' || this.status === 'skipped')
      this.status = 'failed';
    this.errors.push(error);
  }

  async _runAsStep<T>(cb: () => Promise<T>, stepInfo: Omit<TestStepInternal, 'complete'>): Promise<T> {
    const step = this._addStep(stepInfo);
    try {
      const result = await cb();
      step.complete({});
      return result;
    } catch (e) {
      step.complete({ error: e instanceof SkipError ? undefined : serializeError(e) });
      throw e;
    }
  }

  _isFailure() {
    return this.status !== 'skipped' && this.status !== this.expectedStatus;
  }

  // ------------ TestInfo methods ------------

  async attach(name: string, options: { path?: string, body?: string | Buffer, contentType?: string } = {}) {
    this.attachments.push(await normalizeAndSaveAttachment(this.outputPath(), name, options));
  }

  outputPath(...pathSegments: string[]){
    fs.mkdirSync(this.outputDir, { recursive: true });
    const joinedPath = path.join(...pathSegments);
    const outputPath = getContainedPath(this.outputDir, joinedPath);
    if (outputPath)
      return outputPath;
    throw new Error(`The outputPath is not allowed outside of the parent directory. Please fix the defined path.\n\n\toutputPath: ${joinedPath}`);
  }

  snapshotPath(...pathSegments: string[]) {
    let suffix = '';
    const projectNamePathSegment = sanitizeForFilePath(this.project.name);
    if (projectNamePathSegment)
      suffix += '-' + projectNamePathSegment;
    if (this.snapshotSuffix)
      suffix += '-' + this.snapshotSuffix;
    const subPath = addSuffixToFilePath(path.join(...pathSegments), suffix);
    const snapshotPath =  getContainedPath(this.snapshotDir, subPath);
    if (snapshotPath)
      return snapshotPath;
    throw new Error(`The snapshotPath is not allowed outside of the parent directory. Please fix the defined path.\n\n\tsnapshotPath: ${subPath}`);
  }

  _screenshotPath(...pathSegments: string[]) {
    const subPath = path.join(...pathSegments);
    const screenshotPath = getContainedPath(this._screenshotsDir, subPath);
    if (screenshotPath)
      return screenshotPath;
    throw new Error(`Screenshot name "${subPath}" should not point outside of the parent directory.`);
  }

  skip(...args: [arg?: any, description?: string]) {
    this._modifier('skip', args);
  }

  fixme(...args: [arg?: any, description?: string]) {
    this._modifier('fixme', args);
  }

  fail(...args: [arg?: any, description?: string]) {
    this._modifier('fail', args);
  }

  slow(...args: [arg?: any, description?: string]) {
    this._modifier('slow', args);
  }

  setTimeout(timeout: number) {
    this._timeoutManager.setTimeout(timeout);
  }
}

class SkipError extends Error {
}
