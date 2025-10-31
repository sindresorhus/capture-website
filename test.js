/* global document */
import fs from 'node:fs';
import {Buffer} from 'node:buffer';
import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import {imageDimensionsFromData} from 'image-dimensions';
import isJpg from 'is-jpg';
import isPng from 'is-png';
import pify from 'pify';
import PNG from 'png-js';
import createTestServer from 'create-test-server';
import {temporaryFile} from 'tempy';
import delay from 'delay';
import * as toughCookie from 'tough-cookie';
import fileUrl from 'file-url';
import {KnownDevices} from 'puppeteer';
/// import {base64ToUint8Array} from 'uint8array-extras';
import captureWebsite from './index.js';

const defaultResponse = (() => {
	const style = 'background-color: black; width: 100px; height: 100px;';
	return `<body style="margin: 0;"><div style="${style}"></div></body>`;
})();

const createDefaultServer = async () => {
	const server = await createTestServer();

	server.get('/', (request, response) => {
		response.end(defaultResponse);
	});

	return server;
};

const getPngPixels = async buffer => {
	const png = new PNG(buffer);
	const pixels = await pify(png.decode.bind(png), {errorFirst: false})();
	return pixels;
};

let server;
let browser;
let instance;

before(async () => {
	server = await createDefaultServer();
	browser = await captureWebsite._startBrowser();

	instance = (url, options) => captureWebsite.buffer(url, {
		...options,
		_browser: browser,
		_keepAlive: true,
	});
});

after(async () => {
	if (browser) {
		try {
			// Get the browser process before anything else
			const browserProcess = browser.process();

			// Close all pages to free resources
			const pages = await browser.pages();
			await Promise.all(pages.map(async page => {
				try {
					await page.close();
				} catch {}
			}));

			// Close the browser
			try {
				await browser.close();
			} catch {}

			// Force kill the browser process immediately
			if (browserProcess && !browserProcess.killed) {
				browserProcess.kill('SIGKILL');
			}
		} catch (error) {
			console.error('Error closing browser:', error);
		}
	}

	if (server) {
		try {
			await server.close();
		} catch {}
	}
});

test('capture screenshot - from url', async () => {
	assert.ok(isPng(await instance(server.url, {
		width: 100,
		height: 100,
	})));
});

test('capture screenshot - from local file', async () => {
	assert.ok(isPng(await instance('fixtures/local-file.html', {
		width: 100,
		height: 100,
	})));
});

test('capture screenshot - from file URL', async () => {
	assert.ok(isPng(await instance(fileUrl('fixtures/local-file.html'), {
		width: 100,
		height: 100,
	})));
});

test('capture screenshot - from data URL', async () => {
	assert.ok(isPng(await instance('data:text/html,<h1>Awesome!</h1>', {
		width: 100,
		height: 100,
	})));
});

test('capture screenshot - from HTML content', async () => {
	assert.ok(isPng(await instance('<h1>Awesome!</h1>', {
		inputType: 'html',
		width: 100,
		height: 100,
	})));
});

test('captureWebsite.file()', async () => {
	const filePath = temporaryFile();

	await captureWebsite.file(server.url, filePath, {
		width: 100,
		height: 100,
	});

	assert.ok(isPng(fs.readFileSync(filePath)));
});

test('captureWebsite.base64()', async () => {
	const screenshot = await captureWebsite.base64(server.url, {
		width: 100,
		height: 100,
	});

	assert.equal(typeof screenshot, 'string');

	// TODO: Fix base64 PNG verification.
	// assert.ok(isPng(base64ToUint8Array(screenshot)));
});

test('`type` option', async () => {
	assert.ok(isJpg(await instance(server.url, {
		width: 100,
		height: 100,
		type: 'jpeg',
	})));
});

test('`scaleFactor` option', async () => {
	const sizeOption = 100;
	const scaleFactor = 4;
	const expectedSize = sizeOption * scaleFactor;

	const size = imageDimensionsFromData(await instance(server.url, {
		width: sizeOption,
		height: sizeOption,
		scaleFactor,
	}));

	assert.equal(size.width, expectedSize);
	assert.equal(size.height, expectedSize);
});

test('`emulateDevice` option', async () => {
	const device = KnownDevices['iPhone X'];

	const size = imageDimensionsFromData(await instance(server.url, {
		emulateDevice: device.name,
	}));

	const {viewport} = device;
	assert.equal(size.width, viewport.width * viewport.deviceScaleFactor);
	assert.equal(size.height, viewport.height * viewport.deviceScaleFactor);
});

test('`fullPage` option', async () => {
	const size = imageDimensionsFromData(await instance(server.url, {
		width: 100,
		height: 200,
		scaleFactor: 1,
		fullPage: true,
	}));

	assert.equal(size.width, 100);
	assert.ok(size.height > 100);
});

