import twilio from "twilio";
import * as functions from "firebase-functions";
import { withRetry } from "./withRetry";

const client = twilio(functions.config().twilio.account_sid, functions.config().twilio.auth_token);

type LogLevel = "ERROR" | "INFO" | "WARN";

const sendSMSAlert = async (message: string, level: LogLevel) => {
  const msg = `
STOCKS - ${level}

${message}
  `;
  await withRetry(async () => {
    const res = await client.messages.create({
      body: msg,
      to: functions.config().twilio.to_phone_number,
      from: functions.config().twilio.from_phone_number,
    });
    if (res.errorMessage) throw new Error(res.errorMessage);
  });
};

export const logEvent = async (message: string, level: LogLevel) => {
  if (level === "ERROR") {
    console.error(message);
  } else if (level === "WARN") {
    console.warn(message);
  } else if (level === "INFO") {
    console.log(message);
  }

  try {
    await sendSMSAlert(message, level);
    // eslint-disable-next-line no-empty
  } catch (e) {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    console.error(e.message);
  }
};
