/* global document */
import {promises as fs} from 'node:fs';
import fileUrl from 'file-url';
import puppeteer from 'puppeteer';
import toughCookie from 'tough-cookie';

const isUrl = string => /^(https?|file):\/\/|^data:/.test(string);

const scrollToElement = (element, options) => {
	const isOverflown = element => {
		return (
			element.scrollHeight > element.clientHeight ||
			element.scrollWidth > element.clientWidth
		);
	};

	const findScrollParent = element => {
		if (element === undefined) {
			return;
		}

		if (isOverflown(element)) {
			return element;
		}

		return findScrollParent(element.parentElement);
	};

	const calculateOffset = (rect, options) => {
		if (options === undefined) {
			return {
				x: rect.left,
				y: rect.top
			};
		}

		const offset = options.offset || 0;

		switch (options.offsetFrom) {
			case 'top':
				return {
					x: rect.left,
					y: rect.top + offset
				};
			case 'right':
				return {
					x: rect.left - offset,
					y: rect.top
				};
			case 'bottom':
				return {
					x: rect.left,
					y: rect.top - offset
				};
			case 'left':
				return {
					x: rect.left + offset,
					y: rect.top
				};
			default:
				throw new Error('Invalid `scrollToElement.offsetFrom` value');
		}
	};

	const rect = element.getBoundingClientRect();
	const offset = calculateOffset(rect, options);
	const parent = findScrollParent(element);

	if (parent !== undefined) {
		parent.scrollIntoView(true);
		parent.scrollTo(offset.x, offset.y);
	}
};

const disableAnimations = () => {
	const rule = `
		*,
		::before,
		::after {
			animation: initial !important;
			transition: initial !important;
		}
	`;

	const style = document.createElement('style');
	document.body.append(style);

	style.sheet.insertRule(rule);
};

const getBoundingClientRect = element => {
	const {top, left, height, width, x, y} = element.getBoundingClientRect();
	return {top, left, height, width, x, y};
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

	if (returnValue.expires) {
		returnValue.expires = Math.floor(new Date(returnValue.expires) / 1000);
	}

	return returnValue;
};

const imagesHaveLoaded = () => [...document.images].map(element => element.complete);

