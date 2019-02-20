import fs from 'fs';
import test from 'ava';
import imageSize from 'image-size';
import isJpg from 'is-jpg';
import isPng from 'is-png';
import pify from 'pify';
import PNG from 'png-js';
import createTestServer from 'create-test-server';
import devices from 'puppeteer/DeviceDescriptors';
import tempy from 'tempy';
import delay from 'delay';
import toughCookie from 'tough-cookie';
import fileUrl from 'file-url';
import captureWebsite, {_startBrowser} from '.';

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
	browser = await _startBrowser();

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
	const device = devices['iPhone X'];

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
	}), /1000ms exceeded/);

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

test('`cookies` option`', async t => {
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
