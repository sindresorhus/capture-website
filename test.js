/* global document, window */
import fs from 'node:fs';
import test from 'ava';
import imageSize from 'image-size';
import isJpg from 'is-jpg';
import isPng from 'is-png';
import pify from 'pify';
import PNG from 'png-js';
import createTestServer from 'create-test-server';
import tempy from 'tempy';
import delay from 'delay';
import toughCookie from 'tough-cookie';
import fileUrl from 'file-url';
import puppeteer from 'puppeteer';
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
test.before(async () => {
	server = await createDefaultServer();
	browser = await captureWebsite._startBrowser();

	instance = (url, options) => captureWebsite.buffer(url, {
		...options,
		_browser: browser,
		_keepAlive: true
	});
});

test.after(async () => {
	await browser.close();
	await server.close();
});

test('capture screenshot - from url', async t => {
	t.true(isPng(await instance(server.url, {
		width: 100,
		height: 100
	})));
});

test('capture screenshot - from local file', async t => {
	t.true(isPng(await instance('fixtures/local-file.html', {
		width: 100,
		height: 100
	})));
});

test('capture screenshot - from file URL', async t => {
	t.true(isPng(await instance(fileUrl('fixtures/local-file.html'), {
		width: 100,
		height: 100
	})));
});

test('capture screenshot - from data URL', async t => {
	t.true(isPng(await instance('data:text/html,<h1>Awesome!</h1>', {
		width: 100,
		height: 100
	})));
});

test('capture screenshot - from HTML content', async t => {
	t.true(isPng(await instance('<h1>Awesome!</h1>', {
		inputType: 'html',
		width: 100,
		height: 100
	})));
});

test('captureWebsite.file()', async t => {
	const filePath = tempy.file();

	await captureWebsite.file(server.url, filePath, {
		width: 100,
		height: 100
	});

	t.true(isPng(fs.readFileSync(filePath)));
});

test('captureWebsite.base64()', async t => {
	const screenshot = await captureWebsite.base64(server.url, {
		width: 100,
		height: 100
	});

	t.is(typeof screenshot, 'string');
	t.true(isPng(Buffer.from(screenshot, 'base64')));
});

test('`type` option', async t => {
	t.true(isJpg(await instance(server.url, {
		width: 100,
		height: 100,
		type: 'jpeg'
	})));
});

test('`scaleFactor` option', async t => {
	const sizeOption = 100;
	const scaleFactor = 4;
	const expectedSize = sizeOption * scaleFactor;

	const size = imageSize(await instance(server.url, {
		width: sizeOption,
		height: sizeOption,
		scaleFactor
	}));

	t.is(size.width, expectedSize);
	t.is(size.height, expectedSize);
});

test('`emulateDevice` option', async t => {
	const device = puppeteer.devices['iPhone X'];

	const size = imageSize(await instance(server.url, {
		emulateDevice: device.name
	}));

	const {viewport} = device;
	t.is(size.width, viewport.width * viewport.deviceScaleFactor);
	t.is(size.height, viewport.height * viewport.deviceScaleFactor);
});

test('`fullPage` option', async t => {
	const size = imageSize(await instance(server.url, {
		width: 100,
		height: 200,
		scaleFactor: 1,
		fullPage: true
	}));

	t.is(size.width, 100);
	t.true(size.height > 100);
});

test('`fullPage` option - lazy loading', async t => {
	const server = await createTestServer();
	const imageCount = 50;

	server.get('/', async (request, response) => {
		response.end(`
			<body>
				<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));">
					${[...Array.from({length: imageCount}).keys()].map(image => `<img src="https://picsum.photos/150/150?random=${image}" loading="lazy">`).join('')}
				</div>
			</body>
		`);
	});

	const size = imageSize(await instance(server.url, {
		width: 200,
		height: 300,
		scaleFactor: 1,
		fullPage: true
	}));

	t.is(size.width, 200);
	t.true(size.height > 150);
});

test('`timeout` option', async t => {
	const server = await createTestServer();

	server.get('/', async (request, response) => {
		await delay(5000);
		response.end();
	});

	await t.throwsAsync(instance(server.url, {
		width: 100,
		height: 100,
		timeout: 1
	}), {message: /1000 ms exceeded/});

	await server.close();
});

test('`element` option - capture DOM element', async t => {
	const size = imageSize(await instance(server.url, {
		width: 400,
		height: 400,
		scaleFactor: 1,
		element: 'div'
	}));

	t.is(size.width, 100);
	t.is(size.height, 100);
});

test('`element` option - wait for DOM element', async t => {
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

	const size = imageSize(await instance(server.url, {
		width: 400,
		height: 400,
		scaleFactor: 1,
		element: 'div'
	}));

	t.is(size.width, 100);
	t.is(size.height, 100);

	await server.close();
});

test('`hideElements` option', async t => {
	const pixels = await getPngPixels(await instance(server.url, {
		width: 100,
		height: 100,
		hideElements: [
			'div'
		]
	}));

	t.is(pixels[0], 255);
});

