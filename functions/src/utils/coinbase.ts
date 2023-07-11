import { CoinbasePro, NewOrder, Order, OrderSide, OrderType } from "coinbase-pro-node";
import { EnterAction, ExitAction, TradeAction } from "./openai";
import { logEvent } from "./twillio";
import * as functions from "firebase-functions";
import { withRetry } from "./withRetry";
import { truncateDecimals } from "./numbers";

const theoreticalPortfolioSize = 1_000_000;
const MAX_PURCHASE_AMOUNT = 20_000;

const auth = {
  apiKey: functions.config().coinbase.api_key,
  apiSecret: functions.config().coinbase.api_secret,
  passphrase: functions.config().coinbase.passphrase,
  useSandbox: false,
};

const client = new CoinbasePro(auth);

const listAllAssets = async () => {
  try {
    return await withRetry(async () => {
      return await client.rest.account.listAccounts();
    });
  } catch (e: any) {
    throw new Error(`listAccounts failed: ${e.response?.data?.message || ""}`);
  }
};

const getAssetPrice = async (ticker: string) => {
  try {
    const productTicker = await withRetry(async () => {
      return await client.rest.product.getProductTicker(ticker);
    });
    return parseFloat(productTicker.price);
  } catch (e: any) {
    throw new Error(`getProductTicker failed: ${e.response?.data?.message || ""}`);
  }
};

const placeOrder = async (newOrder: NewOrder) => {
  try {
    return withRetry(async () => {
      return await client.rest.order.placeOrder(newOrder);
    });
  } catch (e: any) {
    throw new Error(`placeOrder failed: ${e.response?.data?.message || ""}`);
  }
};

const getCompletedOrder = async (orderId: string): Promise<Order | undefined> => {
  const MAX_ATTEMPTS = 10;
  const INTERVAL_MS = 5000;
  let attempts = 0;

  while (attempts < MAX_ATTEMPTS) {
    try {
      const order = await client.rest.order.getOrder(orderId);

      if (order?.status === "done") {
        return order;
      }
    } finally {
      await new Promise(resolve => setTimeout(resolve, INTERVAL_MS));
      attempts++;
    }
  }
  logEvent(`getCompletedOrder failed: ${orderId}`, "ERROR");
  return undefined;
};

const processEnterLong = async (tradeAction: EnterAction) => {
  logEvent(`Processing long entry: ${JSON.stringify(tradeAction)}`, "INFO");

  const allAssets = await listAllAssets();
  const toAsset = allAssets.find(ass => ass.currency === tradeAction.toAsset);
  const fromAsset = allAssets.find(ass => ass.currency === tradeAction.fromAsset);
  if (toAsset && fromAsset) {
    const ticker = `${tradeAction.toAsset}-${tradeAction.fromAsset}`;
    const currentPrice = await getAssetPrice(ticker);
    const targetPrice = tradeAction.enterPrice;

    if (currentPrice <= targetPrice * 1.005) {
      const originalPurchaseAmount = theoreticalPortfolioSize * tradeAction.percentOfPortfolio;
      const totalFundsAvailable = parseFloat(truncateDecimals(fromAsset.available, 2));

      console.log("originalPurchaseAmount", originalPurchaseAmount);

      let adjustedPurchaseAmount = parseFloat(truncateDecimals(`${originalPurchaseAmount}`, 2));
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
          side: OrderSide.BUY,
          type: OrderType.MARKET,
          funds: `${adjustedPurchaseAmount}`,
        });

        const completedOrder = await getCompletedOrder(order.id);

        /* eslint-disable indent */
        logEvent(
          `${completedOrder ? "Long entry success." : "Long entry pending"}
asset: ${tradeAction.toAsset}
originalPurchaseAmount: ${originalPurchaseAmount}
adjustedPurchaseAmount: ${adjustedPurchaseAmount}
MAX_PURCHASE_AMOUNT: ${MAX_PURCHASE_AMOUNT}
currentPrice: ${currentPrice}
targetPrice: ${targetPrice}
purchasePrice: ${
            completedOrder ? parseFloat(completedOrder.executed_value) / parseFloat(completedOrder.filled_size) : ""
          }
`,
          "INFO",
        );
        /* eslint-enable indent */
      } else {
        logEvent("No more funds available :(", "ERROR");
      }
    } else {
      logEvent(`Long entry price out of range. currentPrice: ${currentPrice}, targetPrice: ${targetPrice}`, "ERROR");
    }
  } else {
    if (!toAsset) {
      logEvent(`Could not find toAsset: ${toAsset}`, "ERROR");
    }
    if (fromAsset) {
      logEvent(`Could not find toAsset: ${fromAsset}`, "ERROR");
    }
  }
};

const processExitLong = async (tradeAction: ExitAction) => {
  logEvent(`Processing long exit: ${JSON.stringify(tradeAction)}`, "INFO");

  const allAssets = await listAllAssets();
  const toAsset = allAssets.find(ass => ass.currency === tradeAction.toAsset);
  const fromAsset = allAssets.find(ass => ass.currency === tradeAction.fromAsset);
  if (toAsset && fromAsset) {
    const totalAssetsOnBalanceSheet = parseFloat(fromAsset.available);
    if (totalAssetsOnBalanceSheet <= 0) {
      logEvent(`Balance for ${tradeAction.fromAsset} is 0`, "ERROR");
    } else {
      const ticker = `${tradeAction.fromAsset}-${tradeAction.toAsset}`;
      const order = await placeOrder({
        product_id: ticker,
        side: OrderSide.SELL,
        type: OrderType.MARKET,
        size: `${totalAssetsOnBalanceSheet}`,
      });

      const completedOrder = await getCompletedOrder(order.id);

      const targetPrice = tradeAction.exitPrice;
      const avgSellPrice = completedOrder
        ? parseFloat(completedOrder.executed_value) / parseFloat(completedOrder.filled_size)
        : undefined;

      const targetPercentGain = tradeAction.percentGain;
      let actualGain;
      if (avgSellPrice && targetPrice) {
        actualGain = (avgSellPrice * (1 + targetPercentGain)) / targetPrice - 1;
      }

      /* eslint-disable indent */
      logEvent(
        `${completedOrder ? "Long exit success." : "Long exit pending"}
asset: ${tradeAction.fromAsset}
sellAmount: ${totalAssetsOnBalanceSheet}
targetPrice: ${targetPrice}
avgSellPrice: ${avgSellPrice}
targetPercentGain: ${targetPercentGain}
actualGain: ${actualGain}
`,
        "INFO",
      );
    }
  } else {
    if (!toAsset) {
      logEvent(`Could not find toAsset: ${toAsset}`, "ERROR");
    }
    if (fromAsset) {
      logEvent(`Could not find toAsset: ${fromAsset}`, "ERROR");
    }
  }
};

export const processTradeAction = async (tradeAction: TradeAction) => {
  try {
    if (tradeAction.type === "EnterLong") {
      await processEnterLong(tradeAction);
    } else if (tradeAction.type === "ExitLong") {
      await processExitLong(tradeAction);
    } else {
      logEvent(`TradeAction not supported: ${JSON.stringify(tradeAction)}`, "WARN");
    }
  } catch (e: any) {
    logEvent(e.message, "ERROR");
  }
};
