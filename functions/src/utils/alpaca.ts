import { EnterAction, ExitAction, TradeAction } from "./openai";
import { logEvent } from "./twillio";
import * as functions from "firebase-functions";
import { withRetry } from "./withRetry";
import { truncateDecimals } from "./numbers";
import { AlpacaClient, Asset, Order, PlaceOrder } from "@master-chief/alpaca";
import {
  THEORETICAL_PORTFOLIO_SIZE,
  PRICE_WIGGLE_ROOM_PERCENT,
  MAX_PURCHASE_AMOUNT,
  IS_PAPER_TRADING,
  EXIT_BLACK_LIST,
} from "../config";

const client = new AlpacaClient({
  credentials: {
    key: IS_PAPER_TRADING ? functions.config().alpaca.paper_key_id : functions.config().alpaca.key_id,
    secret: IS_PAPER_TRADING ? functions.config().alpaca.paper_secret_key : functions.config().alpaca.secret_key,
    paper: IS_PAPER_TRADING,
  },
  rate_limit: true,
});

const listAllAssets = async (): Promise<Asset[]> => {
  try {
    return await withRetry(async () => {
      return await client.getAssets({ status: "active", asset_class: "us_equity" });
    });
  } catch (e: any) {
    throw new Error(`getAssets failed: ${e.message || ""}`);
  }
};

const getAssetPrice = async (symbol: string) => {
  try {
    const latestTrade = await withRetry(async () => {
      return client.getLatestTrade({ symbol });
    });
    return latestTrade.trade.p;
  } catch (e: any) {
    throw new Error(`getLatestTrade failed: ${e.message || ""}`);
  }
};

const getAsset = async (symbol: string) => {
  try {
    const asset = await withRetry(async () => {
      return client.getAsset({ asset_id_or_symbol: symbol });
    });
    return asset;
  } catch (e: any) {
    throw new Error(`getAsset failed: ${e.message || ""}`);
  }
};

const getPosition = async (symbol: string) => {
  try {
    const position = await withRetry(async () => {
      return await client.getPosition({ symbol });
    });
    return position.qty;
  } catch (e: any) {
    console.log(e);
    throw new Error(`getPosition failed: ${e.message || ""}`);
  }
};

const placeOrder = async (newOrder: PlaceOrder) => {
  try {
    return withRetry(async () => {
      return await client.placeOrder({ ...newOrder, extended_hours: false });
    });
  } catch (e: any) {
    throw new Error(`placeOrder failed: ${e.message || ""}`);
  }
};

const getAvailableCash = () => {
  try {
    return withRetry(async () => {
      const account = await client.getAccount();
      return account.cash;
    });
  } catch (e: any) {
    throw new Error(`getAvailableCash failed: ${e.message || ""}`);
  }
};