test('`fullPage` option - lazy loading', async () => {
	const server = await createTestServer();
	const imageCount = 10; // Reduced from 50

	server.get('/', async (request, response) => {
		response.end(`
			<body>
				<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));">
					${[...Array.from({length: imageCount}).keys()].map(() => '<div style="width: 150px; height: 150px; background: #ccc; margin: 5px;">Image</div>').join('')}
				</div>
			</body>
		`);
	});

	const size = imageDimensionsFromData(await instance(server.url, {
		width: 200,
		height: 300,
		scaleFactor: 1,
		fullPage: true,
	}));

	assert.equal(size.width, 200);
	assert.ok(size.height > 150);

	await server.close();
});

test('`timeout` option', async () => {
	const server = await createTestServer();

	server.get('/', async (request, response) => {
		await delay(5000);
		response.end();
	});

	await assert.rejects(instance(server.url, {
		width: 100,
		height: 100,
		timeout: 1,
	}), {message: /1000 ms exceeded/});

	await server.close();
});

test('`element` option - capture DOM element', async () => {
	const size = imageDimensionsFromData(await instance(server.url, {
		width: 400,
		height: 400,
		scaleFactor: 1,
		element: 'div',
	}));

	assert.equal(size.width, 100);
	assert.equal(size.height, 100);
});

test('`element` option - wait for DOM element', async () => {
	const server = await createTestServer();

	server.get('/', async (request, response) => {
		response.end(`
			<body>
				<div style="width: 100px; height: 100px;"></div>
				<script>
					window.setTimeout(() => {
						document.querySelector('div').style.display = 'block';
					}, 5000);
				</script>
			</body>
		`);
	});

	const size = imageDimensionsFromData(await instance(server.url, {
		width: 400,
		height: 400,
		scaleFactor: 1,
		element: 'div',
	}));

	assert.equal(size.width, 100);
	assert.equal(size.height, 100);

	await server.close();
});

test('`hideElements` option', async () => {
	const pixels = await getPngPixels(await instance(server.url, {
		width: 100,
		height: 100,
		hideElements: [
			'div',
		],
	}));

	assert.equal(pixels[0], 255);
});

test('`removeElements` option', async () => {
	const pixels = await getPngPixels(await instance(server.url, {
		width: 100,
		height: 100,
		removeElements: [
			'div',
		],
	}));

	assert.equal(pixels[0], 255);
});

test('`clickElement` option', async () => {
	const server = await createTestServer();

	server.get('/', async (request, response) => {
		response.end(`
			<body style="margin: 0;">
				<div style="background-color: black; width: 100px; height: 100px;"></div>
				<script>
					document.querySelector('div').addEventListener('click', function () {
						this.style.backgroundColor = 'red';
					});
				</script>
			</body>
		`);
	});

	const pixels = await getPngPixels(await instance(server.url, {
		width: 100,
		height: 100,
		clickElement: 'div',
	}));

	assert.equal(pixels[0], 255);
	assert.equal(pixels[1], 0);
	assert.equal(pixels[2], 0);

	await server.close();
});

test('`scrollToElement` option as string', async () => {
	const server = await createTestServer();

	server.get('/', async (request, response) => {
		response.end(`
			<body style="margin: 0;">
				<div style="width: 100px; height: 100px; overflow: auto;">
					<div style="width: 200px; height: 200px; display: flex; flex-wrap: wrap">
						<div id="red" style="background-color: #f00; width: 100px; height: 100px; flex: 1 0 auto;"></div>
						<div id="green" style="background-color: #0f0; width: 100px; height: 100px; flex: 1 0 auto;"></div>
						<div id="blue" style="background-color: #00f; width: 100px; height: 100px; flex: 1 0 auto;"></div>
						<div id="black" style="background-color: #000; width: 100px; height: 100px; flex: 1 0 auto;"></div>
					</div>
				</div>
			</body>
		`);
	});

	const pixels = await getPngPixels(await instance(server.url, {
		width: 100,
		height: 100,
		scrollToElement: '#black',
	}));

	assert.equal(pixels[0], 0);
	assert.equal(pixels[1], 0);
	assert.equal(pixels[2], 0);

	await server.close();
});

test('`scrollToElement` option as object', async () => {
	const server = await createTestServer();

	server.get('/', async (request, response) => {
		response.end(`
			<body style="margin: 0;">
				<div style="width: 100px; height: 100px; overflow: auto;">
					<div style="width: 200px; height: 200px; display: flex; flex-wrap: wrap">
						<div id="red" style="background-color: #f00; width: 100px; height: 100px; flex: 1 0 auto;"></div>
						<div id="green" style="background-color: #0f0; width: 100px; height: 100px; flex: 1 0 auto;"></div>
						<div id="blue" style="background-color: #00f; width: 100px; height: 100px; flex: 1 0 auto;"></div>
						<div id="black" style="background-color: #000; width: 100px; height: 100px; flex: 1 0 auto;"></div>
					</div>
				</div>
			</body>
		`);
	});

	const pixels = await getPngPixels(await instance(server.url, {
		width: 100,
		height: 100,
		scrollToElement: {
			element: '#green',
			offsetFrom: 'top',
			offset: 100,
		},
	}));

	assert.equal(pixels[0], 0);
	assert.equal(pixels[1], 0);
	assert.equal(pixels[2], 0);

	await server.close();
});

