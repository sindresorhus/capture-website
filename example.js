'use strict';
const captureWebsite = require('.');

// Run this file with `$ node example.js`

(async () => {
	await captureWebsite.file('https://sindresorhus.com', 'example.png');

	await captureWebsite.file('https://trello.com', 'example_iphone_x.png', {
		emulateDevice: 'iPhone X'
	});
	await captureWebsite.file('https://trello.com', 'example_iphone_x_with_frame.png', {
		emulateDevice: 'iPhone X',
		deviceFrame: true
	});
	await captureWebsite.file('https://trello.com', 'example_iphone_6_with_frame.png', {
		emulateDevice: 'iPhone 6',
		deviceFrame: true
	});
})();
