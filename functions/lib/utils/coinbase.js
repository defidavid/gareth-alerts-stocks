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
Object.defineProperty(exports, "__esModule", { value: true });
exports.processTradeAction = void 0;
const coinbase_pro_node_1 = require("coinbase-pro-node");
const twillio_1 = require("./twillio");
const functions = __importStar(require("firebase-functions"));
const withRetry_1 = require("./withRetry");
const numbers_1 = require("./numbers");
const theoreticalPortfolioSize = 1000000;
const MAX_PURCHASE_AMOUNT = 20000;
const auth = {
    apiKey: functions.config().coinbase.api_key,
    apiSecret: functions.config().coinbase.api_secret,
    passphrase: functions.config().coinbase.passphrase,
    useSandbox: false,
};
const client = new coinbase_pro_node_1.CoinbasePro(auth);
const listAllAssets = async () => {
    var _a, _b;
    try {
        return await (0, withRetry_1.withRetry)(async () => {
            return await client.rest.account.listAccounts();
        });
    }
    catch (e) {
        throw new Error(`listAccounts failed: ${((_b = (_a = e.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message) || ""}`);
    }
};
const getAssetPrice = async (ticker) => {
    var _a, _b;
    try {
        const productTicker = await (0, withRetry_1.withRetry)(async () => {
            return await client.rest.product.getProductTicker(ticker);
        });
        return parseFloat(productTicker.price);
    }
    catch (e) {
        throw new Error(`getProductTicker failed: ${((_b = (_a = e.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message) || ""}`);
    }
};
const placeOrder = async (newOrder) => {
    var _a, _b;
    try {
        return (0, withRetry_1.withRetry)(async () => {
            return await client.rest.order.placeOrder(newOrder);
        });
    }
    catch (e) {
        throw new Error(`placeOrder failed: ${((_b = (_a = e.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message) || ""}`);
    }
};
const getCompletedOrder = async (orderId) => {
    const MAX_ATTEMPTS = 10;
    const INTERVAL_MS = 5000;
    let attempts = 0;
    while (attempts < MAX_ATTEMPTS) {
        try {
            const order = await client.rest.order.getOrder(orderId);
            if ((order === null || order === void 0 ? void 0 : order.status) === "done") {
                return order;
            }
        }
        finally {
            await new Promise(resolve => setTimeout(resolve, INTERVAL_MS));
            attempts++;
        }
    }
    (0, twillio_1.logEvent)(`getCompletedOrder failed: ${orderId}`, "ERROR");
    return undefined;
};
const processEnterLong = async (tradeAction) => {
    (0, twillio_1.logEvent)(`Processing long entry: ${JSON.stringify(tradeAction)}`, "INFO");
    const allAssets = await listAllAssets();
    const toAsset = allAssets.find(ass => ass.currency === tradeAction.toAsset);
    const fromAsset = allAssets.find(ass => ass.currency === tradeAction.fromAsset);
    if (toAsset && fromAsset) {
        const ticker = `${tradeAction.toAsset}-${tradeAction.fromAsset}`;
        const currentPrice = await getAssetPrice(ticker);
        const targetPrice = tradeAction.enterPrice;
        if (currentPrice <= targetPrice * 1.005) {
            const originalPurchaseAmount = theoreticalPortfolioSize * tradeAction.percentOfPortfolio;
            const totalFundsAvailable = parseFloat((0, numbers_1.truncateDecimals)(fromAsset.available, 2));
            console.log("originalPurchaseAmount", originalPurchaseAmount);
            let adjustedPurchaseAmount = parseFloat((0, numbers_1.truncateDecimals)(`${originalPurchaseAmount}`, 2));
            if (originalPurchaseAmount > totalFundsAvailable) {
                adjustedPurchaseAmount = totalFundsAvailable;
            }
            if (adjustedPurchaseAmount) {
                if (adjustedPurchaseAmount > MAX_PURCHASE_AMOUNT) {
                    adjustedPurchaseAmount = MAX_PURCHASE_AMOUNT;
                }
                console.log("adjustedPurchaseAmount", adjustedPurchaseAmount);
                const order = await placeOrder({
                    product_id: ticker,
                    side: coinbase_pro_node_1.OrderSide.BUY,
                    type: coinbase_pro_node_1.OrderType.MARKET,
                    funds: `${adjustedPurchaseAmount}`,
                });
                const completedOrder = await getCompletedOrder(order.id);
                /* eslint-disable indent */
                (0, twillio_1.logEvent)(`${completedOrder ? "Long entry success." : "Long entry pending"}
asset: ${tradeAction.toAsset}
originalPurchaseAmount: ${originalPurchaseAmount}
adjustedPurchaseAmount: ${adjustedPurchaseAmount}
MAX_PURCHASE_AMOUNT: ${MAX_PURCHASE_AMOUNT}
currentPrice: ${currentPrice}
targetPrice: ${targetPrice}
purchasePrice: ${completedOrder ? parseFloat(completedOrder.executed_value) / parseFloat(completedOrder.filled_size) : ""}
`, "INFO");
                /* eslint-enable indent */
            }
            else {
                (0, twillio_1.logEvent)("No more funds available :(", "ERROR");
            }
        }
        else {
            (0, twillio_1.logEvent)(`Long entry price out of range. currentPrice: ${currentPrice}, targetPrice: ${targetPrice}`, "ERROR");
        }
    }
    else {
        if (!toAsset) {
            (0, twillio_1.logEvent)(`Could not find toAsset: ${toAsset}`, "ERROR");
        }
        if (fromAsset) {
            (0, twillio_1.logEvent)(`Could not find toAsset: ${fromAsset}`, "ERROR");
        }
    }
};
const processExitLong = async (tradeAction) => {
    (0, twillio_1.logEvent)(`Processing long exit: ${JSON.stringify(tradeAction)}`, "INFO");
    const allAssets = await listAllAssets();
    const toAsset = allAssets.find(ass => ass.currency === tradeAction.toAsset);
    const fromAsset = allAssets.find(ass => ass.currency === tradeAction.fromAsset);
    if (toAsset && fromAsset) {
        const totalAssetsOnBalanceSheet = parseFloat(fromAsset.available);
        if (totalAssetsOnBalanceSheet <= 0) {
            (0, twillio_1.logEvent)(`Balance for ${tradeAction.fromAsset} is 0`, "ERROR");
        }
        else {
            const ticker = `${tradeAction.fromAsset}-${tradeAction.toAsset}`;
            const order = await placeOrder({
                product_id: ticker,
                side: coinbase_pro_node_1.OrderSide.SELL,
                type: coinbase_pro_node_1.OrderType.MARKET,
                size: `${totalAssetsOnBalanceSheet}`,
            });
            const completedOrder = await getCompletedOrder(order.id);
            const targetPrice = tradeAction.exitPrice;
            const avgSellPrice = completedOrder
                ? parseFloat(completedOrder.executed_value) / parseFloat(completedOrder.filled_size)
                : undefined;
            const targetPercentGain = tradeAction.percentGain;
            let actualGain;
            if (avgSellPrice) {
                actualGain = (avgSellPrice * (1 + targetPercentGain)) / targetPrice - 1;
            }
            /* eslint-disable indent */
            (0, twillio_1.logEvent)(`${completedOrder ? "Long exit success." : "Long exit pending"}
asset: ${tradeAction.fromAsset}
sellAmount: ${totalAssetsOnBalanceSheet}
targetPrice: ${targetPrice}
avgSellPrice: ${avgSellPrice}
targetPercentGain: ${targetPercentGain}
actualGain: ${actualGain}
`, "INFO");
        }
    }
    else {
        if (!toAsset) {
            (0, twillio_1.logEvent)(`Could not find toAsset: ${toAsset}`, "ERROR");
        }
        if (fromAsset) {
            (0, twillio_1.logEvent)(`Could not find toAsset: ${fromAsset}`, "ERROR");
        }
    }
};
const processTradeAction = async (tradeAction) => {
    try {
        if (tradeAction.type === "EnterLong") {
            await processEnterLong(tradeAction);
        }
        else if (tradeAction.type === "ExitLong") {
            await processExitLong(tradeAction);
        }
        else {
            (0, twillio_1.logEvent)(`TradeAction not supported: ${JSON.stringify(tradeAction)}`, "WARN");
        }
    }
    catch (e) {
        (0, twillio_1.logEvent)(e.message, "ERROR");
    }
};
exports.processTradeAction = processTradeAction;
//# sourceMappingURL=coinbase.js.map