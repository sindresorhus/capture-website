'use strict';
const {promisify} = require('util');
const fs = require('fs');
const fileUrl = require('file-url');
const puppeteer = require('puppeteer');
const devices = require('puppeteer/DeviceDescriptors');
const toughCookie = require('tough-cookie');

const writeFile = promisify(fs.writeFile);

const isUrl = string => /^(https?|file):\/\/|^data:/.test(string);

const hideElements = elements => {
	for (const element of elements) {
		element.style.visibility = 'hidden';
	}
};

const removeElements = elements => {
	for (const element of elements) {
		element.style.display = 'none';
	}
};

const getBoundingClientRect = element => {
	const {height, width, x, y} = element.getBoundingClientRect();
	return {height, width, x, y};
};

const parseCookie = (url, cookie) => {
	if (typeof cookie === 'object') {
		return cookie;
	}

	const jar = new toughCookie.CookieJar(undefined, {rejectPublicSuffixes: false});
	jar.setCookieSync(cookie, url);
	const ret = jar.serializeSync().cookies[0];

	// Use this instead of the above when the following issue is fixed:
	// https://github.com/salesforce/tough-cookie/issues/149
	// const ret = toughCookie.parse(cookie).serializeSync();

	ret.name = ret.key;
	delete ret.key;

	return ret;
};

const captureWebsite = async (url, options) => {
	const finalUrl = isUrl(url) ? url : fileUrl(url);

	options = {
		width: 1280,
		height: 800,
		scaleFactor: 2,
		fullPage: false,
		defaultBackground: true,
		timeout: 60, // The Puppeteer default of 30 is too short
		delay: 0,
		debug: false,
		launchOptions: {},
		_keepAlive: false,
		...options
	};

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
		const cookies = options.cookies.map(cookie => parseCookie(finalUrl, cookie));
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
		if (!(options.emulateDevice in devices)) {
			throw new Error(`The device name \`${options.emulateDevice}\` is not supported`);
		}

		await page.emulate(devices[options.emulateDevice]);
	}

	await page.goto(finalUrl, {
		timeout: timeoutInSeconds,
		waitUntil: 'networkidle2'
	});

	if (options.hideElements) {
		await Promise.all(options.hideElements.map(selector => page.$$eval(selector, hideElements)));
	}

	if (options.removeElements) {
		await Promise.all(options.removeElements.map(selector => page.$$eval(selector, removeElements)));
	}

	if (options.clickElement) {
		await page.click(options.clickElement);
	}

	const getInjectKey = (ext, value) => isUrl(value) ? 'url' : value.endsWith(`.${ext}`) ? 'path' : 'content';

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

	if (options.element) {
		await page.waitForSelector(options.element, {
			visible: true,
			timeout: timeoutInSeconds
		});
		screenshotOptions.clip = await page.$eval(options.element, getBoundingClientRect);
		screenshotOptions.fullPage = false;
	}

	if (options.delay) {
		await page.waitFor(options.delay * 1000);
	}

	if (options.beforeScreenshot) {
		await options.beforeScreenshot(page, browser);
	}

	const buffer = await page.screenshot(screenshotOptions);

	await page.close();

	if (!options._keepAlive) {
		await browser.close();
	}

	return buffer;
};

module.exports.file = async (url, filePath, options = {}) => {
	const screenshot = await captureWebsite(url, options);

	await writeFile(filePath, screenshot, {
		flag: options.overwrite ? 'w' : 'wx'
	});
};

module.exports.buffer = async (url, options) => captureWebsite(url, {...options, encoding: 'binary'});

module.exports.base64 = async (url, options) => captureWebsite(url, {...options, encoding: 'base64'});

module.exports.devices = Object.values(devices).map(device => device.name);

if (process.env.NODE_ENV === 'test') {
	module.exports._startBrowser = puppeteer.launch.bind(puppeteer);
}