const getCompletedOrder = async (orderId: string): Promise<Order | undefined> => {
  const MAX_ATTEMPTS = 10;
  const INTERVAL_MS = 5000;
  let attempts = 0;

  while (attempts < MAX_ATTEMPTS) {
    try {
      const order = await client.getOrder({ order_id: orderId });

      if (order.status === "filled") {
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
  // logEvent("Processing long entry", "INFO");

  const allAssets = await listAllAssets();
  const toAsset = allAssets.find(ass => ass.symbol === tradeAction.toAsset);
  if (toAsset) {
    const currentPrice = await getAssetPrice(tradeAction.toAsset);
    const targetPrice = tradeAction.enterPrice;

    if (currentPrice <= targetPrice * (1 + PRICE_WIGGLE_ROOM_PERCENT)) {
      const originalPurchaseAmount = THEORETICAL_PORTFOLIO_SIZE * tradeAction.percentOfPortfolio;

      const totalFundsAvailable = await getAvailableCash();

      let adjustedPurchaseAmount = parseFloat(truncateDecimals(`${originalPurchaseAmount}`, 2));
      if (originalPurchaseAmount > totalFundsAvailable) {
        adjustedPurchaseAmount = totalFundsAvailable;
      }
      if (adjustedPurchaseAmount) {
        if (adjustedPurchaseAmount > MAX_PURCHASE_AMOUNT) {
          adjustedPurchaseAmount = MAX_PURCHASE_AMOUNT;
        }

        // Get asset details to check if it's fractionable
        const assetDetails = await getAsset(tradeAction.toAsset);

        let newOrder: PlaceOrder;
        if (assetDetails.fractionable) {
          newOrder = {
            symbol: tradeAction.toAsset,
            side: "buy",
            type: "market",
            notional: adjustedPurchaseAmount,
            time_in_force: "day",
          };
        } else {
          const quantity = Math.floor(adjustedPurchaseAmount / currentPrice);
          newOrder = {
            symbol: tradeAction.toAsset,
            side: "buy",
            type: "market",
            qty: quantity,
            time_in_force: "day",
          };
        }

        const order = await placeOrder(newOrder);

        const completedOrder = await getCompletedOrder(order.id);

        /* eslint-disable indent */
        logEvent(
          `${completedOrder ? "Long entry success." : "Long entry pending"}
asset: ${tradeAction.toAsset}
originalPurchaseAmount: $${originalPurchaseAmount}
actualPurchaseAmount: $${completedOrder ? completedOrder.filled_avg_price * completedOrder.filled_qty : ""}
MAX_PURCHASE_AMOUNT: $${MAX_PURCHASE_AMOUNT}
currentPrice: $${currentPrice}
targetPrice: $${targetPrice}
purchasePrice: $${completedOrder ? completedOrder.filled_avg_price : ""}
spread: ${completedOrder ? (completedOrder.filled_avg_price / targetPrice - 1) * 100 : ""}%
`,
          "INFO",
        );
        /* eslint-enable indent */
      } else {
        /* eslint-disable indent */
        logEvent(
          `No more funds available :(
originalPurchaseAmount: ${originalPurchaseAmount}
adjustedPurchaseAmount: ${adjustedPurchaseAmount}
totalFundsAvailable: ${totalFundsAvailable}
            `,
          "ERROR",
        );
        /* eslint-enable indent */
      }
    } else {
      logEvent(`Long entry price out of range. currentPrice: ${currentPrice}, targetPrice: ${targetPrice}`, "ERROR");
    }
  } else {
    if (!toAsset) {
      logEvent(`Could not find toAsset: ${toAsset}`, "ERROR");
    }
  }
};

const processExitLong = async (tradeAction: ExitAction) => {
  // logEvent("Processing long exit", "INFO");

  if (EXIT_BLACK_LIST.includes(tradeAction.fromAsset)) {
    logEvent(`${tradeAction.fromAsset} is on the exit blacklist: ${EXIT_BLACK_LIST.join(",")}`, "WARN");
    return;
  }

  const totalAssetsOnBalanceSheet = await getPosition(tradeAction.fromAsset);
  if (totalAssetsOnBalanceSheet <= 0) {
    logEvent(`Balance for ${tradeAction.fromAsset} is 0`, "ERROR");
  } else {
    const assetDetails = await getAsset(tradeAction.fromAsset);
    const percentageToSell = tradeAction.percentageOfPosition || 1;
    const totalToBeSold = assetDetails.fractionable
      ? totalAssetsOnBalanceSheet * percentageToSell
      : Math.floor(totalAssetsOnBalanceSheet * percentageToSell);
    const qty = totalToBeSold > 0 ? totalToBeSold : totalAssetsOnBalanceSheet;

    const order = await placeOrder({
      symbol: tradeAction.fromAsset,
      side: "sell",
      type: "market",
      qty,
      time_in_force: "day",
    });

    const completedOrder = await getCompletedOrder(order.id);

    const targetPrice = tradeAction.exitPrice;

    const targetPercentGain = tradeAction.percentGain;
    let actualPercentGain;
    let avgSellPrice;
    let totalSold;
    let actualGain;
    if (completedOrder) {
      avgSellPrice = completedOrder.filled_avg_price;
      totalSold = completedOrder.filled_qty * completedOrder.filled_avg_price;

      if (targetPrice && targetPercentGain) {
        actualPercentGain = (avgSellPrice * (1 + targetPercentGain)) / targetPrice - 1;
        actualGain = totalSold - totalSold / (1 + actualPercentGain);
      }
    }

    /* eslint-disable indent */
    logEvent(
      `${completedOrder ? "Long exit success." : "Long exit pending"}
sellAmount: ${qty} ${tradeAction.fromAsset}
totalAssetsOnBalanceSheet: ${totalAssetsOnBalanceSheet} ${tradeAction.fromAsset}
targetPrice: $${targetPrice}
avgSellPrice: $${avgSellPrice}
targetPercentGain: ${targetPercentGain}
actualPercentGain: ${actualPercentGain}
totalSold: $${totalSold}
actualGain: $${actualGain}
spread: ${avgSellPrice && targetPrice ? (avgSellPrice / targetPrice - 1) * 100 : ""}%
`,
      "INFO",
    );
    /* eslint-enable indent */
  }
};

const processEnterShort = async (tradeAction: EnterAction) => {
  // logEvent("Processing short entry", "INFO");

  const allAssets = await listAllAssets();
  const toAsset = allAssets.find(ass => ass.symbol === tradeAction.toAsset);
  if (toAsset) {
    const currentPrice = await getAssetPrice(tradeAction.toAsset);
    const targetPrice = tradeAction.enterPrice;

    if (currentPrice >= targetPrice * (1 - PRICE_WIGGLE_ROOM_PERCENT)) {
      const originalPurchaseAmount = THEORETICAL_PORTFOLIO_SIZE * tradeAction.percentOfPortfolio;
      const totalFundsAvailable = await getAvailableCash();

      let adjustedPurchaseAmount = parseFloat(truncateDecimals(`${originalPurchaseAmount}`, 2));
      if (originalPurchaseAmount > totalFundsAvailable) {
        adjustedPurchaseAmount = totalFundsAvailable;
      }
      if (adjustedPurchaseAmount) {
        if (adjustedPurchaseAmount > MAX_PURCHASE_AMOUNT) {
          adjustedPurchaseAmount = MAX_PURCHASE_AMOUNT;
        }

        const shortedShares = Math.floor(adjustedPurchaseAmount / currentPrice);
        if (shortedShares > 0) {
          const order = await placeOrder({
            symbol: tradeAction.toAsset,
            side: "sell",
            type: "market",
            qty: shortedShares,
            time_in_force: "day",
          });

          const completedOrder = await getCompletedOrder(order.id);

          const actualPurchaseAmount = completedOrder ? shortedShares * completedOrder.filled_avg_price : "";

          /* eslint-disable indent */
          logEvent(
            `${completedOrder ? "Short entry success." : "Short entry pending"}
asset: ${tradeAction.toAsset}
originalPurchaseAmount: ${originalPurchaseAmount}
adjustedPurchaseAmount: ${adjustedPurchaseAmount}
actualPurchaseAmount: ${actualPurchaseAmount}
MAX_PURCHASE_AMOUNT: ${MAX_PURCHASE_AMOUNT}
shortedShares: ${shortedShares}
currentPrice: ${currentPrice}
targetPrice: ${targetPrice}
purchasePrice: ${completedOrder ? completedOrder.filled_avg_price : ""}
spread: ${completedOrder ? (completedOrder.filled_avg_price / targetPrice - 1) * 100 : ""}%
`,
            "INFO",
          );
          /* eslint-enable indent */
        } else {
          logEvent("No enough funds to short a single share :(", "ERROR");
        }
      } else {
        /* eslint-disable indent */
        logEvent(
          `No more funds available :(
originalPurchaseAmount: ${originalPurchaseAmount}
adjustedPurchaseAmount: ${adjustedPurchaseAmount}
totalFundsAvailable: ${totalFundsAvailable}
                    `,
          "ERROR",
        );
        /* eslint-enable indent */
      }
    } else {
      logEvent(`Short entry price out of range. currentPrice: ${currentPrice}, targetPrice: ${targetPrice}`, "ERROR");
    }
  }
};

const processExitShort = async (tradeAction: ExitAction) => {
  // logEvent("Processing short exit", "INFO");

  if (EXIT_BLACK_LIST.includes(tradeAction.fromAsset)) {
    logEvent(`${tradeAction.fromAsset} is on the exit blacklist: ${EXIT_BLACK_LIST.join(",")}`, "WARN");
    return;
  }

  const totalAssetsOnBalanceSheet = await getPosition(tradeAction.fromAsset);
  if (totalAssetsOnBalanceSheet >= 0) {
    logEvent(`Balance for ${tradeAction.fromAsset} is 0 or positive, indicating no short position`, "ERROR");
  } else {
    const percentageToSell = tradeAction.percentageOfPosition || 1;
    const totalToBeSold = Math.floor(totalAssetsOnBalanceSheet * percentageToSell);
    const totalAssetsOnBalanceSheetForSell = Math.floor(totalAssetsOnBalanceSheet);
    const qty = Math.abs(totalToBeSold || totalAssetsOnBalanceSheetForSell);

    const order = await placeOrder({
      symbol: tradeAction.fromAsset,
      side: "buy",
      type: "market",
      // absolute value to convert the negative quantity to positive
      qty,
      time_in_force: "day",
    });

    const completedOrder = await getCompletedOrder(order.id);

    const targetPrice = tradeAction.exitPrice;
    const targetPercentGain = tradeAction.percentGain;
    let actualPercentGain;
    let avgPrice;
    let totalExited;
    let actualGain;
    if (completedOrder) {
      avgPrice = completedOrder.filled_avg_price;
      totalExited = completedOrder.filled_qty * completedOrder.filled_avg_price;

      if (targetPrice && targetPercentGain) {
        actualPercentGain = (targetPrice * (1 + targetPercentGain)) / avgPrice - 1;
        actualGain =
          avgPrice * completedOrder.filled_qty - avgPrice * (1 - actualPercentGain) * completedOrder.filled_qty;
      }
    }

    /* eslint-disable indent */
    logEvent(
      `${completedOrder ? "Short exit success." : "Short exit pending"}
exitAmount: ${qty} ${tradeAction.fromAsset}
totalAssetsOnBalanceSheet: ${totalAssetsOnBalanceSheetForSell} ${tradeAction.fromAsset}
targetPrice: $${targetPrice}
avgPrice: $${avgPrice}
targetPercentGain: ${targetPercentGain}
actualPercentGain: ${actualPercentGain}
totalExited: $${totalExited}
actualGain: $${actualGain}
spread: ${avgPrice && targetPrice ? (avgPrice / targetPrice - 1) * 100 : ""}%
`,
      "INFO",
    );
    /* eslint-enable indent */
  }
};

export const cancelOrder = async (orderId: string): Promise<void> => {
  try {
    await withRetry(async () => {
      await client.cancelOrder({ order_id: orderId });
    });
    logEvent(`Order with ID ${orderId} has been successfully canceled.`, "INFO");
  } catch (e: any) {
    logEvent(`Failed to cancel order with ID ${orderId}. Error: ${e.message || ""}`, "ERROR");
  }
};

export const processTradeAction = async (tradeAction: TradeAction) => {
  try {
    if (tradeAction.type === "EnterLong") {
      await processEnterLong(tradeAction);
    } else if (tradeAction.type === "ExitLong") {
      await processExitLong(tradeAction);
    } else if (tradeAction.type === "EnterShort") {
      await processEnterShort(tradeAction);
    } else if (tradeAction.type === "ExitShort") {
      await processExitShort(tradeAction);
    } else {
      logEvent("TradeAction not supported", "WARN");
    }
  } catch (e: any) {
    console.log("Error processing trade action", e);
    logEvent(e.message, "ERROR");
  }
};
