/* global document */
import process from 'node:process';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {setTimeout} from 'node:timers/promises';
import fileUrl from 'file-url';
import puppeteer, {KnownDevices} from 'puppeteer';
import * as toughCookie from 'tough-cookie';
import {PuppeteerBlocker} from '@ghostery/adblocker-puppeteer';

const isUrl = string => /^(https?|file):\/\/|^data:/.test(string);

const assert = (value, message) => {
	if (!value) {
		throw new Error(message);
	}
};

const validateOptions = options => {
	assert(!(options.clip && options.element), 'The `clip` and `element` option are mutually exclusive');
	assert(!(options.clip && options.fullPage), 'The `clip` and `fullPage` option are mutually exclusive');
	assert(!(options.type === 'pdf' && options.clip), 'The `clip` option is not supported when type is `pdf`');
	assert(!(options.type === 'pdf' && options.element), 'The `element` option is not supported when type is `pdf`');
	assert(!(options.type === 'pdf' && options.quality), 'The `quality` option is not supported when type is `pdf`');
};

const scrollToElement = (element, options) => {
	const isOverflown = element => (
		element.scrollHeight > element.clientHeight
		|| element.scrollWidth > element.clientWidth
	);

	const findScrollParent = element => {
		if (element === null) {
			return;
		}

		if (isOverflown(element)) {
			return element;
		}

		return findScrollParent(element.parentElement);
	};

	const parent = findScrollParent(element);
	if (!parent) {
		// No scrollable ancestor: scroll the window to the element
		element.scrollIntoView({block: 'start', inline: 'nearest'});
		return;
	}

	// Align the scroll parent to the viewport origin so rect math is relative to it
	parent.scrollIntoView(true);

	const rect = element.getBoundingClientRect();
	const parentRect = parent.getBoundingClientRect();

	const from = options?.offsetFrom ?? 'top';
	const offset = options?.offset ?? 0;

	const localLeft = rect.left - parentRect.left;
	const localTop = rect.top - parentRect.top;

	let x = localLeft;
	let y = localTop;

	switch (from) {
		case 'top': {
			y = localTop + offset;
			break;
		}

		case 'left': {
			x = localLeft + offset;
			break;
		}

		case 'bottom': {
			// Position so element's bottom edge is offset px above parent's bottom edge
			y = (rect.bottom - parentRect.top) - parent.clientHeight - offset;
			break;
		}

		case 'right': {
			// Position so element's right edge is offset px left of parent's right edge
			x = (rect.right - parentRect.left) - parent.clientWidth - offset;
			break;
		}

		default: {
			throw new Error('Invalid `scrollToElement.offsetFrom` value');
		}
	}

	parent.scrollTo({left: x, top: y});
};

const disableAnimations = () => {
	const rule = `
		*,
		::before,
		::after {
			animation: none !important;
			animation-delay: 0s !important;
			animation-duration: 0s !important;
			animation-iteration-count: 1 !important;
			transition: none !important;
		}
	`;

	const style = document.createElement('style');
	document.body.append(style);

	style.sheet.insertRule(rule);
};

const getBoundingClientRect = element => {
	const {top, left, height, width, x, y} = element.getBoundingClientRect();

	return {
		top,
		left,
		height,
		width,
		x,
		y,
	};
};

const parseCookie = (url, cookie) => {
	if (typeof cookie === 'object') {
		return cookie;
	}

	const jar = new toughCookie.CookieJar(undefined, {rejectPublicSuffixes: false});
	jar.setCookieSync(cookie, url);
	const returnValue = jar.serializeSync().cookies[0];

	// Use this instead of the above when the following issue is fixed:
	// https://github.com/salesforce/tough-cookie/issues/149
	// const ret = toughCookie.parse(cookie).serializeSync();

	returnValue.name = returnValue.key;
	delete returnValue.key;

	returnValue.expires &&= Math.floor(new Date(returnValue.expires) / 1000);

	return returnValue;
};

