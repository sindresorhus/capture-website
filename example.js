import captureWebsite from './index.js';

// Run this file with `$ node example.js`

(async () => {
	await captureWebsite.file('https://sindresorhus.com', 'example.png');
})();
