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

import type {
  TestType,
  PlaywrightTestArgs,
  PlaywrightTestConfig as BasePlaywrightTestConfig,
  PlaywrightTestOptions,
  PlaywrightWorkerArgs,
  PlaywrightWorkerOptions,
  Locator,
} from '@playwright/test';
import type { InlineConfig } from 'vite';

export type PlaywrightTestConfig = Omit<BasePlaywrightTestConfig, 'use'> & {
  use?: BasePlaywrightTestConfig['use'] & {
    ctPort?: number,
    ctTemplateDir?: string,
    ctCacheDir?: string,
    ctViteConfig?: InlineConfig
  }
};

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonObject | JsonArray;
type JsonArray = JsonValue[];
type JsonObject = { [Key in string]?: JsonValue };

type Slot = string | string[];

export interface MountOptions<Props = Record<string, unknown>> {
  props?: Props;
  slots?: Record<string, Slot> & { default?: Slot };
  on?: Record<string, Function>;
  hooksConfig?: JsonObject;
}

interface MountResult<Props = Record<string, unknown>> extends Locator {
  unmount(): Promise<void>;
  rerender(options: { props: Props }): Promise<void>
}

export interface ComponentFixtures {
  mount(component: JSX.Element): Promise<MountResult>;
  mount(component: any, options?: MountOptions): Promise<MountResult>;
  mount<Props>(component: any, options: MountOptions & { props: Props }): Promise<MountResult<Props>>;
}

export const test: TestType<
  PlaywrightTestArgs & PlaywrightTestOptions & ComponentFixtures,
  PlaywrightWorkerArgs & PlaywrightWorkerOptions>;

export { expect, devices } from '@playwright/test';