const internalCaptureWebsite = async (input, options) => {
	options = {
		launchOptions: {
			headless: true,
		},
		...options,
	};
	const {launchOptions} = options;

	validateOptions(options);

	if (options.allowCORS) {
		launchOptions.args ||= [];
		launchOptions.args.push(
			'--disable-web-security',
			'--disable-features=IsolateOrigins',
			'--disable-site-isolation-trials',
			'--allow-file-access-from-files',
		);
	}

	if (options.debug) {
		launchOptions.headless = false;
		launchOptions.slowMo = 100;
	}

	let browser;
	let page;
	let pageError;
	try {
		browser = options._browser || await puppeteer.launch(launchOptions);
		page = await browser.newPage();

		// Handle page crashes
		page.on('error', error => {
			pageError = error;
		});

		if (options.blockAds) {
			try {
				const cacheDirectory = path.join(os.tmpdir(), 'capture-website');
				await fs.mkdir(cacheDirectory, {recursive: true});
				const cachePath = path.join(cacheDirectory, 'engine.bin');

				const blocker = await PuppeteerBlocker.fromPrebuiltFull(fetch, {
					path: cachePath,
					read: fs.readFile,
					write: fs.writeFile,
				});

				await blocker.enableBlockingInPage(page);
			} catch {
				// Skip blocking if ad-blocker initialization fails (e.g., offline/CI)
			}
		}

		const result = await internalCaptureWebsiteCore(input, options, page, browser);

		// If a page crash occurred during capture, throw the error
		if (pageError) {
			throw pageError;
		}

		return result;
	} finally {
		if (page) {
			try {
				await page.close();
			} catch {
				// Ignore errors when closing the page
			}
		}

		if (browser && !options._keepAlive) {
			try {
				await browser.close();
			} catch {
				// Ignore errors when closing the browser
			}
		}
	}
};

