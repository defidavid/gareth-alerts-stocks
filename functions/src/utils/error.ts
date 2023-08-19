/* eslint-disable require-jsdoc */
export class AccessDenied extends Error {
  constructor() {
    super("Access denied");
    this.name = "AccessDenied";
  }
}

export class InvalidRequest extends Error {
  constructor(messageId: string, content: string) {
    super(`Invalid request; messageId: ${messageId}, body: ${content}`);
    this.name = "InvalidRequest";
  }
}

export class ChatGPTNoResponse extends Error {
  constructor(content: string) {
    super(`ChatGPT did not respond from this content: ${content}`);
    this.name = "ChatGPTNoResponse";
  }
}

export class NonParsableContent extends Error {
  constructor(content: string) {
    super(`ChatGPT did not respond with JSON.parseable content: ${content}`);
    this.name = "ChatGPTNoResponse";
  }
}

export class InvalidParsedContent extends Error {
  constructor(content: string) {
    super(`ChatGPT did not return TradeActions: ${content}`);
    this.name = "InvalidParsedContent";
  }
}

export class NonActionableContent extends Error {
  constructor(content: string) {
    super(`Content was not actionable: ${content}`);
    this.name = "NonActionableContent";
  }
}
