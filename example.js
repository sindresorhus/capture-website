'use strict';
const captureWebsite = require('.');

// Run this file with `$ node example.js`

(async () => {
	await captureWebsite.file('https://sindresorhus.com', 'example.png');
})();