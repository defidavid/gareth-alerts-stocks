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
      model: "gpt-3.5-turbo-16k",
      messages: [{ role: "user", content: constructPrompt(body) }],
    });
  });
  return resp.data.choices[0].message?.content;
};

const constructPrompt = (body: string) => {
  /* eslint-disable max-len */
  return `Parse the email alert content and convert it into a JSON object of type TradeAction[]. Return ONLY the JSON output WITHOUT ANY SURROUNDING COMMENTARY OR TEXT. DO NOT return anything other than TradeAction[]. If you cannot parse the message, return an empty array. Use these types:

  EnterAction = {
    type: "EnterShort" | "EnterLong";
    percentOfPortfolio: number;
    enterPrice: number;
    fromAsset: string;
    toAsset: string;
  };
  ExitAction = {
    type: "ExitShort" | "ExitLong";
    exitPrice: number | null;
    percentGain: number;
    fromAsset: string;
    toAsset: string;
  };
  TradeAction = EnterAction | ExitAction;
  
  Please parse each alert based on these principles:
  * The word "Buy" or "Add to" indicates EnterLong.
  * The word "Sell" or "Exit" indicates ExitLong.
  * The word "Short" indicates EnterShort. The asset/currency pair following this word should be split with the base currency as fromAsset and quote currency as toAsset.
  * The word "Cover” indicates ExitShort.
  
  
  Please note the following guidelines for parsing the email alert:
  * Percentages should be represented as decimals. For example, when parsing the string "-0.07%", it should translate to the number, -0.0007.
  * For all EnterLong and EnterShort trades, the fromAsset is USD and the toAsset is the asset being purchased or shorted
  * For all ExitLong and ExitShort trades, the fromAsset is the asset being sold or covered and the toAsset is USD
  
  Email Alert: "${body}"`;
};
