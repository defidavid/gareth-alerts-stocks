"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.withRetry = void 0;
const withRetry = async (asyncFn, retryCount = 5, delay = 500) => {
    let error;
    for (let i = 0; i < retryCount; i++) {
        try {
            // Attempt to execute the function
            return await asyncFn();
        }
        catch (e) {
            // If this isn't the last attempt, delay before the next one
            error = e;
            if (i < retryCount - 1) {
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    // If we've reached this point, all retries have failed. Throw an error.
    throw error;
};
exports.withRetry = withRetry;
//# sourceMappingURL=withRetry.js.map