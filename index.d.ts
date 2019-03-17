/// <reference types="puppeteer" />

import {SetCookie, LaunchOptions, Page, Browser} from 'puppeteer';

interface Authentication {
	username: string;
	password?: string;
}

interface BeforeScreenshot {
	(page: Page, browser: Browser): void;
}

interface Options {
	/**
	 * Page width.
	 *
	 * @default 1280
	 */
	width?: number;
	/**
	 * Page height.
	 *
	 * @default 800
	 */
	height?: number;
	/**
	 * Image type.
	 *
	 * @default png
	 */
	type?: 'png' | 'jpeg';
	/**
	 * Image quality. Only for {type: 'jpeg'}.
	 *
	 * @default 1
	 */
	quality?: number;
	/**
	 * Scale the webpage `n` times.
	 *
	 * The default is what you would get if you captured a normal screenshot on a computer with a retina (High DPI) screen.
	 *
	 * @default 2
	 */
	scaleFactor?: number;
	/**
	 * Make it look like the screenshot was taken on the specified device.
	 *
	 * This overrides the `width`, `height`, `scaleFactor`, and `userAgent` options.
	 */
	emulateDevice?: string;
	/**
	 * Capture the full scrollable page, not just the viewport.
	 *
	 * @default false
	 */
	fullPage?: boolean;
	/**
	 * Include the default white background.
	 *
	 * Disabling this lets you capture screenshots with transparency.
	 *
	 * @default true
	 */
	defaultBackground?: boolean;
	/**
	 * The number of seconds before giving up trying to load the page.
	 *
	 * Specify `0` to disable the timeout.
	 *
	 * @default 60
	 */
	timeout?: number;
	/**
	 * The number of seconds to wait after the page finished loading before capturing the screenshot.
	 *
	 * This can be useful if you know the page has animations that you like it to finish before capturing the screenshot.
	 *
	 * @default 0
	 */
	delay?: number;
	/**
	 * Wait for a DOM element matching the given [CSS selector](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Selectors) to appear in the page and to be visible before capturing the screenshot. It times out after `options.timeout` seconds.
	 */
	waitForElement?: string;
	/**
	 * Capture the DOM element matching the given [CSS selector](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Selectors). It will wait for the element to appear in the page and to be visible. It times out after `options.timeout` seconds
	 */
	element?: string;
	/**
	 * Hide DOM elements matching the given [CSS selector](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Selectors).
	 *
	 * Can be useful for cleaning up the page.
	 *
	 * This sets [`visibility: hidden`](https://stackoverflow.com/a/133064/64949) on the matched elements.
	 */
	hideElements?: string[];
	/**
	 * Remove DOM elements matching the given [CSS selectors](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Selectors).
	 *
	 * This sets [`display: none`](https://stackoverflow.com/a/133064/64949) on the matched elements, so it could potentially break the website layout.
	 */
	removeElements?: string[];
	/**
	 * Click the DOM element matching the given [CSS selector](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Selectors).
	 */
	clickElement?: string;
	/**
	 * Inject [JavaScript modules](https://developers.google.com/web/fundamentals/primers/modules) into the page.
	 *
	 * Accepts an array of inline code, absolute URLs, and local file paths (must have a .js extension).
	 */
	modules?: string[];
	/**
	 * Same as the `modules` option, but instead injects the code as [`<script>` instead of `<script type="module">`](https://developers.google.com/web/fundamentals/primers/modules). Prefer the `modules` option whenever possible.
	 */
	scripts?: string[];
	/**
	 * Inject CSS styles into the page.
	 *
	 * Accepts an array of inline code, absolute URLs, and local file paths (must have a `.css` extension).
	 */
	styles?: string[];
	/**
	 * Set custom [HTTP headers](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers).
	 *
	 * @default {}
	 */
	headers?: Headers;
	/**
	 * Set a custom [user agent](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/User-Agent).
	 */
	userAgent?: string;
	/**
	 * Set cookies in [browser string format](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies) or [object format](https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md#pagesetcookiecookies).
	 *
	 * Tip: Go to the website you want a cookie for and [copy-paste it from DevTools](https://stackoverflow.com/a/24961735/64949).
	 */
	cookies?: (string | SetCookie)[];
	/**
	 * Credentials for [HTTP authentication](https://developer.mozilla.org/en-US/docs/Web/HTTP/Authentication).
	 */
	authentication?: Authentication;
	/**
	 * The specified function is called right before the screenshot is captured.
	 * It receives the Puppeteer [`Page` instance](https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md#class-page) as the first argument and the [`browser` instance](https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md#class-browser) as the second argument.
	 * This gives you a lot of power to do custom stuff. The function can be async.
	 *
	 * Note: Make sure to not call `page.close()` or `browser.close()`.
	 */
	beforeScreenshot?: BeforeScreenshot;
	/**
	 * Show the browser window so you can see what it's doing, redirect page console output to the terminal, and slow down each Puppeteer operation.
	 *
	 * Note: This overrides `launchOptions` with `{headless: false, slowMo: 100}`.
	 *
	 * @default false
	 */
	debug?: boolean;
	/**
	 * Options passed to [`puppeteer.launch()`](https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md#puppeteerlaunchoptions).
	 *
	 * Note: Some of the launch options are overridden by the `debug` option.
	 *
	 * @default {}
	 */
	launchOptions?: LaunchOptions;
	/**
	 * Overwrite the destination file if it exists instead of throwing an error.
	 *
	 * This option applies only to `captureWebsite.file()`.
	 *
	 * @default false
	 */
	overwrite?: boolean;
}

/**
 * Devices supported by the `emulateDevice` option.
 */
export const devices: string[];

/**
 * Returns a `Promise<string>` with the screenshot as [Base64](https://developer.mozilla.org/en-US/docs/Web/API/WindowBase64/Base64_encoding_and_decoding).
 *
 * @param url - The URL, file URL, data URL, or local file path to the website.
 * @param options - The options object
 */
export function base64(url: string, options?: Options): Promise<string>;

/**
 * Returns a Promise<Buffer> with the screenshot as binary.
 *
 * @param url - The URL, file URL, data URL, or local file path to the website.
 * @param options - The options object
 */
export function buffer(url: string, options?: Options): Promise<Buffer>;

/**
 * Returns a `Promise<void>` that resolves when the screenshot is written to the given file path.
 * @param url - The URL, file URL, data URL, or local file path to the website.
 * @param outputFilePath - The path to write the screenshot.
 * @param options - The options object
 */
export function file(
	url: string,
	outputFilePath: string,
	options?: Options
): Promise<void>;
