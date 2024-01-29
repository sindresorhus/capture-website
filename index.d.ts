import type {
	PuppeteerLaunchOptions,
	Page,
	Browser,
	EvaluateFunc,
	Protocol,
	Product,
	BoundingBox,
} from 'puppeteer';

export type Authentication = {
	readonly username: string;
	readonly password?: string;
};

export type BeforeScreenshot = (page: Page, browser: Browser) => void;

export type ScrollToElementOptions = {
	/**
	A [CSS selector](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Selectors).
	*/
	readonly element: string;

	/**
	Offset origin.
	*/
	readonly offsetFrom: 'top' | 'right' | 'bottom' | 'left';

	/**
	Offset in pixels.
	*/
	readonly offset: number;
};

export type Options = {
	/**
	Input type.

	@default url
	*/
	readonly inputType?: 'url' | 'html';

	/**
	Page width.

	@default 1280
	*/
	readonly width?: number;

	/**
	Page height.

	@default 800
	*/
	readonly height?: number;

	/**
	Image type.

	@default png
	*/
	readonly type?: 'png' | 'jpeg' | 'webp';

	/**
	Image quality. Only for `{type: 'jpeg'}` and `{type: 'webp'}`.

	@default 1
	*/
	readonly quality?: number;

	/**
	Scale the webpage `n` times.

	The default is what you would get if you captured a normal screenshot on a computer with a retina (High DPI) screen.

	@default 2
	*/
	readonly scaleFactor?: number;

	/**
	Make it look like the screenshot was taken on the specified device.

	This overrides the `width`, `height`, `scaleFactor`, and `userAgent` options.

	@example
	```
	import captureWebsite from 'capture-website';

	await captureWebsite.file('https://sindresorhus.com', 'screenshot.png', {
		emulateDevice: 'iPhone X'
	});
	```
	*/
	readonly emulateDevice?: string;

	/**
	Capture the full scrollable page, not just the viewport.

	@default false
	*/
	readonly fullPage?: boolean;

	/**
	Include the default white background.

	Disabling this lets you capture screenshots with transparency.

	@default true
	*/
	readonly defaultBackground?: boolean;

	/**
	The number of seconds before giving up trying to load the page.

	Specify `0` to disable the timeout.

	@default 60
	*/
	readonly timeout?: number;

	/**
	The number of seconds to wait after the page finished loading before capturing the screenshot.

	This can be useful if you know the page has animations that you like it to finish before capturing the screenshot.

	@default 0
	*/
	readonly delay?: number;

	/**
	Wait for a DOM element matching the given [CSS selector](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Selectors) to appear in the page and to be visible before capturing the screenshot. It times out after `options.timeout` seconds.
	*/
	readonly waitForElement?: string;

	/**
	Capture the DOM element matching the given [CSS selector](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Selectors). It will wait for the element to appear in the page and to be visible. It times out after `options.timeout` seconds. Any actions performed as part of `options.beforeScreenshot` occur before this.
	*/
	readonly element?: string;

	/**
	Define the screenshot's position and size (clipping region).

	The position can be specified through `x` and `y` coordinates which starts from the top-left.

	This can be useful when you only need a part of the page.

	You can also consider using `element` option when you have a [CSS selector](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Selectors).

	Note that `clip` is mutually exclusive with the `element` and `fullPage` options.

	@example
	```
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
	*/
	readonly clip?: BoundingBox;

	/**
	Hide DOM elements matching the given [CSS selector](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Selectors).

	Can be useful for cleaning up the page.

	This sets [`visibility: hidden`](https://stackoverflow.com/a/133064/64949) on the matched elements.

	@example
	```
	import captureWebsite from 'capture-website';

	await captureWebsite.file('https://sindresorhus.com', 'screenshot.png', {
		hideElements: [
			'#sidebar',
			'img.ad'
		]
	});
	```
	*/
	readonly hideElements?: string[];

	/**
	Remove DOM elements matching the given [CSS selectors](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Selectors).

	This sets [`display: none`](https://stackoverflow.com/a/133064/64949) on the matched elements, so it could potentially break the website layout.
	*/
	readonly removeElements?: string[];

	/**
	Click the DOM element matching the given [CSS selector](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Selectors).
	*/
	readonly clickElement?: string;

	/**
	Scroll to the DOM element matching the given [CSS selector](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Selectors).
	*/
	readonly scrollToElement?: string | ScrollToElementOptions;

	/**
	Disable CSS [animations](https://developer.mozilla.org/en-US/docs/Web/CSS/animation) and [transitions](https://developer.mozilla.org/en-US/docs/Web/CSS/transition).

	@default false
	*/
	readonly disableAnimations?: boolean;

	/**
	[Ad blocking.](https://github.com/ghostery/adblocker/blob/master/packages/adblocker-puppeteer/README.md)

	@default true
	*/
	readonly blockAds?: boolean;

	/**
	Whether JavaScript on the website should be executed.

	This does not affect the `scripts` and `modules` options.

	@default true
	*/
	readonly isJavaScriptEnabled?: boolean;

	/**
	Inject a function to be executed prior to navigation.

	This can be useful for [altering the JavaScript environment](https://pptr.dev/api/puppeteer.page.evaluateonnewdocument). For example, you could define a global method on the `window`, overwrite `navigator.languages` to change the language presented by the browser, or mock `Math.random` to return a fixed value.
	*/
	readonly preloadFunction?: EvaluateFunc<unknown[]>;

	/**
	Inject [JavaScript modules](https://developers.google.com/web/fundamentals/primers/modules) into the page.

	Accepts an array of inline code, absolute URLs, and local file paths (must have a .js extension).

	@example
	```
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
	*/
	readonly modules?: string[];

	/**
	Same as the `modules` option, but instead injects the code as [`<script>` instead of `<script type="module">`](https://developers.google.com/web/fundamentals/primers/modules). Prefer the `modules` option whenever possible.
	*/
	readonly scripts?: string[];

	/**
	Inject CSS styles into the page.

	Accepts an array of inline code, absolute URLs, and local file paths (must have a `.css` extension).

	@example
	```
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
	*/
	readonly styles?: string[];

	/**
	Set custom [HTTP headers](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers).

	@default {}

	@example
	```
	import captureWebsite from 'capture-website';

	await captureWebsite.file('https://sindresorhus.com', 'screenshot.png', {
		headers: {
			'x-powered-by': 'https://github.com/sindresorhus/capture-website'
		}
	});
	```
	*/
	readonly headers?: Record<string, string>;

	/**
	Set a custom [user agent](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/User-Agent).
	*/
	readonly userAgent?: string;

	/**
	Set cookies in [browser string format](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies) or [object format](https://pptr.dev/api/puppeteer.page.setcookie).

	Tip: Go to the website you want a cookie for and [copy-paste it from DevTools](https://stackoverflow.com/a/24961735/64949).

	@example
	```
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
	*/
	readonly cookies?: Array<string | Protocol.Network.CookieParam>;

	/**
	Credentials for [HTTP authentication](https://developer.mozilla.org/en-US/docs/Web/HTTP/Authentication).
	*/
	readonly authentication?: Authentication;

	/**
	The specified function is called right before the screenshot is captured, as well as before any bounding rectangle is calculated as part of `options.element`. It receives the Puppeteer [`Page` instance](https://pptr.dev/api/puppeteer.page) as the first argument and the [`browser` instance](https://pptr.dev/api/puppeteer.browser) as the second argument. This gives you a lot of power to do custom stuff. The function can be async.

	Note: Make sure to not call `page.close()` or `browser.close()`.

	@example
	```
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
	*/
	readonly beforeScreenshot?: BeforeScreenshot;

	/**
	Show the browser window so you can see what it's doing, redirect page console output to the terminal, and slow down each Puppeteer operation.

	Note: This overrides `launchOptions` with `{headless: false, slowMo: 100}`.

	@default false
	*/
	readonly debug?: boolean;

	/**
	Emulate preference of dark color scheme ([`prefers-color-scheme`](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-color-scheme)).

	@default false
	*/
	readonly darkMode?: boolean;

	/**
	Options passed to [`puppeteer.launch()`](https://pptr.dev/api/puppeteer.puppeteernodelaunchoptions).

	Note: Some of the launch options are overridden by the `debug` option.

	@default {headless: 'new'}
	*/
	readonly launchOptions?: PuppeteerLaunchOptions;

	/**
	Inset the bounding box of the screenshot.

	@default 0

	Accepts an object `{top?: number; right?: number; bottom?: number; left?: number}` or a `number` as a shorthand for all directions.

	Positive values, for example `inset: 10`, will decrease the size of the screenshot.
	Negative values, for example `inset: {left: -10}`, will increase the size of the screenshot.

	Note: This option is ignored if the `fullPage` option is set to `true`. Can be combined with the `element` option.
	Note: When the `width` or `height` of the screenshot is equal to `0` an error is thrown.

	Example: Include 10 pixels around the element.

	@example
	```
	await captureWebsite.file('index.html', 'screenshot.png', {
		element: '.logo',
		inset: -10
	});
	```

	Example: Ignore 15 pixels from the top of the viewport.

	@example
	```
	await captureWebsite.file('index.html', 'screenshot.png', {
		inset: {
			top: 15
		}
	});
	```
	*/
	readonly inset?: number | Partial<Record<'top' | 'right' | 'bottom' | 'left', number>>;
};