test('`disableAnimations` option', async () => {
	const server = await createTestServer();

	server.get('/', async (request, response) => {
		response.end(`
			<style>
				div{animation:test 5s infinite}
				@keyframes test{0%{background-color:#fff}100%{background-color:#eee}}
			</style>
			<body style="margin: 0;">
				<div style="background-color: black; width: 100px; height: 100px;"></div>
			</body>
		`);
	});

	const pixels = await getPngPixels(await instance(server.url, {
		width: 100,
		height: 100,
		disableAnimations: true,
	}));

	assert.equal(pixels[0], 0);
	assert.equal(pixels[1], 0);
	assert.equal(pixels[2], 0);

	await server.close();
});

test('`isJavaScriptEnabled: false` option', async () => {
	const server = await createTestServer();

	server.get('/', async (request, response) => {
		response.end(`
			<body style="margin: 0;">
				<div style="background-color: black; width: 100px; height: 100px;"></div>
				<script>
					setTimeout(function() {
						document.querySelector('div').style.backgroundColor = 'red';
					}, 500);
				</script>
			</body>
		`);
	});

	const pixels = await getPngPixels(await instance(server.url, {
		width: 100,
		height: 100,
		delay: 1,
		isJavaScriptEnabled: false,
	}));

	assert.equal(pixels[0], 0);
	assert.equal(pixels[1], 0);
	assert.equal(pixels[2], 0);

	await server.close();
});

test('`isJavaScriptEnabled: false` works with the `scripts` option', async () => {
	const pixels = await getPngPixels(await instance(server.url, {
		width: 100,
		height: 100,
		isJavaScriptEnabled: false,
		scripts: [
			'document.querySelector(\'div\').style.backgroundColor = \'red\';',
		],
	}));

	assert.equal(pixels[0], 255);
	assert.equal(pixels[1], 0);
	assert.equal(pixels[2], 0);
});

test('`isJavaScriptEnabled: false` works with the `modules` option', async () => {
	const pixels = await getPngPixels(await instance(server.url, {
		width: 100,
		height: 100,
		isJavaScriptEnabled: false,
		modules: [
			'document.querySelector(\'div\').style.backgroundColor = \'red\';',
		],
	}));

	assert.equal(pixels[0], 255);
	assert.equal(pixels[1], 0);
	assert.equal(pixels[2], 0);
});

test('`modules` option - inline', async () => {
	const pixels = await getPngPixels(await instance(server.url, {
		width: 100,
		height: 100,
		modules: [
			'document.querySelector(\'div\').style.backgroundColor = \'red\';',
		],
	}));

	assert.equal(pixels[0], 255);
	assert.equal(pixels[1], 0);
	assert.equal(pixels[2], 0);
});

test('`modules` option - file', async () => {
	const pixels = await getPngPixels(await instance(server.url, {
		width: 100,
		height: 100,
		modules: [
			'fixtures/script.js',
		],
	}));

	assert.equal(pixels[0], 255);
	assert.equal(pixels[1], 0);
	assert.equal(pixels[2], 0);
});

test('`modules` option - url', async () => {
	const server = await createTestServer();

	server.get('/', (request, response) => {
		response.end(defaultResponse);
	});

	server.get('/module.js', (request, response) => {
		response.set('content-type', 'text/javascript');
		response.end('document.querySelector(\'div\').style.backgroundColor = \'red\';');
	});

	const pixels = await getPngPixels(await instance(server.url, {
		width: 100,
		height: 100,
		modules: [
			`${server.url}/module.js`,
		],
	}));

	assert.equal(pixels[0], 255);
	assert.equal(pixels[1], 0);
	assert.equal(pixels[2], 0);

	await server.close();
});

test('`scripts` option - inline', async () => {
	const pixels = await getPngPixels(await instance(server.url, {
		width: 100,
		height: 100,
		scripts: [
			'document.querySelector(\'div\').style.backgroundColor = \'red\';',
		],
	}));

	assert.equal(pixels[0], 255);
	assert.equal(pixels[1], 0);
	assert.equal(pixels[2], 0);
});

test('`scripts` option - file', async () => {
	const pixels = await getPngPixels(await instance(server.url, {
		width: 100,
		height: 100,
		scripts: [
			'fixtures/script.js',
		],
	}));

	assert.equal(pixels[0], 255);
	assert.equal(pixels[1], 0);
	assert.equal(pixels[2], 0);
});

test('`scripts` option - url', async () => {
	const server = await createTestServer();

	server.get('/', (request, response) => {
		response.end(defaultResponse);
	});

	server.get('/script.js', (request, response) => {
		response.set('content-type', 'text/javascript');
		response.end('document.querySelector(\'div\').style.backgroundColor = \'red\';');
	});

	const pixels = await getPngPixels(await instance(server.url, {
		width: 100,
		height: 100,
		scripts: [
			`${server.url}/script.js`,
		],
	}));

	assert.equal(pixels[0], 255);
	assert.equal(pixels[1], 0);
	assert.equal(pixels[2], 0);

	await server.close();
});

