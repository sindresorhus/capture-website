# capture-website [![Build Status](https://travis-ci.com/sindresorhus/capture-website.svg?branch=master)](https://travis-ci.com/sindresorhus/capture-website)

> Capture screenshots of websites

It uses [Puppeteer](https://github.com/GoogleChrome/puppeteer) (Chrome) under the hood.

See [capture-website-cli](https://github.com/sindresorhus/capture-website-cli) for the command-line tool.


## Install

```
$ npm install capture-website
```

Note to Linux users: If you get a "No usable sandbox!" error, you need to enable [system sandboxing](https://github.com/GoogleChrome/puppeteer/blob/master/docs/troubleshooting.md#setting-up-chrome-linux-sandbox).

<a href="https://www.patreon.com/sindresorhus">
	<img src="https://c5.patreon.com/external/logo/become_a_patron_button@2x.png" width="160">
</a>


## Usage

```js
const captureWebsite = require('capture-website');

(async () => {
	await captureWebsite.file('https://sindresorhus.com', 'screenshot.png');
})();
```


## API

### captureWebsite.file(url, filePath, [options])

Returns a `Promise<void>` that resolves when the screenshot is written to the given file path.

### captureWebsite.buffer(url, [options])

Returns a `Promise<Buffer>` with the screenshot as binary.

### captureWebsite.base64(url, [options])

Returns a `Promise<string>` with the screenshot as [Base64](https://developer.mozilla.org/en-US/docs/Web/API/WindowBase64/Base64_encoding_and_decoding).

#### url

Type: `string`

The URL, file URL, data URL, or local file path to the website.

```js
const captureWebsite = require('capture-website');

(async () => {
	await captureWebsite.file('index.html', 'local-file.png');
})();
```

#### options

Type: `Object`

##### width

Type: `number`<br>
Default: `1280`

Page width.

##### height

Type: `number`<br>
Default: `800`

Page height.

##### type

Type: `string`<br>
Values: `png` `jpeg`<br>
Default: `png`

Image type.

##### quality

Type: `number`<br>
Values: `0...1`<br>
Default: `1`

Image quality. Only for `{type: 'jpeg'}`.

##### scaleFactor

Type: `number`<br>
Default: `2`

Scale the webpage `n` times.

The default is what you would get if you captured a normal screenshot on a computer with a retina (High DPI) screen.

##### emulateDevice

Type: `string`<br>
Values: [Devices](https://github.com/GoogleChrome/puppeteer/blob/master/DeviceDescriptors.js) *(Use the `name` property)*

Make it look like the screenshot was taken on the specified device.

This overrides the `width`, `height`, `scaleFactor`, and `userAgent` options.

```js
const captureWebsite = require('capture-website');

(async () => {
	await captureWebsite.file('https://sindresorhus.com', 'screenshot.png', {
		emulateDevice: 'iPhone X'
	});
})();
```

##### fullPage

Type: `boolean`<br>
Default: `false`

Capture the full scrollable page, not just the viewport.

##### defaultBackground

Type: `boolean`<br>
Default: `true`

Include the default white background.

Disabling this lets you capture screenshots with transparency.

##### timeout

Type: `number` *(seconds)*<br>
Default: `60`

The number of seconds before giving up trying to load the page.

Specify `0` to disable the timeout.

##### delay

Type: `number` *(seconds)*<br>
Default: `0`

The number of seconds to wait after the page finished loading before capturing the screenshot.

This can be useful if you know the page has animations that you like it to finish before capturing the screenshot.

##### waitForElement

Type: `string`

Wait for a DOM element matching the given [CSS selector](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Selectors) to appear in the page and to be visible before capturing the screenshot. It times out after `options.timeout` seconds.

##### element

Type: `string`

Capture the DOM element matching the given [CSS selector](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Selectors). It will wait for the element to appear in the page and to be visible. It times out after `options.timeout` seconds.

##### hideElements

Type: `string[]`

Hide DOM elements matching the given [CSS selectors](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Selectors).

Can be useful for cleaning up the page.

This sets [`visibility: hidden`](https://stackoverflow.com/a/133064/64949) on the matched elements.

```js
const captureWebsite = require('capture-website');

(async () => {
	await captureWebsite.file('https://sindresorhus.com', 'screenshot.png', {
		hideElements: [
			'#sidebar',
			'img.ad'
		]
	});
})();
```

##### removeElements

Type: `string[]`

Remove DOM elements matching the given [CSS selectors](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Selectors).

This sets [`display: none`](https://stackoverflow.com/a/133064/64949) on the matched elements, so it could potentially break the website layout.

##### modules

Type: `string[]`

Inject [JavaScript modules](https://developers.google.com/web/fundamentals/primers/modules) into the page.

Accepts an array of inline code, absolute URLs, and local file paths (must have a `.js` extension).

```js
const captureWebsite = require('capture-website');

(async () => {
	await captureWebsite.file('https://sindresorhus.com', 'screenshot.png', {
		modules: [
			'https://sindresorhus.com/remote-file.js',
			'local-file.js',
			`
			document.body.style.backgroundColor = 'red';
			`
		]
	});
})();
```

##### scripts

Type: `string[]`

Same as the `modules` option, but instead injects the code as [`<script>` instead of `<script type="module">`](https://developers.google.com/web/fundamentals/primers/modules). Prefer the `modules` option whenever possible.

##### styles

Type: `string[]`

Inject CSS styles into the page.

Accepts an array of inline code, absolute URLs, and local file paths (must have a `.css` extension).

```js
const captureWebsite = require('capture-website');

(async () => {
	await captureWebsite.file('https://sindresorhus.com', 'screenshot.png', {
		styles: [
			'https://sindresorhus.com/remote-file.css',
			'local-file.css',
			`
			body {
				background-color: red;
			}
			`
		]
	});
})();
```

##### headers

Type: `Object`<br>
Default: `{}`

Set custom [HTTP headers](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers).

```js
const captureWebsite = require('capture-website');

(async () => {
	await captureWebsite.file('https://sindresorhus.com', 'screenshot.png', {
		headers: {
			'x-powered-by': 'https://github.com/sindresorhus/capture-website'
		}
	});
})();
```

##### userAgent

Type: `string`

Set a custom [user agent](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/User-Agent).

##### cookies

Type: `Object[]`

Set cookies in the [following format](https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md#pagesetcookiecookies).

##### authentication

Type: `Object`

Credentials for [HTTP authentication](https://developer.mozilla.org/en-US/docs/Web/HTTP/Authentication).

###### username

Type: `string`

###### password

Type: `string`

##### beforeScreenshot

Type: `Function`

The specified function is called right before the screenshot is captured. It receives the Puppeteer [`Page` instance](https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md#class-page) as the first argument and the [`browser` instance](https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md#class-browser) as the second argument. This gives you a lot of power to do custom stuff. The function can be async.

Note: Make sure to not call `page.close()` or `browser.close()`.

```js
const captureWebsite = require('capture-website');
const checkSomething = require('./check-something');

(async () => {
	await captureWebsite.file('https://sindresorhus.com', 'screenshot.png', {
		beforeScreenshot: async (page, browser) => {
			await checkSomething();
			await page.click('#activate-button');
			await page.waitForSelector('.finished');
		}
	});
})();
```

##### debug

Type: `boolean`<br>
Default: `false`

Show the browser window so you can see what it's doing.

### captureWebsite.devices

Type: `string[]`

Devices supported by the `emulateDevice` option.


## Tips

### Capturing multiple screenshots

```js
const captureWebsite = require('capture-website');

const options = {
	width: 1920,
	height: 1000
};

const items = new Map([
	['https://sindresorhus.com', 'sindresorhus'],
	['https://github.com', 'github'],
	// …
]);

(async () => {
	await Promise.all(items.map(({url, filename}) => {
		return captureWebsite.file(url, `${filename}.png`, options);
	}));
})();
```

*Check out [`filenamify-url`](https://github.com/sindresorhus/filenamify-url) if you need to create a filename from the URL.*


## FAQ

### How is this different from your [Pageres](https://github.com/sindresorhus/pageres) project?

The biggest difference is that Pageres supports capturing multiple screenshots in a single call and it automatically generates the filenames and writes the files. Also, when projects are popular and mature, like Pageres, it becomes harder to make drastic changes. There are many things I would change in Pageres today, but I don't want to risk making lots of breaking changes for such a large userbase before I know whether it will work out or not. So this package is a rethink of how I would have made Pageres had I started it today. I plan to bring some things back to Pageres over time.


## Related

- [capture-website-cli](https://github.com/sindresorhus/capture-website-cli) - CLI for this module
- [pageres](https://github.com/sindresorhus/pageres) - A different take on screenshotting websites


## License

MIT © [Sindre Sorhus](https://sindresorhus.com)
