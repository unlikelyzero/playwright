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

/* eslint-disable no-console */

import type { Command } from 'playwright-core/lib/utilsBundle';
import fs from 'fs';
import url from 'url';
import path from 'path';
import { Runner, builtInReporters, kDefaultConfigFiles } from './runner';
import type { ConfigCLIOverrides } from './runner';
import { stopProfiling, startProfiling } from './profiler';
import type { TestFileFilter } from './util';
import { showHTMLReport } from './reporters/html';
import { baseFullConfig, defaultTimeout, fileIsModule } from './loader';
import type { TraceMode } from './types';

export function addTestCommands(program: Command) {
  addTestCommand(program);
  addShowReportCommand(program);
  addListFilesCommand(program);
}

function addTestCommand(program: Command) {
  const command = program.command('test [test-filter...]');
  command.description('run tests with Playwright Test');
  command.option('--browser <browser>', `Browser to use for tests, one of "all", "chromium", "firefox" or "webkit" (default: "chromium")`);
  command.option('--headed', `Run tests in headed browsers (default: headless)`);
  command.option('--debug', `Run tests with Playwright Inspector. Shortcut for "PWDEBUG=1" environment variable and "--timeout=0 --max-failures=1 --headed --workers=1" options`);
  command.option('-c, --config <file>', `Configuration file, or a test directory with optional ${kDefaultConfigFiles.map(file => `"${file}"`).join('/')}`);
  command.option('--forbid-only', `Fail if test.only is called (default: false)`);
  command.option('--fully-parallel', `Run all tests in parallel (default: false)`);
  command.option('-g, --grep <grep>', `Only run tests matching this regular expression (default: ".*")`);
  command.option('-gv, --grep-invert <grep>', `Only run tests that do not match this regular expression`);
  command.option('--global-timeout <timeout>', `Maximum time this test suite can run in milliseconds (default: unlimited)`);
  command.option('--ignore-snapshots', `Ignore screenshot and snapshot expectations`);
  command.option('-j, --workers <workers>', `Number of concurrent workers or percentage of logical CPU cores, use 1 to run in a single worker (default: 50%)`);
  command.option('--list', `Collect all the tests and report them, but do not run`);
  command.option('--max-failures <N>', `Stop after the first N failures`);
  command.option('--output <dir>', `Folder for output artifacts (default: "test-results")`);
  command.option('--pass-with-no-tests', `Makes test run succeed even if no tests were found`);
  command.option('--quiet', `Suppress stdio`);
  command.option('--repeat-each <N>', `Run each test N times (default: 1)`);
  command.option('--reporter <reporter>', `Reporter to use, comma-separated, can be ${builtInReporters.map(name => `"${name}"`).join(', ')} (default: "${baseFullConfig.reporter[0]}")`);
  command.option('--retries <retries>', `Maximum retry count for flaky tests, zero for no retries (default: no retries)`);
  command.option('--shard <shard>', `Shard tests and execute only the selected shard, specify in the form "current/all", 1-based, for example "3/5"`);
  command.option('--project <project-name...>', `Only run tests from the specified list of projects (default: run all projects)`);
  command.option('--group <project-group-name>', `Only run tests from the specified project group (default: run all projects from the 'default' group or just all projects if 'default' group is not defined).`);
  command.option('--timeout <timeout>', `Specify test timeout threshold in milliseconds, zero for unlimited (default: ${defaultTimeout})`);
  command.option('--trace <mode>', `Force tracing mode, can be ${kTraceModes.map(mode => `"${mode}"`).join(', ')}`);
  command.option('-u, --update-snapshots', `Update snapshots with actual results (default: only create missing snapshots)`);
  command.option('-x', `Stop after the first failure`);
  command.action(async (args, opts) => {
    try {
      await runTests(args, opts);
    } catch (e) {
      console.error(e);
      process.exit(1);
    }
  });
  command.addHelpText('afterAll', `
Arguments [test-filter...]:
  Pass arguments to filter test files. Each argument is treated as a regular expression.

Examples:
  $ npx playwright test my.spec.ts
  $ npx playwright test some.spec.ts:42
  $ npx playwright test --headed
  $ npx playwright test --browser=webkit`);
}

