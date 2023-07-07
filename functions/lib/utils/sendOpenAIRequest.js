"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendOpenAIRequest = exports.TradeActions = exports.TradeAction = void 0;
const openai_1 = require("openai");
const zod_1 = __importDefault(require("zod"));
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
    fromAsset: zod_1.default.string(),
    toAsset: zod_1.default.string(),
});
exports.TradeAction = zod_1.default.union([EnterAction, ExitAction]);
exports.TradeActions = zod_1.default.array(exports.TradeAction);
// Extract static types
// type EnterActionTypeStatic = z.infer<typeof EnterActionType>;
// type ExitActionTypeStatic = z.infer<typeof ExitActionType>;
// type TradeActionTypeStatic = z.infer<typeof TradeActionType>;
// type EnterActionStatic = z.infer<typeof EnterAction>;
// type ExitActionStatic = z.infer<typeof ExitAction>;
// type TradeActionStatic = z.infer<typeof TradeAction>;
const configuration = new openai_1.Configuration({
    apiKey: "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",
});
const openai = new openai_1.OpenAIApi(configuration);
const sendOpenAIRequest = async (body) => {
    var _a;
    const resp = await openai.createChatCompletion({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: `${prompt} ${body}` }],
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
  fromAsset: string;
  toAsset: string;
};
type TradeAction = EnterAction | ExitAction;

Please note the following guidelines for parsing the email alert:
* Percentages should be represented as decimals.
* For buy actions (EnterLong), the fromAsset field represents the currency you are spending, and the toAsset field represents the asset being purchased.
* For sell actions (ExitLong), the fromAsset field represents the asset being sold, and the toAsset field represents the currency you are getting in return.
* For short actions (EnterShort), the fromAsset field represents the base or collateral currency, and the toAsset field represents the asset being sold short.
* For cover actions (ExitShort), the fromAsset field represents the asset being covered or bought back, and the toAsset field represents the base or collateral currency.
* For exit actions, the entire position will be exited for the toAsset, and therefore the percentOfPortfolio field is not necessary.

Please parse each alert based on these principles:
* Buy or Add actions: The word "Buy" or "Add to" indicates a purchase or long entry, unless followed by the word "short", which indicates adding to a short position. The asset/currency pair following this word should be split with the base currency as fromAsset and quote currency as toAsset.
* Sell actions: These are indicated by the word "Sell". The asset/currency pair following this word should be split with the base currency as fromAsset and the quote currency as toAsset.
Short actions: Indicated by the word "Short". The asset/currency pair following this word should be split with the base currency as fromAsset and quote currency as toAsset.
* Cover actions: These are indicated by the word "Cover". The asset/currency pair following this word should be split with the base currency as fromAsset and quote currency as toAsset.

The email alert content to parse and convert into TradeAction JSON objects are as follows:
`;
//# sourceMappingURL=sendOpenAIRequest.js.map