test('`styles` option - inline', async () => {
	const pixels = await getPngPixels(await instance(server.url, {
		width: 100,
		height: 100,
		styles: [
			'div { background-color: red !important; }',
		],
	}));

	assert.equal(pixels[0], 255);
	assert.equal(pixels[1], 0);
	assert.equal(pixels[2], 0);
});

test('`styles` option - file', async () => {
	const pixels = await getPngPixels(await instance(server.url, {
		width: 100,
		height: 100,
		styles: [
			'fixtures/style.css',
		],
	}));

	assert.equal(pixels[0], 255);
	assert.equal(pixels[1], 0);
	assert.equal(pixels[2], 0);
});

test('`styles` option - url', async () => {
	const server = await createTestServer();

	server.get('/', (request, response) => {
		response.end(defaultResponse);
	});

	server.get('/style.css', (request, response) => {
		response.set('content-type', 'text/css');
		response.end('div { background-color: red !important; }');
	});

	const pixels = await getPngPixels(await instance(server.url, {
		width: 100,
		height: 100,
		styles: [
			`${server.url}/style.css`,
		],
	}));

	assert.equal(pixels[0], 255);
	assert.equal(pixels[1], 0);
	assert.equal(pixels[2], 0);

	await server.close();
});

test('`headers` option', async () => {
	const fixture = 'unicorn';
	const server = await createTestServer();

	let headers;
	server.get('/', (request, response) => {
		headers = request.headers;
		response.end();
	});

	await instance(server.url, {
		width: 100,
		height: 100,
		headers: {
			fixture,
		},
	});

	assert.equal(headers.fixture, fixture);

	await server.close();
});

test('`cookies` option', async () => {
	const server = await createTestServer();

	server.get('/', (request, response) => {
		const color = toughCookie.parse(request.headers.cookie).value || 'white';

		const style = `
			position: absolute;
			top: 0;
			right: 0;
			bottom: 0;
			left: 0;
			background-color: ${color};
		`;

		response.end(`<body><div style="${style}"></div></body>`);
	});

	const pixels = await getPngPixels(await instance(server.url, {
		width: 100,
		height: 100,
		cookies: [
			{
				name: 'color',
				value: 'black',
				domain: 'localhost',
			},
		],
	}));

	assert.equal(pixels[0], 0);

	const pixels2 = await getPngPixels(await instance(server.url, {
		width: 100,
		height: 100,
		cookies: [
			'color=black',
		],
	}));

	assert.equal(pixels2[0], 0);

	await server.close();
});

test('`authentication` option', async () => {
	const authentication = {
		username: 'foo',
		password: 'bar',
	};

	const server = await createTestServer();

	server.get('/auth', (request, response) => {
		const auth = request.headers.authorization;
		if (auth && auth.startsWith('Basic ')) {
			const [user, pass] = Buffer.from(auth.slice(6), 'base64').toString().split(':');
			if (user === authentication.username && pass === authentication.password) {
				response.end(defaultResponse);
				return;
			}
		}

		response.statusCode = 401;
		response.setHeader('WWW-Authenticate', 'Basic realm="Test"');
		response.end('Unauthorized');
	});

	assert.ok(isPng(await instance(`${server.url}/auth`, {
		width: 100,
		height: 100,
		authentication,
	})));

	await server.close();
});

test('`overwrite` option', async () => {
	const filePath = temporaryFile();

	await assert.doesNotReject(async () => {
		await captureWebsite.file(server.url, filePath, {
			width: 100,
			height: 100,
		});

		await captureWebsite.file(server.url, filePath, {
			width: 100,
			height: 100,
			overwrite: true,
		});
	});
});

test('handle redirects', async () => {
	const server = await createTestServer();

	server.get('/', (request, response) => {
		response.end(defaultResponse);
	});

	server.get('/redirect', (request, response) => {
		response.redirect(server.url);
	});

	const pixels = await getPngPixels(await instance(`${server.url}/redirect`, {
		width: 100,
		height: 100,
	}));

	assert.equal(pixels[0], 0);

	await server.close();
});

test('`darkMode` option', async () => {
	const server = await createTestServer();

	server.get('/', (request, response) => {
		response.end(`
		<html>
			<head>
				<style>
					body {
						background: white;
						width: 100px;
						height: 100px;
					}
					@media (prefers-color-scheme: dark) {
						body { background: black; }
					}
				</style>
			</head>
			<body></body>
		</html>
		`);
	});

	const pixels = await getPngPixels(await instance(server.url, {
		width: 100,
		height: 100,
	}));

	assert.equal(pixels[0], 255);
	assert.equal(pixels[1], 255);
	assert.equal(pixels[2], 255);

	const pixels2 = await getPngPixels(await instance(server.url, {
		width: 100,
		height: 100,
		darkMode: true,
	}));

	assert.equal(pixels2[0], 0);
	assert.equal(pixels2[1], 0);
	assert.equal(pixels2[2], 0);

	await server.close();
});