function addListFilesCommand(program: Command) {
  const command = program.command('list-files [file-filter...]', { hidden: true });
  command.description('List files with Playwright Test tests');
  command.option('-c, --config <file>', `Configuration file, or a test directory with optional ${kDefaultConfigFiles.map(file => `"${file}"`).join('/')}`);
  command.option('--project <project-name...>', `Only run tests from the specified list of projects (default: list all projects)`);
  command.action(async (args, opts) => {
    try {
      await listTestFiles(opts);
    } catch (e) {
      console.error(e);
      process.exit(1);
    }
  });
}

function addShowReportCommand(program: Command) {
  const command = program.command('show-report [report]');
  command.description('show HTML report');
  command.action(report => showHTMLReport(report));
  command.addHelpText('afterAll', `
Arguments [report]:
  When specified, opens given report, otherwise opens last generated report.

Examples:
  $ npx playwright show-report
  $ npx playwright show-report playwright-report`);
}

async function runTests(args: string[], opts: { [key: string]: any }) {
  await startProfiling();

  const overrides = overridesFromOptions(opts);
  if (opts.browser) {
    const browserOpt = opts.browser.toLowerCase();
    if (!['all', 'chromium', 'firefox', 'webkit'].includes(browserOpt))
      throw new Error(`Unsupported browser "${opts.browser}", must be one of "all", "chromium", "firefox" or "webkit"`);
    const browserNames = browserOpt === 'all' ? ['chromium', 'firefox', 'webkit'] : [browserOpt];
    overrides.projects = browserNames.map(browserName => {
      return {
        name: browserName,
        use: { browserName },
      };
    });
  }

  if (opts.headed || opts.debug)
    overrides.use = { headless: false };
  if (opts.debug) {
    overrides.maxFailures = 1;
    overrides.timeout = 0;
    overrides.workers = 1;
    process.env.PWDEBUG = '1';
  }
  if (opts.trace) {
    if (!kTraceModes.includes(opts.trace))
      throw new Error(`Unsupported trace mode "${opts.trace}", must be one of ${kTraceModes.map(mode => `"${mode}"`).join(', ')}`);
    overrides.use = overrides.use || {};
    overrides.use.trace = opts.trace;
  }

  // When no --config option is passed, let's look for the config file in the current directory.
  const configFileOrDirectory = opts.config ? path.resolve(process.cwd(), opts.config) : process.cwd();
  const resolvedConfigFile = Runner.resolveConfigFile(configFileOrDirectory);
  if (restartWithExperimentalTsEsm(resolvedConfigFile))
    return;

  const runner = new Runner(overrides);
  if (resolvedConfigFile)
    await runner.loadConfigFromResolvedFile(resolvedConfigFile);
  else
    await runner.loadEmptyConfig(configFileOrDirectory);

  const testFileFilters: TestFileFilter[] = args.map(arg => {
    const match = /^(.*?):(\d+):?(\d+)?$/.exec(arg);
    return {
      re: forceRegExp(match ? match[1] : arg),
      line: match ? parseInt(match[2], 10) : null,
      column: match?.[3] ? parseInt(match[3], 10) : null,
    };
  });

  const result = await runner.runAllTests({
    listOnly: !!opts.list,
    testFileFilters,
    projectFilter: opts.project || undefined,
    projectGroup: opts.group,
    watchMode: !!process.env.PW_TEST_WATCH,
    passWithNoTests: opts.passWithNoTests,
  });
  await stopProfiling(undefined);

  if (result.status === 'interrupted')
    process.exit(130);
  process.exit(result.status === 'passed' ? 0 : 1);
}


