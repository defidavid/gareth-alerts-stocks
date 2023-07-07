"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logEvent = void 0;
const twilio_1 = __importDefault(require("twilio"));
const functions = __importStar(require("firebase-functions"));
const withRetry_1 = require("./withRetry");
const client = (0, twilio_1.default)(functions.config().twilio.account_sid, functions.config().twilio.auth_token);
const sendSMSAlert = async (message, level) => {
    const msg = `
${level}

${message}
  `;
    await (0, withRetry_1.withRetry)(async () => {
        const res = await client.messages.create({
            body: msg,
            to: functions.config().twilio.to_phone_number,
            from: functions.config().twilio.from_phone_number,
        });
        if (res.errorMessage)
            throw new Error(res.errorMessage);
    });
};
const logEvent = async (message, level) => {
    if (level === "ERROR") {
        console.error(message);
    }
    else if (level === "WARN") {
        console.warn(message);
    }
    else if (level === "INFO") {
        console.log(message);
    }
    try {
        await sendSMSAlert(message, level);
        // eslint-disable-next-line no-empty
    }
    catch (e) {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        console.log(e.message);
    }
};
exports.logEvent = logEvent;
//# sourceMappingURL=twillio.js.map