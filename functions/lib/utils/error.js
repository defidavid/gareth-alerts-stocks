"use strict";
/* eslint-disable require-jsdoc */
class AccessDenied extends Error {
    constructor() {
        super("Access defined");
        this.name = "AccessDenied";
    }
}
class InvalidRequest extends Error {
    constructor(messageId, content) {
        super(`Invalid request; messageId: ${messageId}, body: ${content}`);
        this.name = "InvalidRequest";
    }
}
class ChatGPTNoResponse extends Error {
    constructor(content) {
        super(`ChatGPT did not respond from this content: ${content}`);
        this.name = "ChatGPTNoResponse";
    }
}
class NonParsableContent extends Error {
    constructor(content) {
        super(`ChatGPT did not respond with JSON.parseable content: ${content}`);
        this.name = "ChatGPTNoResponse";
    }
}
class InvalidParsedContent extends Error {
    constructor(content) {
        super(`ChatGPT did not return TradeActions: ${content}`);
        this.name = "InvalidParsedContent";
    }
}
//# sourceMappingURL=error.js.map