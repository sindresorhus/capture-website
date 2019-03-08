/// <reference types="puppeteer" />

import {SetCookie, LaunchOptions, Page, Browser} from 'puppeteer';

interface Authentication {
	username: string;
	password?: string;
}

interface BeforeScreenshot {
	(page: Page, browser: Browser): void;
}

interface Options {
	width?: number;
	height?: number;
	type?: 'png' | 'jpeg';
	quality?: number;
	scaleFactor?: number;
	emulateDevice?: string;
	fullPage?: boolean;
	defaultBackground?: boolean;
	timeout?: number;
	delay?: number;
	waitForElement?: string;
	element?: string;
	hideElements?: string[];
	removeElements?: string[];
	clickElement?: string;
	modules?: string[];
	scripts?: string[];
	styles?: string[];
	headers?: Headers;
	userAgent?: string;
	cookies?: (string | SetCookie)[];
	authentication?: Authentication;
	beforeScreenshot?: BeforeScreenshot;
	debug?: boolean;
	launchOptions?: LaunchOptions;
	overwrite?: boolean;
}

export const devices: string[];

export function base64(url: string, options?: Options): Promise<string>;

export function buffer(url: string, options?: Options): Promise<Buffer>;

export function file(
	url: string,
	outputFilePath: string,
	options?: Options
): Promise<void>;
