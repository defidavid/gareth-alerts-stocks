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
exports.processZapierEmailWebhook = void 0;
const functions = __importStar(require("firebase-functions"));
const basic_auth_1 = __importDefault(require("basic-auth"));
const openai_1 = require("../utils/openai");
const coinbase_1 = require("../utils/coinbase");
const twillio_1 = require("../utils/twillio");
const USERNAME = functions.config().auth.name;
const PASSWORD = functions.config().auth.pass;
// The Firebase Function
exports.processZapierEmailWebhook = functions.https.onRequest(async (req, res) => {
    try {
        // Basic Auth
        const credentials = (0, basic_auth_1.default)(req);
        if (!credentials || credentials.name !== USERNAME || credentials.pass !== PASSWORD) {
            res.status(401).send("Access denied.");
            throw new AccessDenied();
        }
        if (req.method !== "POST") {
            res.status(405).send("Method Not Allowed");
            return;
        }
        const data = req.body;
        if (!data.messageId || !data.body) {
            res.status(400).send("Invalid request. Missing messageId or body");
            throw new InvalidRequest(data.messageId, data.body);
        }
        (0, twillio_1.logEvent)(`Processing message: ${data.body}`, "INFO");
        const gptResp = await (0, openai_1.sendOpenAIRequest)(data.body);
        if (!gptResp) {
            res.status(500).send("ChatGPT did not respond");
            throw new ChatGPTNoResponse(data.body);
        }
        let jsonResp;
        try {
            jsonResp = JSON.parse(gptResp);
        }
        catch (e) {
            res.status(500).send("ChatGPT did not respond with JSON.parseable content");
            throw new NonParsableContent(gptResp);
        }
        let parsedResp = [];
        try {
            parsedResp = openai_1.TradeActions.parse(jsonResp);
        }
        catch (e) {
            res.status(500).send("ChatGPT did not return TradeActions");
            throw new NonParsableContent(JSON.stringify(jsonResp));
        }
        if (parsedResp.length) {
            await Promise.all(parsedResp.map(ta => (0, coinbase_1.processTradeAction)(ta)));
        }
        else {
            res.status(422).send("ChatGPT did not respond with a TradeAction");
            (0, twillio_1.logEvent)("Message was not actionable", "INFO");
        }
        res.status(200).send("Webhook processed");
    }
    catch (e) {
        (0, twillio_1.logEvent)(e.message, "ERROR");
    }
});
//# sourceMappingURL=processZapierEmailWebhook.js.map