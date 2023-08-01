import * as functions from "firebase-functions";
import auth from "basic-auth";
import { TradeAction, TradeActions, sendOpenAIRequest } from "../utils/openai";
import { processTradeAction } from "../utils/alpaca";
import { logEvent } from "../utils/twillio";

const USERNAME = functions.config().auth.name;
const PASSWORD = functions.config().auth.pass;
const entriesDisabled = functions.config().settings.entries_disabled;

interface ZapierWebhook {
  messageId: string;
  body: string;
}

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

    const gptResp = await sendOpenAIRequest(data.body);
    if (!gptResp) {
      res.status(500).send("ChatGPT did not respond");
      throw new ChatGPTNoResponse(data.body);
    }

    let jsonResp;
    try {
      jsonResp = JSON.parse(gptResp);
    } catch (e) {
      res.status(500).send("ChatGPT did not respond with JSON.parseable content");
      throw new NonParsableContent(gptResp);
    }

    let parsedResp: TradeAction[] = [];
    try {
      parsedResp = TradeActions.parse(jsonResp);
    } catch (e) {
      res.status(500).send("ChatGPT did not return TradeActions");
      throw new NonParsableContent(JSON.stringify(jsonResp));
    }

    if (parsedResp.length) {
      const filtered = parsedResp.filter(resp => {
        if (entriesDisabled && (resp.type === "EnterLong" || resp.type === "EnterShort")) {
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
