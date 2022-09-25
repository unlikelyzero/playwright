# class: ScreenshotAssertions
* since: v1.20
* langs: js

Playwright provides methods for comparing page and element screenshots with
expected values stored in files.

```js
expect(screenshot).toMatchSnapshot('landing-page.png');
```

## method: ScreenshotAssertions.toMatchSnapshot#1
* since: v1.22

Ensures that passed value, either a [string] or a [Buffer], matches the expected snapshot stored in the test snapshots directory.

```js
// Basic usage.
expect(await page.screenshot()).toMatchSnapshot('landing-page.png');

// Pass options to customize the snapshot comparison and have a generated name.
expect(await page.screenshot()).toMatchSnapshot('landing-page.png', {
  maxDiffPixels: 27, // allow no more than 27 different pixels.
});

// Configure image matching threshold.
expect(await page.screenshot()).toMatchSnapshot('landing-page.png', { threshold: 0.3 });

// Bring some structure to your snapshot files by passing file path segments.
expect(await page.screenshot()).toMatchSnapshot(['landing', 'step2.png']);
expect(await page.screenshot()).toMatchSnapshot(['landing', 'step3.png']);
```

Learn more about [visual comparisons](./test-snapshots.md).

### param: ScreenshotAssertions.toMatchSnapshot#1.name
* since: v1.22
- `name` <[string]|[Array]<[string]>>

Snapshot name.

### option: ScreenshotAssertions.toMatchSnapshot#1.maxDiffPixels = %%-assertions-max-diff-pixels-%%
* since: v1.22

### option: ScreenshotAssertions.toMatchSnapshot#1.maxDiffPixelRatio = %%-assertions-max-diff-pixel-ratio-%%
* since: v1.22

### option: ScreenshotAssertions.toMatchSnapshot#1.threshold = %%-assertions-threshold-%%
* since: v1.22



## method: ScreenshotAssertions.toMatchSnapshot#2
* since: v1.22

Ensures that passed value, either a [string] or a [Buffer], matches the expected snapshot stored in the test snapshots directory.

```js
// Basic usage and the file name is derived from the test name.
expect(await page.screenshot()).toMatchSnapshot();

// Pass options to customize the snapshot comparison and have a generated name.
expect(await page.screenshot()).toMatchSnapshot({
  maxDiffPixels: 27, // allow no more than 27 different pixels.
});

// Configure image matching threshold and snapshot name.
expect(await page.screenshot()).toMatchSnapshot({
  name: 'landing-page.png',
  threshold: 0.3,
});
```

Learn more about [visual comparisons](./test-snapshots.md).

### option: ScreenshotAssertions.toMatchSnapshot#2.maxDiffPixels = %%-assertions-max-diff-pixels-%%
* since: v1.22

### option: ScreenshotAssertions.toMatchSnapshot#2.maxDiffPixelRatio = %%-assertions-max-diff-pixel-ratio-%%
* since: v1.22

### option: ScreenshotAssertions.toMatchSnapshot#2.name
* since: v1.22
- `name` <[string]|[Array]<[string]>>

Snapshot name. If not passed, the test name and ordinals are used when called multiple times.

### option: ScreenshotAssertions.toMatchSnapshot#2.threshold = %%-assertions-threshold-%%
* since: v1.22