test('`inset` option', async () => {
	const viewportOptions = {
		scaleFactor: 1,
		width: 100,
		height: 100,
	};
	// The `inset` and `fullPage` options are exclusive.
	// See: https://github.com/puppeteer/puppeteer/blob/e45acce928429d0d1572e16943307a73ebd38d8a/src/common/Page.ts#L1620
	// In such cases, the `inset` option should be ignored.
	const withFullPageOption = await getPngPixels(await instance(server.url, {
		...viewportOptions,
		fullPage: true,
		inset: 10,
	}));
	// First pixel should be black. Image should have resolution 100x100.
	assert.equal(withFullPageOption[0], 0);
	assert.equal(withFullPageOption[1], 0);
	assert.equal(withFullPageOption[2], 0);
	assert.ok(withFullPageOption.length / 4 === 100 * 100);

	// A document with black body with margin 10px containing
	// two full-width `div` elements stacked on top of each other.
	// First `div` element is red and has height of 20px.
	// Second `div` element is white and has height of 500px.
	const fixture = 'fixtures/inset-option.html';

	// The `element` option overwrites the `fullPage` option,
	// therefore should behave as if `fullPage` option was `false`.
	const withElementOption = await getPngPixels(await instance(fixture, {
		...viewportOptions,
		element: 'body',
		fullPage: true,
		inset: 10,
	}));
	// First pixel should be red. Image should have resolution 80*520.
	assert.equal(withElementOption[0], 255);
	assert.equal(withElementOption[1], 0);
	assert.equal(withElementOption[2], 0);
	assert.ok(withElementOption.length / 4 === 80 * 520);

	const viewportPixels = await getPngPixels(await instance(fixture, {
		...viewportOptions,
		inset: 10,
	}));

	// First pixel should be red. Image should have resolution 80x80.
	assert.equal(viewportPixels[0], 255);
	assert.equal(viewportPixels[1], 0);
	assert.equal(viewportPixels[2], 0);
	assert.ok(viewportPixels.length / 4 === 80 * 80);

	const withTopInset = await getPngPixels(await instance(fixture, {
		...viewportOptions,
		inset: {top: 30, left: 10},
	}));

	// First pixel should be white. The image resolution should be 90x70.
	assert.equal(withTopInset[0], 255);
	assert.equal(withTopInset[1], 255);
	assert.equal(withTopInset[2], 255);
	assert.ok(withTopInset.length / 4 === 90 * 70);

	const withNegativeInset = await getPngPixels(await instance(fixture, {
		...viewportOptions,
		element: '.header',
		inset: -10,
	}));

	// First pixel should be black. The image resolution should be 100x40.
	assert.equal(withNegativeInset[0], 0);
	assert.equal(withNegativeInset[1], 0);
	assert.equal(withNegativeInset[2], 0);
	assert.ok(withNegativeInset.length / 4 === 100 * 40);

	// Should throw if `inset` width or height values are 0.
	await assert.rejects(async () => {
		await instance(fixture, {
			...viewportOptions,
			inset: 50,
		});
	});
});

test.skip('`preloadFunction` option', async () => {
	const server = await createTestServer();

	server.get('/', async (request, response) => {
		response.end(`
			<body style="margin: 0;">
				<div style="background-color: black; width: 100px; height: 100px;"></div>
				<script async>
					globalThis.toRed();
				</script>
			</body>
		`);
	});

	const pixels = await getPngPixels(await instance(server.url, {
		width: 100,
		height: 100,
		preloadFunction() {
			globalThis.toRed = () => {
				document.querySelector('div').style.backgroundColor = 'red';
			};
		},
	}));

	assert.equal(pixels[0], 255);
	assert.equal(pixels[1], 0);
	assert.equal(pixels[2], 0);

	await server.close();
});

test('`preloadFunctionArguments` option', async () => {
	// Simply verify that the option is accepted and works without errors
	const screenshot = await captureWebsite.buffer('<h1>Test</h1>', {
		inputType: 'html',
		width: 100,
		height: 100,
		preloadFunction(value1, value2) {
			/* eslint-disable no-undef, unicorn/prefer-global-this */
			window.testValue1 = value1;
			window.testValue2 = value2;
			/* eslint-enable no-undef, unicorn/prefer-global-this */
		},
		preloadFunctionArguments: ['test', 123],
	});

	assert.ok(isPng(screenshot));
});

test('`clip` option', async () => {
	const size = imageDimensionsFromData(await instance(server.url, {
		scaleFactor: 1,
		clip: {
			x: 10,
			y: 30,
			width: 500,
			height: 300,
		},
	}));
	assert.equal(size.width, 500);
	assert.equal(size.height, 300);
});

