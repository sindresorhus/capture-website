# capture-website

> Capture screenshots of websites

It uses [Puppeteer](https://github.com/GoogleChrome/puppeteer) (Chrome) under the hood.

See [capture-website-cli](https://github.com/sindresorhus/capture-website-cli) for the command-line tool.

## Install

```sh
npm install capture-website
```

Note to Linux users: If you get a sandbox-related error, you need to enable [system sandboxing](#im-getting-a-sandbox-related-error).

## Usage

```js
import captureWebsite from 'capture-website';

await captureWebsite.file('https://sindresorhus.com', 'screenshot.png');
```

## API

### captureWebsite.file(input, outputFilePath, options?)

Capture a screenshot of the given `input` and save it to the given `outputFilePath`.

Intermediate directories are created for you if they do not exist.

Returns a `Promise<void>` that resolves when the screenshot is written.

### captureWebsite.buffer(input, options?)

Capture a screenshot of the given `input`.

Returns a `Promise<Buffer>` with the screenshot as binary.

### captureWebsite.base64(input, options?)

Capture a screenshot of the given `input`.

Returns a `Promise<string>` with the screenshot as [Base64](https://developer.mozilla.org/en-US/docs/Web/API/WindowBase64/Base64_encoding_and_decoding).

#### input

Type: `string`

The URL, file URL, data URL, local file path to the website, or HTML.

```js
import captureWebsite from 'capture-website';

await captureWebsite.file('index.html', 'local-file.png');
```

#### options

Type: `object`

##### inputType

Type: `string`\
Default: `'url'`\
Values: `'url' | 'html'`

Set it to `html` to treat `input` as HTML content.

```js
import captureWebsite from 'capture-website';

await captureWebsite.file('<h1>Awesome!</h1>', 'screenshot.png', {
	inputType: 'html'
});
```

##### width

Type: `number`\
Default: `1280`

Page width.

##### height

Type: `number`\
Default: `800`

Page height.

##### type

Type: `string`\
Values: `'png' | 'jpeg' | 'webp'`\
Default: `'png'`

Image type.

##### quality

Type: `number`\
Values: `0...1`\
Default: `1`

Image quality. Only for `{type: 'jpeg'}` and `{type: 'webp'}`.

##### scaleFactor

Type: `number`\
Default: `2`

Scale the webpage `n` times.

The default is what you would get if you captured a normal screenshot on a computer with a retina (High DPI) screen.

##### emulateDevice

Type: `string`\
Values: [Devices](https://github.com/puppeteer/puppeteer/blob/main/src/common/DeviceDescriptors.ts) *(Use the `name` property)*

Make it look like the screenshot was taken on the specified device.

This overrides the `width`, `height`, `scaleFactor`, and `userAgent` options.

```js
import captureWebsite from 'capture-website';

await captureWebsite.file('https://sindresorhus.com', 'screenshot.png', {
	emulateDevice: 'iPhone X'
});
```

##### fullPage

Type: `boolean`\
Default: `false`

Capture the full scrollable page, not just the viewport.

##### defaultBackground

Type: `boolean`\
Default: `true`

Include the default white background.

Disabling this lets you capture screenshots with transparency.

##### timeout

Type: `number` *(seconds)*\
Default: `60`

The number of seconds before giving up trying to load the page.

Specify `0` to disable the timeout.

##### delay

Type: `number` *(seconds)*\
Default: `0`

The number of seconds to wait after the page finished loading before capturing the screenshot.

This can be useful if you know the page has animations that you like it to finish before capturing the screenshot.

##### waitForElement

Type: `string`

Wait for a DOM element matching the given [CSS selector](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Selectors) to appear in the page and to be visible before capturing the screenshot. It times out after `options.timeout` seconds.

##### element

Type: `string`

Capture the DOM element matching the given [CSS selector](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Selectors). It will wait for the element to appear in the page and to be visible. It times out after `options.timeout` seconds. Any actions performed as part of `options.beforeScreenshot` occur before this.

##### hideElements

Type: `string[]`

Hide DOM elements matching the given [CSS selectors](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Selectors).

Can be useful for cleaning up the page.

This sets [`visibility: hidden`](https://stackoverflow.com/a/133064/64949) on the matched elements.

```js
import captureWebsite from 'capture-website';

await captureWebsite.file('https://sindresorhus.com', 'screenshot.png', {
	hideElements: [
		'#sidebar',
		'img.ad'
	]
});
```

##### removeElements

Type: `string[]`

Remove DOM elements matching the given [CSS selectors](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Selectors).

This sets [`display: none`](https://stackoverflow.com/a/133064/64949) on the matched elements, so it could potentially break the website layout.

##### clickElement

Type: `string`

Click the DOM element matching the given [CSS selector](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Selectors).

##### scrollToElement

Type: `string | object`

Scroll to the DOM element matching the given [CSS selector](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Selectors).

###### element

Type: `string`

A [CSS selector](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Selectors).

###### offsetFrom

Type: `string`\
Values: `'top' | 'right' | 'bottom' | 'left'`

Offset origin.

###### offset

Type: `number`

Offset in pixels.

##### disableAnimations

Type: `boolean`\
Default: `false`

Disable CSS [animations](https://developer.mozilla.org/en-US/docs/Web/CSS/animation) and [transitions](https://developer.mozilla.org/en-US/docs/Web/CSS/transition).

##### blockAds

Type: `boolean`\
Default: `true`

[Ad blocking.](https://github.com/ghostery/adblocker/blob/master/packages/adblocker-puppeteer/README.md)

##### isJavaScriptEnabled

Type: `boolean`\
Default: `true`

Whether JavaScript on the website should be executed.

This does not affect the `scripts` and `modules` options.

##### modules

Type: `string[]`

Inject [JavaScript modules](https://developers.google.com/web/fundamentals/primers/modules) into the page.

Accepts an array of inline code, absolute URLs, and local file paths (must have a `.js` extension).

```js
import captureWebsite from 'capture-website';

await captureWebsite.file('https://sindresorhus.com', 'screenshot.png', {
	modules: [
		'https://sindresorhus.com/remote-file.js',
		'local-file.js',
		`
		document.body.style.backgroundColor = 'red';
		`
	]
});
```

##### scripts

Type: `string[]`

Same as the `modules` option, but instead injects the code as [`<script>` instead of `<script type="module">`](https://developers.google.com/web/fundamentals/primers/modules). Prefer the `modules` option whenever possible.

##### styles

Type: `string[]`

Inject CSS styles into the page.

Accepts an array of inline code, absolute URLs, and local file paths (must have a `.css` extension).

```js
import captureWebsite from 'capture-website';

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
```

##### headers

Type: `object`\
Default: `{}`

Set custom [HTTP headers](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers).

```js
import captureWebsite from 'capture-website';

await captureWebsite.file('https://sindresorhus.com', 'screenshot.png', {
	headers: {
		'x-powered-by': 'https://github.com/sindresorhus/capture-website'
	}
});
```

##### userAgent

Type: `string`

Set a custom [user agent](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/User-Agent).

##### cookies

Type: `Array<string | object>`

Set cookies in [browser string format](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies) or [object format](https://pptr.dev/api/puppeteer.page.setcookie).

Tip: Go to the website you want a cookie for and [copy-paste it from DevTools](https://stackoverflow.com/a/24961735/64949).

```js
import captureWebsite from 'capture-website';

await captureWebsite.file('https://sindresorhus.com', 'screenshot.png', {
	cookies: [
		// This format is useful for when you copy it from the browser
		'id=unicorn; Expires=Wed, 21 Oct 2018 07:28:00 GMT;',

		// This format is useful for when you have to manually create a cookie
		{
			name: 'id',
			value: 'unicorn',
			expires: Math.round(new Date('2018-10-21').getTime() / 1000)
		}
	]
});
```

##### authentication

Type: `object`

Credentials for [HTTP authentication](https://developer.mozilla.org/en-US/docs/Web/HTTP/Authentication).

###### username

Type: `string`

###### password

Type: `string`

##### beforeScreenshot

Type: `Function`

The specified function is called right before the screenshot is captured, as well as before any bounding rectangle is calculated as part of `options.element`. It receives the Puppeteer [`Page` instance](https://pptr.dev/api/puppeteer.page) as the first argument and the [`browser` instance](https://pptr.dev/api/puppeteer.browser) as the second argument. This gives you a lot of power to do custom stuff. The function can be async.

Note: Make sure to not call `page.close()` or `browser.close()`.

```js
import captureWebsite from 'capture-website';
import checkSomething from './check-something.js';

await captureWebsite.file('https://sindresorhus.com', 'screenshot.png', {
	beforeScreenshot: async (page, browser) => {
		await checkSomething();
		await page.click('#activate-button');
		await page.waitForSelector('.finished');
	}
});
```

##### debug

Type: `boolean`\
Default: `false`

Show the browser window so you can see what it's doing, redirect page console output to the terminal, and slow down each Puppeteer operation.

Note: This overrides `launchOptions` with `{headless: false, slowMo: 100}`.

##### darkMode

Type: `boolean`\
Default: `false`

Emulate preference of dark color scheme ([`prefers-color-scheme`](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-color-scheme)).

##### inset

Type: `object | number`\
Default: `0`

Inset the bounding box of the screenshot.

Accepts an object `{top?: number; right?: number; bottom?: number; left?: number}` or a `number` as a shorthand for all directions.

Positive values, for example `inset: 10`, will decrease the size of the screenshot.
Negative values, for example `inset: {left: -10}`, will increase the size of the screenshot.

Note: This option is ignored if the `fullPage` option is set to `true`. Can be combined with the `element` option.
Note: When the `width` or `height` of the screenshot is equal to `0` an error is thrown.

Example: Include 10 pixels around the element.

```js
import captureWebsite from 'capture-website';

await captureWebsite.file('index.html', 'screenshot.png', {
	element: '.logo',
	inset: -10
});
```

Example: Ignore 15 pixels from the top of the viewport.

```js
import captureWebsite from 'capture-website';

await captureWebsite.file('index.html', 'screenshot.png', {
	inset: {
		top: 15
	}
});
```

##### launchOptions

Type: `object`\
Default: `{headless: 'new'}`

Options passed to [`puppeteer.launch()`](https://pptr.dev/api/puppeteer.puppeteernodelaunchoptions).

Note: Some of the launch options are overridden by the `debug` option.

##### overwrite

Type: `boolean`\
Default: `false`

Overwrite the destination file if it exists instead of throwing an error.

*This option applies only to `captureWebsite.file()`.*

##### preloadFunction

Type: `string | Function`\
Default: `undefined`

Inject a function to be executed prior to navigation.

This can be useful for [altering the JavaScript environment](https://pptr.dev/api/puppeteer.page.evaluateonnewdocument). For example, you could define a global method on the `window`, overwrite `navigator.languages` to change the language presented by the browser, or mock `Math.random` to return a fixed value.

##### clip

Type: `object`

Define the screenshot's position and size (clipping region).

The position can be specified through `x` and `y` coordinates which starts from the top-left.

This can be useful when you only need a part of the page.

You can also consider using `element` option when you have a [CSS selector](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Selectors).

Note that `clip` is mutually exclusive with the `element` and `fullPage` options.

- **x** - X-coordinate where the screenshot starts.
Type: `number`
- **y** - Y-coordinate where the screenshot starts.
Type: `number`
- **width** - The width of the screenshot.
Type: `number`
- **height** - The height of the screenshot.
Type: `number`

For example, define the screenshot's `width` and `height` to 400 at position (0, 0):

```js
import captureWebsite from 'capture-website';

await captureWebsite.file('https://sindresorhus.com', 'screenshot.png', {
	clip: {
		x: 0,
		y: 0,
		width: 400,
		height: 400
	}
});
```

### captureWebsite.devices

Type: `string[]`

Devices supported by the `emulateDevice` option.

## Tips

### Capturing multiple screenshots

```js
import captureWebsite from 'capture-website';

const options = {
	width: 1920,
	height: 1000
};

const items = [
	['https://sindresorhus.com', 'sindresorhus'],
	['https://github.com', 'github'],
	// …
];

await Promise.all(items.map(([url, filename]) => {
	return captureWebsite.file(url, `${filename}.png`, options);
}));
```

*Check out [`filenamify-url`](https://github.com/sindresorhus/filenamify-url) if you need to create a filename from the URL.*

## FAQ

### I'm getting a sandbox-related error

If you get an error like `No usable sandbox!` or `Running as root without --no-sandbox is not supported`, you need to properly [set up sandboxing](https://pptr.dev/troubleshooting#setting-up-chrome-linux-sandbox) on your Linux instance.

Alternatively, if you completely trust the content, you can disable sandboxing (strongly discouraged):

```js
import captureWebsite from 'capture-website';

await captureWebsite.file('…', '…', {
	launchOptions: {
		args: [
			'--no-sandbox',
			'--disable-setuid-sandbox'
		]
	}
});
```

### How is this different from your [Pageres](https://github.com/sindresorhus/pageres) project?

The biggest difference is that Pageres supports capturing multiple screenshots in a single call and it automatically generates the filenames and writes the files. Also, when projects are popular and mature, like Pageres, it becomes harder to make drastic changes. There are many things I would change in Pageres today, but I don't want to risk making lots of breaking changes for such a large userbase before I know whether it will work out or not. So this package is a rethink of how I would have made Pageres had I started it today. I plan to bring some things back to Pageres over time.

## Related

- [capture-website-cli](https://github.com/sindresorhus/capture-website-cli) - CLI for this module
- [pageres](https://github.com/sindresorhus/pageres) - A different take on screenshotting websites
