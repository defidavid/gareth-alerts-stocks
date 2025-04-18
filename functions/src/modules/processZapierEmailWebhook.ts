import * as functions from "firebase-functions";
import auth from "basic-auth";
import { TradeAction, parseMessage } from "../utils/openai";
import { processTradeAction } from "../utils/alpaca";
import { logEvent } from "../utils/twillio";
import { ENTRIES_DISABLED } from "../config";
import {
  AccessDenied,
  ChatGPTNoResponse,
  InvalidParsedContent,
  InvalidRequest,
  NonActionableContent,
  NonParsableContent,
} from "../utils/error";
import { stripURLs } from "../utils/string";

const USERNAME = functions.config().auth.name;
const PASSWORD = functions.config().auth.pass;

interface ZapierWebhook {
  messageId: string;
  body: string;
  subject: string;
}

// The Firebase Function
export const processZapierEmailWebhook = functions
  .runWith({ timeoutSeconds: 540 })
  .https.onRequest(async (req, res) => {
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
      if (!data.messageId || !data.body || !data.subject) {
        res.status(400).send("Invalid request. Missing messageId, subject, or body");
        throw new InvalidRequest(data.messageId, `${data.subject}: ${data.body}`);
      }

      const body = stripURLs(data.body);
      const alert = `${data.subject}: ${body}`;
      // logEvent(`Processing message: ${alert}`, "INFO");

      let parsedResp: TradeAction[] = [];
      try {
        parsedResp = await parseMessage(alert);
      } catch (e) {
        if (!(e instanceof NonActionableContent)) {
          console.error("Error parsing message", e);
          throw e;
        }
      }

      if (parsedResp.length) {
        const filtered = parsedResp.filter(resp => {
          if (ENTRIES_DISABLED && (resp.type === "EnterLong" || resp.type === "EnterShort")) {
            return false;
          }
          return true;
        });
        await Promise.allSettled(
          filtered.map(ta => {
            logEvent(`Processing trade action: ${JSON.stringify(ta, null, 2)}`, "INFO");
            processTradeAction(ta);
          }),
        );
        const diff = parsedResp.length - filtered.length;
        if (diff) {
          logEvent(`Entries are disabled at this time. ${diff} amount of entries were skipped`, "WARN");
        }
      } else {
        res.status(422).send("ChatGPT did not respond with a TradeAction");
        // logEvent("Message was not actionable", "INFO");
        return;
      }

      res.status(200).send("Webhook processed");
    } catch (e: any) {
      if (e instanceof ChatGPTNoResponse) {
        res.status(500).send("ChatGPT did not respond");
      } else if (e instanceof NonParsableContent) {
        res.status(500).send("ChatGPT response is not valid JSON");
      } else if (e instanceof InvalidParsedContent) {
        res.status(500).send("ChatGPT did not return TradeActions");
      } else {
        res.status(500).send("Server error");
      }
      console.error("Unknown error", e);
      logEvent(e.message, "ERROR");
    }
  });