export type FileOptions = {
	/**
	Overwrite the destination file if it exists instead of throwing an error.

	@default false
	*/
	readonly overwrite?: boolean;
} & Options;

/**
Devices supported by the `emulateDevice` option.
*/
export const devices: string[];

declare const captureWebsite: {
	/**
	Capture a screenshot of the given `input` and save it to the given `outputFilePath`.

	@param input - The URL, file URL, data URL, local file path to the website, or HTML.
	@param outputFilePath - The path to write the screenshot.
	@returns A promise that resolves when the screenshot is written to the given file path.

	@example
	```
	import captureWebsite from 'capture-website';

	await captureWebsite.file('https://sindresorhus.com', 'screenshot-url.png');

	await captureWebsite.file('<h1>Awesome!</h1>', 'screenshot-html.png', {
		inputType: 'html'
	});
	```
	*/
	file: (
		input: string,
		outputFilePath: string,
		options?: FileOptions
	) => Promise<void>;

	/**
	Capture a screenshot of the given `input`.

	@param input - The URL, file URL, data URL, local file path to the website, or HTML.
	@returns The screenshot as binary.
	*/
	buffer: (input: string, options?: Options) => Promise<Uint8Array>;

	/**
	Capture a screenshot of the given `input`.

	@param input - The URL, file URL, data URL, local file path to the website, or HTML.
	@returns The screenshot as [Base64](https://developer.mozilla.org/en-US/docs/Web/API/WindowBase64/Base64_encoding_and_decoding).
	*/
	base64: (input: string, options?: Options) => Promise<string>;
};

export default captureWebsite;

export {type PuppeteerLaunchOptions as LaunchOptions} from 'puppeteer';
