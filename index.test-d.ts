import {expectType} from 'tsd';
import captureWebsite, {devices} from './index.js';

expectType<Promise<void>>(
	captureWebsite.file('https://github.com/sindresorhus/capture-website#readme', './page.png', {
		cookies: [
			{
				name: 'id',
				value: 'unicorn',
				expires: Math.round(new Date('2018-10-21').getTime() / 1000)
			}
		]
	})
);

expectType<Promise<string>>(
	captureWebsite.base64('https://github.com/sindresorhus/capture-website#readme')
);

expectType<Promise<Buffer>>(
	captureWebsite.buffer('https://github.com/sindresorhus/capture-website#readme')
);

expectType<string[]>(devices);
