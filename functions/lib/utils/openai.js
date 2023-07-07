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
exports.sendOpenAIRequest = exports.TradeActions = exports.TradeAction = void 0;
const openai_1 = require("openai");
const zod_1 = __importDefault(require("zod"));
const functions = __importStar(require("firebase-functions"));
const withRetry_1 = require("./withRetry");
const EnterActionType = zod_1.default.union([zod_1.default.literal("EnterShort"), zod_1.default.literal("EnterLong")]);
const ExitActionType = zod_1.default.union([zod_1.default.literal("ExitShort"), zod_1.default.literal("ExitLong")]);
// const TradeActionType = z.union([EnterActionType, ExitActionType]);
const EnterAction = zod_1.default.object({
    type: EnterActionType,
    percentOfPortfolio: zod_1.default.number(),
    enterPrice: zod_1.default.number(),
    fromAsset: zod_1.default.string(),
    toAsset: zod_1.default.string(),
});
const ExitAction = zod_1.default.object({
    type: ExitActionType,
    exitPrice: zod_1.default.number(),
    percentGain: zod_1.default.number(),
    fromAsset: zod_1.default.string(),
    toAsset: zod_1.default.string(),
});
exports.TradeAction = zod_1.default.union([EnterAction, ExitAction]);
exports.TradeActions = zod_1.default.array(exports.TradeAction);
const configuration = new openai_1.Configuration({
    apiKey: functions.config().openai.api_key,
});
const openai = new openai_1.OpenAIApi(configuration);
const sendOpenAIRequest = async (body) => {
    var _a;
    const resp = await (0, withRetry_1.withRetry)(async () => {
        return await openai.createChatCompletion({
            model: "gpt-4",
            messages: [{ role: "user", content: `${prompt} ${body}` }],
        });
    });
    return (_a = resp.data.choices[0].message) === null || _a === void 0 ? void 0 : _a.content;
};
exports.sendOpenAIRequest = sendOpenAIRequest;
/* eslint-disable max-len */
const prompt = `I need you to parse the content of an email alert and output an object of type TradeAction. The output should be in the form of JSON with the type specified as TradeAction[]. If you are unable to parse the messages into the expected format, just respond with an empty array. Your output should be ONLY JSON.  DO NOT OFFER ANY OTHER EXPLANATION OR TEXT OTHER THAN THE JSON OUTPUT -- THIS IS VERY IMPORTANT. Here are the types:

type EnterActionType = "EnterShort" | "EnterLong";
type ExitActionType = "ExitShort" | "ExitLong";
type TradeActionType = ExitActionType | EnterActionType;
type EnterAction = {
  type: EnterActionType;
  percentOfPortfolio: number;
  enterPrice: number;
  fromAsset: string;
  toAsset: string;
};
type ExitAction = {
  type: ExitActionType;
  exitPrice: number;
  percentGain: number;
  fromAsset: string;
  toAsset: string;
};
type TradeAction = EnterAction | ExitAction;


Please parse each alert based on these principles:
* Buy or Add actions: The word "Buy" or "Add to" indicates a purchase or long entry, unless followed by the word "short", which indicates adding to a short position.
* Sell actions: These are indicated by the word "Sell".
Short actions: Indicated by the word "Short". The asset/currency pair following this word should be split with the base currency as fromAsset and quote currency as toAsset.
* Cover actions: These are indicated by the word "Cover” and they translate to ExitShort.


Please note the following guidelines for parsing the email alert:
* Percentages should be represented as decimals
* For all EnterLong and EnterShort trades, the fromAsset is USD and the toAsset is the asset being purchased or shorted
* For all ExitLong and ExitShort trades, the fromAsset is the asset being sold or covered and the toAsset is USD

The email alert content to parse and convert into TradeAction JSON objects are as follows:
`;
//# sourceMappingURL=openai.js.map