import { OpenAIApi, Configuration } from "openai";
import z from "zod";
import * as functions from "firebase-functions";
import { withRetry } from "./withRetry";

const EnterActionType = z.union([z.literal("EnterShort"), z.literal("EnterLong")]);
const ExitActionType = z.union([z.literal("ExitShort"), z.literal("ExitLong")]);
// const TradeActionType = z.union([EnterActionType, ExitActionType]);

const EnterAction = z.object({
  type: EnterActionType,
  percentOfPortfolio: z.number(),
  enterPrice: z.number(),
  fromAsset: z.string(),
  toAsset: z.string(),
});

const ExitAction = z.object({
  type: ExitActionType,
  exitPrice: z.union([z.number(), z.null()]),
  percentGain: z.number(),
  fromAsset: z.string(),
  toAsset: z.string(),
});

export const TradeAction = z.union([EnterAction, ExitAction]);
export const TradeActions = z.array(TradeAction);

// Extract static types
// type EnterActionTypeStatic = z.infer<typeof EnterActionType>;
// type ExitActionTypeStatic = z.infer<typeof ExitActionType>;
// type TradeActionTypeStatic = z.infer<typeof TradeActionType>;
export type EnterAction = z.infer<typeof EnterAction>;
export type ExitAction = z.infer<typeof ExitAction>;
export type TradeAction = z.infer<typeof TradeAction>;

const configuration = new Configuration({
  apiKey: functions.config().openai.api_key,
});
const openai = new OpenAIApi(configuration);

export const sendOpenAIRequest = async (body: string) => {
  const resp = await withRetry(async () => {
    return await openai.createChatCompletion({
      // model: "gpt-4",
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: `${prompt} ${body}` }],
    });
  });
  return resp.data.choices[0].message?.content;
};

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
  exitPrice: number | null;
  percentGain: number;
  fromAsset: string;
  toAsset: string;
};
type TradeAction = EnterAction | ExitAction;

IT IS IMPORTANT TO NOTE THAT IF YOU ARE UNABLE RETURN AN OUTPUT THAT SATISFIES THE TYPES DEFINITIONS ABOVE, YOU SHOULD RETURN AN EMPTY ARRAY. For example, enterPrice CANNOT be null. If you come to the conclusion that enterPrice is null, then you should return an empty array.

Please parse each alert based on these principles:
* Buy or Add actions: The word "Buy" or "Add to" indicates a purchase or long entry, unless followed by the word "short", which indicates adding to a short position.
* Sell actions: These are indicated by the word "Sell" or "Exit".
Short actions: Indicated by the word "Short". The asset/currency pair following this word should be split with the base currency as fromAsset and quote currency as toAsset.
* Cover actions: These are indicated by the word "Cover” and they translate to ExitShort.


Please note the following guidelines for parsing the email alert:
* Percentages should be represented as decimals. For example, when parsing the string "-0.07%", it should translate to the number, -0.0007.
* For all EnterLong and EnterShort trades, the fromAsset is USD and the toAsset is the asset being purchased or shorted
* For all ExitLong and ExitShort trades, the fromAsset is the asset being sold or covered and the toAsset is USD

The email alert content to parse and convert into TradeAction JSON objects are as follows:
`;