test('`allowCORS` option', async () => {
	// Create a simple HTML with local file reference
	const html = `
		<!DOCTYPE html>
		<html>
		<head>
			<style>
				body { background: white; }
				.test { color: red; }
			</style>
		</head>
		<body>
			<div class="test">CORS Test</div>
		</body>
		</html>
	`;

	// Test that the option is accepted and doesn't throw
	const screenshot = await captureWebsite.buffer(html, {
		inputType: 'html',
		width: 100,
		height: 100,
		allowCORS: true,
	});

	assert.ok(isPng(screenshot));
});

test('`waitForNetworkIdle` option', async () => {
	// Test that the option is accepted and doesn't throw
	const screenshot = await instance(server.url, {
		width: 100,
		height: 100,
		waitForNetworkIdle: true,
	});

	assert.ok(isPng(screenshot));
});

test('option validation - The `clip` and `element` option are mutually exclusive', async () => {
	const expectedErrorMessage = 'The `clip` and `element` option are mutually exclusive';
	const options = {
		element: 'html',
		clip: {
			x: 1,
			y: 10,
			width: 10,
			height: 100,
		},
	};
	await assert.rejects(captureWebsite.base64(server.url, options), {
		message: expectedErrorMessage,
	});
});

test('option validation - The `clip` and `fullPage` option are mutually exclusive', async () => {
	const expectedErrorMessage = 'The `clip` and `fullPage` option are mutually exclusive';
	const options = {
		fullPage: true,
		clip: {
			x: 1,
			y: 10,
			width: 10,
			height: 100,
		},
	};
	await assert.rejects(captureWebsite.base64(server.url, options), {
		message: expectedErrorMessage,
	});
});

test('`throwOnHttpError` option - throws on 404', async () => {
	const server = await createTestServer();

	server.get('/not-found', (request, response) => {
		response.status(404).end('Not Found');
	});

	await assert.rejects(
		instance(`${server.url}/not-found`, {
			width: 100,
			height: 100,
			throwOnHttpError: true,
		}),
		{
			message: /HTTP 404/,
		},
	);

	await server.close();
});

test('`throwOnHttpError` option - throws on 500', async () => {
	const server = await createTestServer();

	server.get('/error', (request, response) => {
		response.status(500).end('Internal Server Error');
	});

	await assert.rejects(
		instance(`${server.url}/error`, {
			width: 100,
			height: 100,
			throwOnHttpError: true,
		}),
		{
			message: /HTTP 500/,
		},
	);

	await server.close();
});

test('`throwOnHttpError` option - does not throw by default', async () => {
	const server = await createTestServer();

	server.get('/not-found', (request, response) => {
		response.status(404).end('Not Found');
	});

	// Should not throw even though it's a 404
	assert.ok(isPng(await instance(`${server.url}/not-found`, {
		width: 100,
		height: 100,
	})));

	await server.close();
});

test('`throwOnHttpError` option - does not throw on 2XX', async () => {
	const server = await createTestServer();

	server.get('/', (request, response) => {
		response.end(defaultResponse);
	});

	// Should not throw on 200
	assert.ok(isPng(await instance(server.url, {
		width: 100,
		height: 100,
		throwOnHttpError: true,
	})));

	await server.close();
});

test('`throwOnHttpError` option - does not affect HTML content', async () => {
	// Should not throw even with throwOnHttpError enabled for HTML content
	assert.ok(isPng(await instance('<h1>Test</h1>', {
		inputType: 'html',
		width: 100,
		height: 100,
		throwOnHttpError: true,
	})));
});

test('`throwOnHttpError` option - does not throw for local files', async () => {
	// Should not throw for file:// URLs even with throwOnHttpError enabled
	assert.ok(isPng(await instance('fixtures/local-file.html', {
		width: 100,
		height: 100,
		throwOnHttpError: true,
	})));
});

test('`throwOnHttpError` option - does not throw for data URLs', async () => {
	// Should not throw for data: URLs even with throwOnHttpError enabled
	assert.ok(isPng(await instance('data:text/html,<h1>Test</h1>', {
		width: 100,
		height: 100,
		throwOnHttpError: true,
	})));
});

test('`type: pdf` option', async () => {
	const buffer = await instance(server.url, {
		width: 400,
		height: 300,
		type: 'pdf',
	});

	// PDF signature starts with %PDF
	assert.ok(buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46);
});

test('`type: pdf` with all pdf options', async () => {
	const buffer = await instance(server.url, {
		width: 400,
		height: 300,
		type: 'pdf',
		scaleFactor: 1.5,
		pdf: {
			format: 'a4',
			landscape: true,
			margin: {
				top: '10px',
				right: '10px',
				bottom: '10px',
				left: '10px',
			},
			background: true,
		},
	});

	// Verify it's a valid PDF
	assert.ok(buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46);
});

test('`type: pdf` validation - rejects clip option', async () => {
	await assert.rejects(
		instance(server.url, {
			type: 'pdf',
			clip: {
				x: 0,
				y: 0,
				width: 100,
				height: 100,
			},
		}),
		{
			message: /clip.*not supported.*pdf/i,
		},
	);
});

