import {expectType} from 'tsd';
import {file, base64, buffer, devices} from '.';

expectType<Promise<void>>(
	file('https://github.com/sindresorhus/capture-website#readme', './page.png', {
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
	base64('https://github.com/sindresorhus/capture-website#readme')
);

expectType<Promise<Buffer>>(
	buffer('https://github.com/sindresorhus/capture-website#readme')
);

expectType<string[]>(devices);
