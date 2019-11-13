/// <reference lib="dom"/>
/// <reference types="puppeteer"/>
import {SetCookie, LaunchOptions, Page, Browser} from 'puppeteer';

declare namespace captureWebsite {
	interface Authentication {
		readonly username: string;
		readonly password?: string;
	}

	type BeforeScreenshot = (page: Page, browser: Browser) => void;

	interface ScrollToElementOptions {
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
	}

	interface Options {
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
		readonly type?: 'png' | 'jpeg';

		/**
		Image quality. Only for {type: 'jpeg'}.

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
		Capture the DOM element matching the given [CSS selector](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Selectors). It will wait for the element to appear in the page and to be visible. It times out after `options.timeout` seconds
		*/
		readonly element?: string;

		/**
		Hide DOM elements matching the given [CSS selector](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Selectors).

		Can be useful for cleaning up the page.

		This sets [`visibility: hidden`](https://stackoverflow.com/a/133064/64949) on the matched elements.
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
		readonly scrollToElement?: string | captureWebsite.ScrollToElementOptions

		/**
		Disable CSS [animations](https://developer.mozilla.org/en-US/docs/Web/CSS/animation) and [transitions](https://developer.mozilla.org/en-US/docs/Web/CSS/transition).

		@default false
		*/
		readonly disableAnimations?: boolean;

		/**
		Whether JavaScript on the website should be executed.

		This does not affect the `scripts` and `modules` options.

		@default true
		*/
		readonly isJavaScriptEnabled?: boolean;

		/**
		Inject [JavaScript modules](https://developers.google.com/web/fundamentals/primers/modules) into the page.

		Accepts an array of inline code, absolute URLs, and local file paths (must have a .js extension).
		*/
		readonly modules?: string[];

		/**
		Same as the `modules` option, but instead injects the code as [`<script>` instead of `<script type="module">`](https://developers.google.com/web/fundamentals/primers/modules). Prefer the `modules` option whenever possible.
		*/
		readonly scripts?: string[];

		/**
		Inject CSS styles into the page.

		Accepts an array of inline code, absolute URLs, and local file paths (must have a `.css` extension).
		*/
		readonly styles?: string[];

		/**
		Set custom [HTTP headers](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers).

		@default {}
		*/
		readonly headers?: Headers;

		/**
		Set a custom [user agent](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/User-Agent).
		*/
		readonly userAgent?: string;

		/**
		Set cookies in [browser string format](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies) or [object format](https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md#pagesetcookiecookies).

		Tip: Go to the website you want a cookie for and [copy-paste it from DevTools](https://stackoverflow.com/a/24961735/64949).
		*/
		readonly cookies?: (string | SetCookie)[];

		/**
		Credentials for [HTTP authentication](https://developer.mozilla.org/en-US/docs/Web/HTTP/Authentication).
		*/
		readonly authentication?: Authentication;

		/**
		The specified function is called right before the screenshot is captured. It gives you a lot of power to do custom stuff. The function can be async.

		Note: Make sure to not call `page.close()` or `browser.close()`.
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
		Options passed to [`puppeteer.launch()`](https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md#puppeteerlaunchoptions).

		Note: Some of the launch options are overridden by the `debug` option.

		@default {}
		*/
		readonly launchOptions?: LaunchOptions;
	}

	interface FileOptions extends Options {
		/**
		Overwrite the destination file if it exists instead of throwing an error.

		@default false
		*/
		readonly overwrite?: boolean;
	}
}

declare const captureWebsite: {
	/**
	Devices supported by the `emulateDevice` option.
	*/
	readonly devices: string[];

	/**
	Capture a screenshot of the given `input` and save it to the given `outputFilePath`.

	@param input - The URL, file URL, data URL, local file path to the website, or HTML.
	@param outputFilePath - The path to write the screenshot.
	@returns A promise that resolves when the screenshot is written to the given file path.

	@example
	```
	import captureWebsite = require('capture-website');

	(async () => {
		await captureWebsite.file('https://sindresorhus.com', 'screenshot-url.png');

		await captureWebsite.file('<h1>Awesome!</h1>', 'screenshot-html.png', {
			inputType: 'html'
		});
	})();
	```
	*/
	file(
		input: string,
		outputFilePath: string,
		options?: captureWebsite.FileOptions
	): Promise<void>;

	/**
	Capture a screenshot of the given `input`.

	@param input - The URL, file URL, data URL, local file path to the website, or HTML.
	@returns The screenshot as binary.
	*/
	buffer(input: string, options?: captureWebsite.Options): Promise<Buffer>;

	/**
	Capture a screenshot of the given `input`.

	@param input - The URL, file URL, data URL, local file path to the website, or HTML.
	@returns The screenshot as [Base64](https://developer.mozilla.org/en-US/docs/Web/API/WindowBase64/Base64_encoding_and_decoding).
	*/
	base64(input: string, options?: captureWebsite.Options): Promise<string>;
};

export = captureWebsite;