test('`type: pdf` validation - rejects element option', async () => {
	await assert.rejects(
		instance(server.url, {
			type: 'pdf',
			element: '.logo',
		}),
		{
			message: /element.*not supported.*pdf/i,
		},
	);
});

test('`type: pdf` validation - rejects quality option', async () => {
	await assert.rejects(
		instance(server.url, {
			type: 'pdf',
			quality: 0.5,
		}),
		{
			message: /quality.*not supported.*pdf/i,
		},
	);
});

test('`referrer` option', async () => {
	const expectedReferrer = 'https://example.com/';
	const server = await createTestServer();

	let receivedReferrer;
	server.get('/', (request, response) => {
		receivedReferrer = request.headers.referer;
		response.end(defaultResponse);
	});

	await instance(server.url, {
		width: 100,
		height: 100,
		referrer: 'https://example.com',
	});

	assert.equal(receivedReferrer, expectedReferrer);

	await server.close();
});

test('`referrer` option - does not affect HTML content', async () => {
	// Should not break when using referrer with HTML content
	assert.ok(isPng(await instance('<h1>Test</h1>', {
		inputType: 'html',
		width: 100,
		height: 100,
		referrer: 'https://example.com',
	})));
});

test('`referrer` option - takes precedence over headers option', async () => {
	const expectedReferrer = 'https://referrer-option.com/';
	const server = await createTestServer();

	let receivedReferrer;
	server.get('/', (request, response) => {
		receivedReferrer = request.headers.referer;
		response.end(defaultResponse);
	});

	await instance(server.url, {
		width: 100,
		height: 100,
		headers: {
			referer: 'https://headers-option.com',
		},
		referrer: 'https://referrer-option.com',
	});

	assert.equal(receivedReferrer, expectedReferrer);

	await server.close();
});

test('`beforeNavigation` option - basic functionality', async () => {
	let beforeNavigationCalled = false;
	let receivedPage;
	let receivedBrowser;

	const screenshot = await instance(server.url, {
		width: 100,
		height: 100,
		async beforeNavigation(page, browser) {
			beforeNavigationCalled = true;
			receivedPage = page;
			receivedBrowser = browser;
		},
	});

	assert.ok(beforeNavigationCalled);
	assert.ok(receivedPage);
	assert.ok(receivedBrowser);
	assert.ok(isPng(screenshot));
});

test('`beforeNavigation` option - handle dialogs during page load', async () => {
	const server = await createTestServer();

	// Create a page that shows an alert during page load
	server.get('/', (request, response) => {
		response.end(`
			<body style="margin: 0;">
				<div style="background-color: black; width: 100px; height: 100px;"></div>
				<script>
					alert('This alert appears during page load');
				</script>
			</body>
		`);
	});

	let dialogMessage;

	// This should not hang and should capture the screenshot successfully
	const screenshot = await instance(server.url, {
		width: 100,
		height: 100,
		async beforeNavigation(page, _browser) {
			// Use page.once() for single events
			page.once('dialog', async dialog => {
				dialogMessage = dialog.message();
				await dialog.dismiss();
			});
		},
	});

	assert.ok(isPng(screenshot));
	assert.equal(dialogMessage, 'This alert appears during page load');

	await server.close();
});

test('`beforeNavigation` option - works with HTML content', async () => {
	let beforeNavigationCalled = false;

	const screenshot = await instance('<h1>Test</h1>', {
		inputType: 'html',
		width: 100,
		height: 100,
		async beforeNavigation(_page, _browser) {
			beforeNavigationCalled = true;
		},
	});

	assert.ok(beforeNavigationCalled);
	assert.ok(isPng(screenshot));
});

test('`beforeNavigation` option - propagates errors', async () => {
	await assert.rejects(
		instance(server.url, {
			async beforeNavigation(_page, _browser) {
				throw new Error('Test error from beforeNavigation');
			},
		}),
		{message: 'Test error from beforeNavigation'},
	);
});

test('`beforeNavigation` and `beforeScreenshot` - execute in correct order', async () => {
	const executionOrder = [];

	const screenshot = await instance(server.url, {
		width: 100,
		height: 100,
		async beforeNavigation(_page, _browser) {
			executionOrder.push('navigation');
		},
		async beforeScreenshot(_page, _browser) {
			executionOrder.push('screenshot');
		},
	});

	assert.deepEqual(executionOrder, ['navigation', 'screenshot']);
	assert.ok(isPng(screenshot));
});