const internalCaptureWebsiteCore = async (input, options, page, browser) => {
	options = {
		inputType: 'url',
		width: 1280,
		height: 800,
		scaleFactor: 2,
		fullPage: false,
		defaultBackground: true,
		timeout: 60, // The Puppeteer default of 30 is too short
		delay: 0,
		debug: false,
		darkMode: false,
		throwOnHttpError: false,
		_keepAlive: false,
		isJavaScriptEnabled: true,
		blockAds: true,
		inset: 0,
		preloadLazyContent: false,
		...options,
	};

	const isHTMLContent = options.inputType === 'html';

	input = isHTMLContent || isUrl(input) ? input : fileUrl(input);

	const timeoutInMilliseconds = options.timeout * 1000;

	const viewportOptions = {
		width: options.width,
		height: options.height,
		deviceScaleFactor: options.scaleFactor,
	};

	const screenshotOptions = {};

	if (options.type) {
		screenshotOptions.type = options.type;
	}

	if (typeof options.quality === 'number' && options.type && options.type !== 'png') {
		const quality = Math.max(0, Math.min(1, options.quality));
		screenshotOptions.quality = Math.round(quality * 100);
	}

	if (options.fullPage) {
		screenshotOptions.fullPage = options.fullPage;
	}

	if (typeof options.defaultBackground === 'boolean') {
		screenshotOptions.omitBackground = !options.defaultBackground;
	}

	if (options.preloadFunction) {
		const arguments_ = options.preloadFunctionArguments ?? [];
		// eslint-disable-next-line unicorn/prefer-ternary
		if (typeof options.preloadFunction === 'string') {
			await page.evaluateOnNewDocument(options.preloadFunction);
		} else {
			await page.evaluateOnNewDocument(options.preloadFunction, ...arguments_);
		}
	}

	await page.setBypassCSP(true);
	await page.setJavaScriptEnabled(options.isJavaScriptEnabled);

	if (options.debug) {
		page.on('console', message => {
			let {url, lineNumber, columnNumber} = message.location();
			lineNumber = lineNumber ? `:${lineNumber}` : '';
			columnNumber = columnNumber ? `:${columnNumber}` : '';
			const location = url ? ` (${url}${lineNumber}${columnNumber})` : '';
			console.log(`\nPage log:${location}\n${message.text()}\n`);
		});

		page.on('pageerror', error => {
			console.log('\nPage error:', error, '\n');
		});

		// TODO: Add more events from https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md#event-requestfailed
	}

	if (options.onConsole) {
		page.on('console', message => {
			try {
				options.onConsole(message);
			} catch (error) {
				if (options.debug) {
					console.error('\nError in onConsole callback:', error, '\n');
				}
			}
		});
	}

	if (options.authentication) {
		await page.authenticate(options.authentication);
	}

	if (options.cookies) {
		const cookies = options.cookies.map(cookie => parseCookie(isHTMLContent ? 'about:blank' : input, cookie));
		await page.setCookie(...cookies);
	}

	if (options.headers) {
		const headers = Object.fromEntries(Object.entries(options.headers).map(([key, value]) => [key, String(value)]));
		// Remove referer from headers if referrer option is specified (referrer takes precedence)
		if (options.referrer) {
			for (const key of Object.keys(headers)) {
				if (key.toLowerCase() === 'referer') {
					delete headers[key];
				}
			}
		}

		await page.setExtraHTTPHeaders(headers);
	}

	if (options.userAgent) {
		await page.setUserAgent(options.userAgent);
	}

	if (options.clip) {
		screenshotOptions.clip = options.clip;
	}

	await page.setViewport(viewportOptions);

	if (options.emulateDevice) {
		if (!Object.hasOwn(KnownDevices, options.emulateDevice)) {
			throw new Error(`The device name \`${options.emulateDevice}\` is not supported`);
		}

		await page.emulate(KnownDevices[options.emulateDevice]);
	}

	await page.emulateMediaFeatures([{
		name: 'prefers-color-scheme',
		value: options.darkMode ? 'dark' : 'light',
	}]);

	const gotoOptions = {
		timeout: timeoutInMilliseconds,
		waitUntil: options.waitForNetworkIdle ? 'networkidle0' : 'networkidle2',
	};

	// Set referrer and referrerPolicy for page navigation
	// Note: We use 'unsafe-url' policy to allow referrer to be sent even for cross-origin requests (e.g., HTTPS -> HTTP localhost in tests)
	if (options.referrer && !isHTMLContent) {
		gotoOptions.referer = options.referrer;
		gotoOptions.referrerPolicy = 'unsafe-url';
	}

	if (options.beforeNavigation) {
		await options.beforeNavigation(page, browser);
	}

	const response = await page[isHTMLContent ? 'setContent' : 'goto'](input, gotoOptions);

	if (
		options.throwOnHttpError
		&& !isHTMLContent
		&& response
		&& !response.ok()
		&& /^https?:\/\//i.test(input) // Only check HTTP status for HTTP/HTTPS URLs (not file:// or data: URLs)
	) {
		throw new Error(`HTTP ${response.status()} ${response.statusText()}: ${input}`);
	}

	if (options.disableAnimations) {
		await page.evaluate(disableAnimations);
	}

	if (Array.isArray(options.hideElements) && options.hideElements.length > 0) {
		await page.addStyleTag({
			content: `${options.hideElements.join(', ')} { visibility: hidden !important; }`,
		});
	}

	if (Array.isArray(options.removeElements) && options.removeElements.length > 0) {
		await page.addStyleTag({
			content: `${options.removeElements.join(', ')} { display: none !important; }`,
		});
	}

	if (options.clickElement) {
		await page.click(options.clickElement);
	}

	const getInjectKey = (extension, value) => isUrl(value) ? 'url' : (value.endsWith(`.${extension}`) ? 'path' : 'content');

	const needsTemporaryJS = !options.isJavaScriptEnabled && (options.modules?.length || options.scripts?.length);
	if (needsTemporaryJS) {
		await page.setJavaScriptEnabled(true);
	}

	try {
		if (options.modules) {
			await Promise.all(options.modules.map(module_ => page.addScriptTag({
				[getInjectKey('js', module_)]: module_,
				type: 'module',
			})));
		}

		if (options.scripts) {
			await Promise.all(options.scripts.map(script => page.addScriptTag({
				[getInjectKey('js', script)]: script,
			})));
		}
	} finally {
		if (needsTemporaryJS) {
			await page.setJavaScriptEnabled(false);
		}
	}

	if (options.styles) {
		await Promise.all(options.styles.map(style => page.addStyleTag({
			[getInjectKey('css', style)]: style,
		})));
	}

	if (options.waitForElement && options.waitForElement !== options.element) {
		await page.waitForSelector(options.waitForElement, {
			visible: true,
			timeout: timeoutInMilliseconds,
		});
	}

	if (options.beforeScreenshot) {
		await options.beforeScreenshot(page, browser);
	}

	if (options.element) {
		await page.waitForSelector(options.element, {
			visible: true,
			timeout: timeoutInMilliseconds,
		});
	}

	if (options.delay) {
		await setTimeout(options.delay * 1000);
	}

	if (options.element) {
		screenshotOptions.clip = await page.$eval(options.element, getBoundingClientRect);
		screenshotOptions.fullPage = false;
	}

	if (options.scrollToElement) {
		// eslint-disable-next-line unicorn/prefer-ternary
		if (typeof options.scrollToElement === 'object') {
			await page.$eval(options.scrollToElement.element, scrollToElement, options.scrollToElement);
		} else {
			await page.$eval(options.scrollToElement, scrollToElement);
		}
	}

	const shouldScrollToLoadContent = screenshotOptions.fullPage || options.preloadLazyContent;

	if (shouldScrollToLoadContent) {
		// Get the height of the rendered page
		const bodyHandle = await page.$('body');

		// Guard against missing body element
		if (bodyHandle) {
			let bodyBoundingBox = await bodyHandle.boundingBox();

			try {
				// Guard against null bounding box (element not rendered)
				if (bodyBoundingBox && bodyBoundingBox.height > viewportOptions.height) {
					let pageHeight = bodyBoundingBox.height;
					const waitForIdleAfterScroll = async () => {
						try {
							await page.waitForNetworkIdle({
								timeout: timeoutInMilliseconds,
							});
						} catch (error) {
							if (!(error instanceof puppeteer.errors.TimeoutError)) {
								throw error;
							}
						}
					};

					// Save the current scroll position only when needed (not for fullPage)
					let initialScrollPosition = null;

					if (!screenshotOptions.fullPage) {
						initialScrollPosition = await page.evaluate(() => ({
							/* eslint-disable no-undef */
							x: window.scrollX,
							y: window.scrollY,
							/* eslint-enable no-undef */
						}));
					}

					// Scroll one viewport at a time, pausing to let content load
					const viewportHeight = viewportOptions.height;
					let viewportIncrement = 0;
					// Use <= to ensure we scroll to the last partial viewport
					while (viewportIncrement + viewportHeight <= pageHeight) {
						/* eslint-disable no-await-in-loop */
						await page.evaluate(_viewportHeight => {
							/* eslint-disable no-undef */
							window.scrollBy(0, _viewportHeight);
							/* eslint-enable no-undef */
						}, viewportHeight);

						await waitForIdleAfterScroll();
						await setTimeout(100);

						const updatedBoundingBox = await bodyHandle.boundingBox();
						if (updatedBoundingBox) {
							bodyBoundingBox = updatedBoundingBox;
							if (updatedBoundingBox.height > pageHeight) {
								pageHeight = updatedBoundingBox.height;
							}
						}
						/* eslint-enable no-await-in-loop */

						viewportIncrement += viewportHeight;
					}

					// Scroll back to original position
					// For fullPage, always scroll to top. For preloadLazyContent, scroll to saved position
					if (screenshotOptions.fullPage) {
						await page.evaluate(_ => {
							/* eslint-disable no-undef */
							window.scrollTo(0, 0);
							/* eslint-enable no-undef */
						});
					} else if (initialScrollPosition) {
						await page.evaluate(position => {
							/* eslint-disable no-undef */
							window.scrollTo(position.x, position.y);
							/* eslint-enable no-undef */
						}, initialScrollPosition);
					}
				}
			} finally {
				// Always dispose the handle to prevent memory leaks
				await bodyHandle.dispose();
			}
		} else {
			// Page might not have a body element (e.g., XML, SVG documents)
			// Skip scrolling in this case
		}
	}

	if (options.inset && !screenshotOptions.fullPage) {
		const inset = {
			top: 0,
			right: 0,
			bottom: 0,
			left: 0,
		};

		for (const key of Object.keys(inset)) {
			inset[key] = typeof options.inset === 'number' ? options.inset : (options.inset[key] ?? 0);
		}

		let clipOptions = screenshotOptions.clip;

		clipOptions ||= await page.evaluate(() => ({
			x: 0,
			y: 0,
			/* eslint-disable no-undef */
			height: window.innerHeight,
			width: window.innerWidth,
			/* eslint-enable no-undef */
		}));

		const x = clipOptions.x + inset.left;
		const y = clipOptions.y + inset.top;
		const width = clipOptions.width - (inset.left + inset.right);
		const height = clipOptions.height - (inset.top + inset.bottom);

		if (width <= 0 || height <= 0) {
			throw new Error('When using the `clip` option, the width or height of the screenshot cannot be <= 0.');
		}

		screenshotOptions.clip = {
			x,
			y,
			width,
			height,
		};
	}

	// Generate PDF or screenshot based on type
	let buffer;
	if (options.type === 'pdf') {
		const pdfOptions = {
			printBackground: options.pdf?.background ?? false,
		};

		if (options.pdf?.format) {
			pdfOptions.format = options.pdf.format;
		}

		if (options.pdf?.landscape !== undefined) {
			pdfOptions.landscape = Boolean(options.pdf.landscape);
		}

		if (options.pdf?.margin) {
			pdfOptions.margin = options.pdf.margin;
		}

		if (options.scaleFactor) {
			pdfOptions.scale = Math.max(0.1, Math.min(2, options.scaleFactor));
		}

		if (typeof options.defaultBackground === 'boolean') {
			pdfOptions.omitBackground = !options.defaultBackground;
		}

		buffer = await page.pdf(pdfOptions);
	} else {
		buffer = await page.screenshot(screenshotOptions);
	}

	return buffer;
};

const captureWebsite = {};

captureWebsite.file = async (url, filePath, options = {}) => {
	const screenshot = await internalCaptureWebsite(url, options);

	await fs.mkdir(path.dirname(filePath), {recursive: true});

	await fs.writeFile(filePath, screenshot, {
		flag: options.overwrite ? 'w' : 'wx',
	});
};

captureWebsite.buffer = async (url, options) => new Uint8Array(await internalCaptureWebsite(url, options));

captureWebsite.base64 = async (url, options) => {
	const screenshot = await internalCaptureWebsite(url, options);
	return screenshot.toString('base64');
};

if (process.env.NODE_ENV === 'test') {
	captureWebsite._startBrowser = puppeteer.launch.bind(puppeteer);
}

export default captureWebsite;

export const devices = Object.values(KnownDevices).map(device => device.name);
