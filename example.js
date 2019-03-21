'use strict';
const captureWebsite = require('.');

// Run this file with `$ node example.js`

(async () => {
	try {
		await captureWebsite.file('https://www.coinbase.com/price/bitcoin', `${(new Date()).getTime()}.png`, {
			fullPage: false,
			delay: 2,
			clip: {
				top: 10,
				left: 100,
				width: 1280,
				height: 300
			}
		});
	} catch (error) {
		console.error(error);
	}
})();