test('`removeElements` option', async t => {
	const pixels = await getPngPixels(await instance(server.url, {
		width: 100,
		height: 100,
		removeElements: [
			'div'
		]
	}));

	t.is(pixels[0], 255);
});

test('`clickElement` option', async t => {
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
		clickElement: 'div'
	}));

	t.is(pixels[0], 255);
	t.is(pixels[1], 0);
	t.is(pixels[2], 0);

	await server.close();
});

test('`scrollToElement` option as string', async t => {
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
		scrollToElement: '#black'
	}));

	t.is(pixels[0], 0);
	t.is(pixels[1], 0);
	t.is(pixels[2], 0);

	await server.close();
});

test('`scrollToElement` option as object', async t => {
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
			offset: 100
		}
	}));

	t.is(pixels[0], 0);
	t.is(pixels[1], 0);
	t.is(pixels[2], 0);

	await server.close();
});

test('`disableAnimations` option', async t => {
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
		disableAnimations: true
	}));

	t.is(pixels[0], 0);
	t.is(pixels[1], 0);
	t.is(pixels[2], 0);

	await server.close();
});

test('`isJavaScriptEnabled: false` option', async t => {
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
		isJavaScriptEnabled: false
	}));

	t.is(pixels[0], 0);
	t.is(pixels[1], 0);
	t.is(pixels[2], 0);

	await server.close();
});

test('`isJavaScriptEnabled: false` works with the `scripts` option', async t => {
	const pixels = await getPngPixels(await instance(server.url, {
		width: 100,
		height: 100,
		isJavaScriptEnabled: false,
		scripts: [
			'document.querySelector(\'div\').style.backgroundColor = \'red\';'
		]
	}));

	t.is(pixels[0], 255);
	t.is(pixels[1], 0);
	t.is(pixels[2], 0);
});

test('`isJavaScriptEnabled: false` works with the `modules` option', async t => {
	const pixels = await getPngPixels(await instance(server.url, {
		width: 100,
		height: 100,
		isJavaScriptEnabled: false,
		modules: [
			'document.querySelector(\'div\').style.backgroundColor = \'red\';'
		]
	}));

	t.is(pixels[0], 255);
	t.is(pixels[1], 0);
	t.is(pixels[2], 0);
});

test('`modules` option - inline', async t => {
	const pixels = await getPngPixels(await instance(server.url, {
		width: 100,
		height: 100,
		modules: [
			'document.querySelector(\'div\').style.backgroundColor = \'red\';'
		]
	}));

	t.is(pixels[0], 255);
	t.is(pixels[1], 0);
	t.is(pixels[2], 0);
});

test('`modules` option - file', async t => {
	const pixels = await getPngPixels(await instance(server.url, {
		width: 100,
		height: 100,
		modules: [
			'fixtures/script.js'
		]
	}));

	t.is(pixels[0], 255);
	t.is(pixels[1], 0);
	t.is(pixels[2], 0);
});

test('`modules` option - url', async t => {
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
			`${server.url}/module.js`
		]
	}));

	t.is(pixels[0], 255);
	t.is(pixels[1], 0);
	t.is(pixels[2], 0);
});

test('`scripts` option - inline', async t => {
	const pixels = await getPngPixels(await instance(server.url, {
		width: 100,
		height: 100,
		scripts: [
			'document.querySelector(\'div\').style.backgroundColor = \'red\';'
		]
	}));

	t.is(pixels[0], 255);
	t.is(pixels[1], 0);
	t.is(pixels[2], 0);
});

test('`scripts` option - file', async t => {
	const pixels = await getPngPixels(await instance(server.url, {
		width: 100,
		height: 100,
		scripts: [
			'fixtures/script.js'
		]
	}));

	t.is(pixels[0], 255);
	t.is(pixels[1], 0);
	t.is(pixels[2], 0);
});

test('`scripts` option - url', async t => {
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
			`${server.url}/script.js`
		]
	}));

	t.is(pixels[0], 255);
	t.is(pixels[1], 0);
	t.is(pixels[2], 0);
});

test('`styles` option - inline', async t => {
	const pixels = await getPngPixels(await instance(server.url, {
		width: 100,
		height: 100,
		styles: [
			'div { background-color: red !important; }'
		]
	}));

	t.is(pixels[0], 255);
	t.is(pixels[1], 0);
	t.is(pixels[2], 0);
});

test('`styles` option - file', async t => {
	const pixels = await getPngPixels(await instance(server.url, {
		width: 100,
		height: 100,
		styles: [
			'fixtures/style.css'
		]
	}));

	t.is(pixels[0], 255);
	t.is(pixels[1], 0);
	t.is(pixels[2], 0);
});

test('`styles` option - url', async t => {
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
			`${server.url}/style.css`
		]
	}));

	t.is(pixels[0], 255);
	t.is(pixels[1], 0);
	t.is(pixels[2], 0);
});

test('`headers` option', async t => {
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
			fixture
		}
	});

	t.is(headers.fixture, fixture);

	await server.close();
});