const internalCaptureWebsite = async (input, options) => {
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
		launchOptions: {},
		_keepAlive: false,
		isJavaScriptEnabled: true,
		inset: 0,
		...options
	};

	const isHTMLContent = options.inputType === 'html';

	input = isHTMLContent || isUrl(input) ? input : fileUrl(input);

	const timeoutInSeconds = options.timeout * 1000;

	const viewportOptions = {
		width: options.width,
		height: options.height,
		deviceScaleFactor: options.scaleFactor
	};

	const screenshotOptions = {};

	if (options.type) {
		screenshotOptions.type = options.type;
	}

	if (options.quality) {
		screenshotOptions.quality = options.quality * 100;
	}

	if (options.fullPage) {
		screenshotOptions.fullPage = options.fullPage;
	}

	if (typeof options.defaultBackground === 'boolean') {
		screenshotOptions.omitBackground = !options.defaultBackground;
	}

	const launchOptions = {...options.launchOptions};

	if (options.debug) {
		launchOptions.headless = false;
		launchOptions.slowMo = 100;
	}

	const browser = options._browser || await puppeteer.launch(launchOptions);
	const page = await browser.newPage();

	if (options.preloadFunction) {
		await page.evaluateOnNewDocument(options.preloadFunction);
	}

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

	if (options.authentication) {
		await page.authenticate(options.authentication);
	}

	if (options.cookies) {
		const cookies = options.cookies.map(cookie => parseCookie(isHTMLContent ? 'about:blank' : input, cookie));
		await page.setCookie(...cookies);
	}

	if (options.headers) {
		await page.setExtraHTTPHeaders(options.headers);
	}

	if (options.userAgent) {
		await page.setUserAgent(options.userAgent);
	}

	await page.setViewport(viewportOptions);

	if (options.emulateDevice) {
		if (!(options.emulateDevice in puppeteer.devices)) {
			throw new Error(`The device name \`${options.emulateDevice}\` is not supported`);
		}

		await page.emulate(puppeteer.devices[options.emulateDevice]);
	}

	await page.emulateMediaFeatures([{
		name: 'prefers-color-scheme',
		value: options.darkMode ? 'dark' : 'light'
	}]);

	await page[isHTMLContent ? 'setContent' : 'goto'](input, {
		timeout: timeoutInSeconds,
		waitUntil: 'networkidle2'
	});

	if (options.disableAnimations) {
		await page.evaluate(disableAnimations, options.disableAnimations);
	}

	if (Array.isArray(options.hideElements) && options.hideElements.length > 0) {
		await page.addStyleTag({
			content: `${options.hideElements.join(', ')} { visibility: hidden !important; }`
		});
	}

	if (Array.isArray(options.removeElements) && options.removeElements.length > 0) {
		await page.addStyleTag({
			content: `${options.removeElements.join(', ')} { display: none !important; }`
		});
	}

	if (options.clickElement) {
		await page.click(options.clickElement);
	}

	const getInjectKey = (ext, value) => isUrl(value) ? 'url' : (value.endsWith(`.${ext}`) ? 'path' : 'content');

	if (!options.isJavaScriptEnabled) {
		// Enable JavaScript again for `modules` and `scripts`.
		await page.setJavaScriptEnabled(true);
	}

	if (options.modules) {
		await Promise.all(options.modules.map(module_ => {
			return page.addScriptTag({
				[getInjectKey('js', module_)]: module_,
				type: 'module'
			});
		}));
	}

	if (options.scripts) {
		await Promise.all(options.scripts.map(script => {
			return page.addScriptTag({
				[getInjectKey('js', script)]: script
			});
		}));
	}

	if (options.styles) {
		await Promise.all(options.styles.map(style => {
			return page.addStyleTag({
				[getInjectKey('css', style)]: style
			});
		}));
	}

	if (options.waitForElement) {
		await page.waitForSelector(options.waitForElement, {
			visible: true,
			timeout: timeoutInSeconds
		});
	}

	if (options.beforeScreenshot) {
		await options.beforeScreenshot(page, browser);
	}

	if (options.element) {
		await page.waitForSelector(options.element, {
			visible: true,
			timeout: timeoutInSeconds
		});
		screenshotOptions.clip = await page.$eval(options.element, getBoundingClientRect);
		screenshotOptions.fullPage = false;
	}

	if (options.delay) {
		await page.waitForTimeout(options.delay * 1000);
	}

	if (options.scrollToElement) {
		// eslint-disable-next-line unicorn/prefer-ternary
		if (typeof options.scrollToElement === 'object') {
			await page.$eval(options.scrollToElement.element, scrollToElement, options.scrollToElement);
		} else {
			await page.$eval(options.scrollToElement, scrollToElement);
		}
	}

	if (screenshotOptions.fullPage) {
		// Get the height of the rendered page
		const bodyHandle = await page.$('body');
		const bodyBoundingHeight = await bodyHandle.boundingBox();
		await bodyHandle.dispose();

		// Scroll one viewport at a time, pausing to let content load
		const viewportHeight = viewportOptions.height;
		let viewportIncrement = 0;
		while (viewportIncrement + viewportHeight < bodyBoundingHeight) {
			const navigationPromise = page.waitForNavigation({waitUntil: 'networkidle0'});
			/* eslint-disable no-await-in-loop */
			await page.evaluate(_viewportHeight => {
				/* eslint-disable no-undef */
				window.scrollBy(0, _viewportHeight);
				/* eslint-enable no-undef */
			}, viewportHeight);
			await navigationPromise;
			/* eslint-enable no-await-in-loop */
			viewportIncrement += viewportHeight;
		}

		// Scroll back to top
		await page.evaluate(_ => {
			/* eslint-disable no-undef */
			window.scrollTo(0, 0);
			/* eslint-enable no-undef */
		});

		// Some extra delay to let images load
		await page.waitForFunction(imagesHaveLoaded, {timeout: timeoutInSeconds});
	}

	if (options.inset && !screenshotOptions.fullPage) {
		const inset = {top: 0, right: 0, bottom: 0, left: 0};
		for (const key of Object.keys(inset)) {
			if (typeof options.inset === 'number') {
				inset[key] = options.inset;
			} else {
				inset[key] = options.inset[key] || 0;
			}
		}

		let clipOptions = screenshotOptions.clip;

		if (!clipOptions) {
			clipOptions = await page.evaluate(() => ({
				x: 0,
				y: 0,
				/* eslint-disable no-undef */
				height: window.innerHeight,
				width: window.innerWidth
				/* eslint-enable no-undef */
			}));
		}

		const x = clipOptions.x + inset.left;
		const y = clipOptions.y + inset.top;
		const width = clipOptions.width - (inset.left + inset.right);
		const height = clipOptions.height - (inset.top + inset.bottom);

		if (width === 0 || height === 0) {
			await page.close();

			throw new Error('When using the `clip` option, the width or height of the screenshot cannot be equal to 0.');
		}

		screenshotOptions.clip = {x, y, width, height};
	}

	const buffer = await page.screenshot(screenshotOptions);

	await page.close();

	if (!options._keepAlive) {
		await browser.close();
	}

	return buffer;
};

const captureWebsite = {};

captureWebsite.file = async (url, filePath, options = {}) => {
	const screenshot = await internalCaptureWebsite(url, options);

	await fs.writeFile(filePath, screenshot, {
		flag: options.overwrite ? 'w' : 'wx'
	});
};

captureWebsite.buffer = async (url, options) => internalCaptureWebsite(url, options);

captureWebsite.base64 = async (url, options) => {
	const screenshot = await internalCaptureWebsite(url, options);
	return screenshot.toString('base64');
};

if (process.env.NODE_ENV === 'test') {
	captureWebsite._startBrowser = puppeteer.launch.bind(puppeteer);
}

export default captureWebsite;

export const devices = Object.values(puppeteer.devices).map(device => device.name);
