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

import type { Suite, Reporter } from '../../types/testReporter';
import type { Runner } from '../runner';
import type { FullConfig } from '../types';

export interface TestRunnerPlugin {
  name: string;
  setup?(config: FullConfig, configDir: string, rootSuite: Suite, reporter: Reporter): Promise<void>;
  teardown?(): Promise<void>;
}

export { webServer } from './webServerPlugin';
export { gitCommitInfo } from './gitCommitInfoPlugin';

let runnerInstanceToAddPluginsTo: Runner | undefined;
const deferredPlugins: TestRunnerPlugin[] = [];

export const setRunnerToAddPluginsTo = (runner: Runner) => {
  runnerInstanceToAddPluginsTo = runner;
  for (const plugin of deferredPlugins)
    runnerInstanceToAddPluginsTo.addPlugin(plugin);
};

export const addRunnerPlugin = (plugin: TestRunnerPlugin | (() => TestRunnerPlugin)) => {
  plugin = typeof plugin === 'function' ? plugin() : plugin;
  if (runnerInstanceToAddPluginsTo)
    runnerInstanceToAddPluginsTo.addPlugin(plugin);
  else
    deferredPlugins.push(plugin);
};