test('`cookies` option', async t => {
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
				domain: 'localhost'
			}
		]
	}));

	t.is(pixels[0], 0);

	const pixels2 = await getPngPixels(await instance(server.url, {
		width: 100,
		height: 100,
		cookies: [
			'color=black'
		]
	}));

	t.is(pixels2[0], 0);

	await server.close();
});

test('`authentication` option', async t => {
	const authentication = {
		username: 'foo',
		password: 'bar'
	};

	const url = `https://httpbin.org/basic-auth/${authentication.username}/${authentication.password}`;

	t.true(isPng(await instance(url, {
		authentication
	})));
});

test('`overwrite` option', async t => {
	const filePath = tempy.file();

	await t.notThrowsAsync(async () => {
		await captureWebsite.file(server.url, filePath, {
			width: 100,
			height: 100
		});

		await captureWebsite.file(server.url, filePath, {
			width: 100,
			height: 100,
			overwrite: true
		});
	});
});

test('handle redirects', async t => {
	const server = await createTestServer();

	server.get('/', (request, response) => {
		response.end(defaultResponse);
	});

	server.get('/redirect', (request, response) => {
		response.redirect(server.url);
	});

	const pixels = await getPngPixels(await instance(`${server.url}/redirect`, {
		width: 100,
		height: 100
	}));

	t.is(pixels[0], 0);

	await server.close();
});

test('`darkMode` option', async t => {
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
		height: 100
	}));

	t.is(pixels[0], 255);
	t.is(pixels[1], 255);
	t.is(pixels[2], 255);

	const pixels2 = await getPngPixels(await instance(server.url, {
		width: 100,
		height: 100,
		darkMode: true
	}));

	t.is(pixels2[0], 0);
	t.is(pixels2[1], 0);
	t.is(pixels2[2], 0);

	await server.close();
});

test('`inset` option', async t => {
	const viewportOptions = {
		scaleFactor: 1,
		width: 100,
		height: 100
	};
	// The `inset` and `fullPage` options are exclusive.
	// See: https://github.com/puppeteer/puppeteer/blob/e45acce928429d0d1572e16943307a73ebd38d8a/src/common/Page.ts#L1620
	// In such cases, the `inset` option should be ignored.
	const withFullPageOption = await getPngPixels(await instance(server.url, {
		...viewportOptions,
		fullPage: true,
		inset: 10
	}));
	// First pixel should be black. Image should have resolution 100x100.
	t.is(withFullPageOption[0], 0);
	t.is(withFullPageOption[1], 0);
	t.is(withFullPageOption[2], 0);
	t.true(withFullPageOption.length / 4 === 100 * 100);

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
		inset: 10
	}));
	// First pixel should be red. Image should have resolution 80*520.
	t.is(withElementOption[0], 255);
	t.is(withElementOption[1], 0);
	t.is(withElementOption[2], 0);
	t.true(withElementOption.length / 4 === 80 * 520);

	const viewportPixels = await getPngPixels(await instance(fixture, {
		...viewportOptions,
		inset: 10
	}));

	// First pixel should be red. Image should have resolution 80x80.
	t.is(viewportPixels[0], 255);
	t.is(viewportPixels[1], 0);
	t.is(viewportPixels[2], 0);
	t.true(viewportPixels.length / 4 === 80 * 80);

	const withTopInset = await getPngPixels(await instance(fixture, {
		...viewportOptions,
		inset: {top: 30, left: 10}
	}));

	// First pixel should be white. The image resolution should be 90x70.
	t.is(withTopInset[0], 255);
	t.is(withTopInset[1], 255);
	t.is(withTopInset[2], 255);
	t.true(withTopInset.length / 4 === 90 * 70);

	const withNegativeInset = await getPngPixels(await instance(fixture, {
		...viewportOptions,
		element: '.header',
		inset: -10
	}));

	// First pixel should be black. The image resolution should be 100x40.
	t.is(withNegativeInset[0], 0);
	t.is(withNegativeInset[1], 0);
	t.is(withNegativeInset[2], 0);
	t.true(withNegativeInset.length / 4 === 100 * 40);

	// Should throw if `inset` width or height values are 0.
	await t.throwsAsync(async () => {
		await instance(fixture, {
			...viewportOptions,
			inset: 50
		});
	});
});

test('`preloadFunction` option', async t => {
	const server = await createTestServer();

	server.get('/', async (request, response) => {
		response.end(`
			<body style="margin: 0;">
				<div style="background-color: black; width: 100px; height: 100px;"></div>
				<script>
					window.toRed();
				</script>
			</body>
		`);
	});

	const pixels = await getPngPixels(await instance(server.url, {
		width: 100,
		height: 100,
		preloadFunction: () => {
			window.toRed = () => {
				document.querySelector('div').style.backgroundColor = 'red';
			};
		}
	}));

	t.is(pixels[0], 255);
	t.is(pixels[1], 0);
	t.is(pixels[2], 0);

	await server.close();
});
