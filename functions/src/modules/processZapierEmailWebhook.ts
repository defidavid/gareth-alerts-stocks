import * as functions from "firebase-functions";
import auth from "basic-auth";
import { TradeAction, TradeActions, sendOpenAIRequest } from "../utils/openai";
import { processTradeAction } from "../utils/alpaca";
import { logEvent } from "../utils/twillio";
import { ENTRIES_DISABLED } from "../config";
import { AccessDenied, ChatGPTNoResponse, InvalidRequest, NonParsableContent } from "../utils/error";

const USERNAME = functions.config().auth.name;
const PASSWORD = functions.config().auth.pass;

interface ZapierWebhook {
  messageId: string;
  body: string;
}

const parseMessage = async (res: functions.Response, message: string) => {
  const MAX_ATTEMPTS = 5;
  let parsedResp: TradeAction[] = [];

  for (let tries = 0; tries < MAX_ATTEMPTS; ++tries) {
    const gptResp = await sendOpenAIRequest(message);
    if (!gptResp) {
      if (tries === MAX_ATTEMPTS - 1) {
        res.status(500).send("ChatGPT did not respond");
        throw new ChatGPTNoResponse(message);
      }
      continue;
    }

    let jsonResp;
    try {
      jsonResp = JSON.parse(gptResp);
    } catch (e) {
      if (tries === MAX_ATTEMPTS - 1) {
        res.status(500).send("ChatGPT response is not valid JSON");
        throw new NonParsableContent(gptResp);
      }
      continue;
    }

    try {
      parsedResp = TradeActions.parse(jsonResp);
      if (parsedResp.length) {
        return parsedResp;
      }
    } catch (e) {
      if (tries === MAX_ATTEMPTS - 1) {
        res.status(500).send("ChatGPT response is not parsable to TradeActions");
        throw new NonParsableContent(JSON.stringify(jsonResp));
      }
    }
  }

  return parsedResp;
};

// The Firebase Function
export const processZapierEmailWebhook = functions.https.onRequest(async (req, res) => {
  try {
    // Basic Auth
    const credentials = auth(req);

    if (!credentials || credentials.name !== USERNAME || credentials.pass !== PASSWORD) {
      res.status(401).send("Access denied.");
      throw new AccessDenied();
    }

    if (req.method !== "POST") {
      res.status(405).send("Method Not Allowed");
      return;
    }

    const data: ZapierWebhook = req.body;
    if (!data.messageId || !data.body) {
      res.status(400).send("Invalid request. Missing messageId or body");
      throw new InvalidRequest(data.messageId, data.body);
    }

    logEvent(`Processing message: ${data.body}`, "INFO");

    const parsedResp = await parseMessage(res, data.body);

    if (parsedResp.length) {
      const filtered = parsedResp.filter(resp => {
        if (ENTRIES_DISABLED && (resp.type === "EnterLong" || resp.type === "EnterShort")) {
          return false;
        }
        return true;
      });
      await Promise.allSettled(filtered.map(ta => processTradeAction(ta)));
      const diff = parsedResp.length - filtered.length;
      if (diff) {
        logEvent(`Entries are disabled at this time. ${diff} amount of entries were skipped`, "WARN");
      }
    } else {
      res.status(422).send("ChatGPT did not respond with a TradeAction");
      logEvent("Message was not actionable", "INFO");
      return;
    }

    res.status(200).send("Webhook processed");
  } catch (e: any) {
    logEvent(e.message, "ERROR");
  }
});