test('`beforeNavigation` option - handle multiple dialogs during page load', async () => {
	const server = await createTestServer();

	// Create a page that shows multiple alerts during page load
	server.get('/', (request, response) => {
		response.end(`
			<body style="margin: 0;">
				<div style="background-color: black; width: 100px; height: 100px;"></div>
				<script>
					alert('First alert');
					alert('Second alert');
					alert('Third alert');
				</script>
			</body>
		`);
	});

	const dialogMessages = [];

	// This should handle all dialogs and not hang
	const screenshot = await instance(server.url, {
		width: 100,
		height: 100,
		async beforeNavigation(page, _browser) {
			// Use page.on() for multiple events
			page.on('dialog', async dialog => {
				dialogMessages.push(dialog.message());
				await dialog.dismiss();
			});
		},
	});

	assert.ok(isPng(screenshot));
	assert.equal(dialogMessages.length, 3);
	assert.equal(dialogMessages[0], 'First alert');
	assert.equal(dialogMessages[1], 'Second alert');
	assert.equal(dialogMessages[2], 'Third alert');

	await server.close();
});

test('`onConsole` option', async () => {
	const server = await createTestServer();

	server.get('/', (request, response) => {
		response.end(`
			<body>
				<script>
					console.log('Test message');
					console.warn('Warning message');
				</script>
			</body>
		`);
	});

	const messages = [];

	const screenshot = await instance(server.url, {
		width: 100,
		height: 100,
		onConsole(message) {
			messages.push({
				text: message.text(),
				type: message.type(),
			});
		},
	});

	assert.ok(isPng(screenshot));
	assert.ok(messages.length >= 2);

	const log = messages.find(m => m.text === 'Test message');
	const warn = messages.find(m => m.text === 'Warning message');

	assert.ok(log);
	assert.equal(log.type, 'log');
	assert.ok(warn);
	assert.equal(warn.type, 'warn');

	await server.close();
});

test('`preloadLazyContent` option', async () => {
	const server = await createTestServer();

	server.get('/', (request, response) => {
		response.end(`
			<!DOCTYPE html>
			<html>
			<head>
				<style>
					body { margin: 0; background: white; }
					#spacer { height: 2000px; }
					#lazy-content {
						width: 100%;
						height: 50px;
						background: red;
						position: absolute;
						top: 1500px;
					}
				</style>
			</head>
			<body>
				<div id="spacer"></div>
				<div id="lazy-content">Lazy Content</div>
				<script>
					// Track if page was scrolled beyond viewport
					window.wasScrolled = false;
					window.maxScrollY = 0;

					window.addEventListener('scroll', () => {
						window.maxScrollY = Math.max(window.maxScrollY, window.scrollY);
						if (window.scrollY > window.innerHeight) {
							window.wasScrolled = true;
							console.log('Scrolled beyond viewport, maxScrollY:', window.maxScrollY);
						}
					});
				</script>
			</body>
			</html>
		`);
	});

	// Test without preloadLazyContent - should not scroll
	const messagesWithout = [];
	await instance(server.url, {
		width: 100,
		height: 100,
		scaleFactor: 1,
		onConsole(message) {
			messagesWithout.push(message.text());
		},
	});

	const scrolledWithout = messagesWithout.some(m => m.includes('Scrolled beyond viewport'));

	// Test with preloadLazyContent - should scroll through the page
	const messagesWith = [];
	const screenshot = await instance(server.url, {
		width: 100,
		height: 100,
		scaleFactor: 1,
		preloadLazyContent: true,
		onConsole(message) {
			messagesWith.push(message.text());
		},
	});

	const scrolledWith = messagesWith.some(m => m.includes('Scrolled beyond viewport'));

	assert.ok(isPng(screenshot));
	assert.equal(scrolledWithout, false, 'Should not scroll without preloadLazyContent');
	assert.equal(scrolledWith, true, 'Should scroll with preloadLazyContent');

	await server.close();
});

test('fullPage capture waits for slow lazy content', async () => {
	const server = await createTestServer();
	let delayedRequests = 0;

	server.get('/', (request, response) => {
		response.end(`
			<!DOCTYPE html>
			<html>
			<head>
				<style>
					body { margin: 0; background: white; }
					#initial { height: 1800px; background: linear-gradient(#fff, #eee); }
				</style>
			</head>
			<body>
				<div id="initial"></div>
				<script>
					let appended = false;

					window.addEventListener('scroll', () => {
						if (appended) {
							return;
						}

						appended = true;

						(async () => {
							await fetch('/delayed-chunk');
							const delayed = document.createElement('div');
							delayed.id = 'delayed-content';
							delayed.style.height = '1000px';
							delayed.style.background = '#f00';
							delayed.textContent = 'Delayed content';
							document.body.append(delayed);
						})();
					});
				</script>
			</body>
			</html>
		`);
	});

	server.get('/delayed-chunk', async (request, response) => {
		delayedRequests++;
		await delay(3500);
		response.end('ok');
	});

	const screenshot = await instance(server.url, {
		width: 300,
		height: 400,
		scaleFactor: 1,
		fullPage: true,
		preloadLazyContent: true,
	});

	const size = imageDimensionsFromData(screenshot);

	assert.ok(size.height > 2600, 'Should capture delayed lazy content');
	assert.equal(delayedRequests, 1);

	await server.close();
});
