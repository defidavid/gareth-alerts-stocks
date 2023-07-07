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
// The Firebase Function
exports.processZapierEmailWebhook = functions.https.onRequest((req, res) => {
    // Basic Auth
    const credentials = (0, basic_auth_1.default)(req);
    console.log(req);
    // We will use these as credentials for our HTTP auth.
    const username = "sillyquilly"; // Replace with your username
    const password = "*ge2GVfoTA@8XRZ2WqhN"; // Replace with your password
    if (!credentials || credentials.name !== username || credentials.pass !== password) {
        res.status(401).send("Access denied.");
        return;
    }
    if (req.method !== "POST") {
        res.status(405).send("Method Not Allowed");
        return;
    }
    // Check if request body contains necessary data
    const data = req.body;
    if (!data.messageId || !data.body) {
        res.status(400).send("Invalid request. Missing messageId or body");
        return;
    }
    // Now you can process data.messageId and data.body
    res.status(200).send("Webhook processed");
});
//# sourceMappingURL=processZapierEmailWebhook.js.map