module.exports = class ValidationError extends Error {
	constructor(message, inputValue) {
		super();
		this.name = 'ValidationError';
		this.message = message;
		this.inputValue = inputValue;
		Error.captureStackTrace(this, ValidationError);
	}
};