async function listTestFiles(opts: { [key: string]: any }) {
  // Redefine process.stdout.write in case config decides to pollute stdio.
  const write = process.stdout.write.bind(process.stdout);
  process.stdout.write = (() => {}) as any;
  const configFileOrDirectory = opts.config ? path.resolve(process.cwd(), opts.config) : process.cwd();
  const resolvedConfigFile = Runner.resolveConfigFile(configFileOrDirectory)!;
  if (restartWithExperimentalTsEsm(resolvedConfigFile))
    return;

  const runner = new Runner();
  await runner.loadConfigFromResolvedFile(resolvedConfigFile);
  const report = await runner.listTestFiles(resolvedConfigFile, opts.project);
  write(JSON.stringify(report), () => {
    process.exit(0);
  });
}

function forceRegExp(pattern: string): RegExp {
  const match = pattern.match(/^\/(.*)\/([gi]*)$/);
  if (match)
    return new RegExp(match[1], match[2]);
  return new RegExp(pattern, 'gi');
}

function overridesFromOptions(options: { [key: string]: any }): ConfigCLIOverrides {
  const shardPair = options.shard ? options.shard.split('/').map((t: string) => parseInt(t, 10)) : undefined;
  return {
    forbidOnly: options.forbidOnly ? true : undefined,
    fullyParallel: options.fullyParallel ? true : undefined,
    globalTimeout: options.globalTimeout ? parseInt(options.globalTimeout, 10) : undefined,
    grep: options.grep ? forceRegExp(options.grep) : undefined,
    grepInvert: options.grepInvert ? forceRegExp(options.grepInvert) : undefined,
    maxFailures: options.x ? 1 : (options.maxFailures ? parseInt(options.maxFailures, 10) : undefined),
    outputDir: options.output ? path.resolve(process.cwd(), options.output) : undefined,
    quiet: options.quiet ? options.quiet : undefined,
    repeatEach: options.repeatEach ? parseInt(options.repeatEach, 10) : undefined,
    retries: options.retries ? parseInt(options.retries, 10) : undefined,
    reporter: (options.reporter && options.reporter.length) ? options.reporter.split(',').map((r: string) => [resolveReporter(r)]) : undefined,
    shard: shardPair ? { current: shardPair[0], total: shardPair[1] } : undefined,
    timeout: options.timeout ? parseInt(options.timeout, 10) : undefined,
    ignoreSnapshots: options.ignoreSnapshots ? !!options.ignoreSnapshots : undefined,
    updateSnapshots: options.updateSnapshots ? 'all' as const : undefined,
    workers: options.workers,
  };
}

function resolveReporter(id: string) {
  if (builtInReporters.includes(id as any))
    return id;
  const localPath = path.resolve(process.cwd(), id);
  if (fs.existsSync(localPath))
    return localPath;
  return require.resolve(id, { paths: [process.cwd()] });
}

function restartWithExperimentalTsEsm(configFile: string | null): boolean {
  const nodeVersion = +process.versions.node.split('.')[0];
  // New experimental loader is only supported on Node 16+.
  if (nodeVersion < 16)
    return false;
  if (!configFile)
    return false;
  if (process.env.PW_DISABLE_TS_ESM)
    return false;
  if (process.env.PW_TS_ESM_ON)
    return false;
  if (!fileIsModule(configFile))
    return false;
  const NODE_OPTIONS = (process.env.NODE_OPTIONS || '') + experimentalLoaderOption();
  const innerProcess = require('child_process').fork(require.resolve('playwright-core/cli'), process.argv.slice(2), {
    env: {
      ...process.env,
      NODE_OPTIONS,
      PW_TS_ESM_ON: '1',
    }
  });

  innerProcess.on('close', (code: number | null) => {
    if (code !== 0 && code !== null)
      process.exit(code);
  });
  return true;
}

export function experimentalLoaderOption() {
  return ` --no-warnings --experimental-loader=${url.pathToFileURL(require.resolve('@playwright/test/lib/experimentalLoader')).toString()}`;
}

export function envWithoutExperimentalLoaderOptions(): NodeJS.ProcessEnv {
  const substring = experimentalLoaderOption();
  const result = { ...process.env };
  if (result.NODE_OPTIONS)
    result.NODE_OPTIONS = result.NODE_OPTIONS.replace(substring, '').trim() || undefined;
  return result;
}

const kTraceModes: TraceMode[] = ['on', 'off', 'on-first-retry', 'retain-on-failure'];
