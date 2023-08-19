import { cancelOrder } from "../utils/alpaca";

const orderId = process.argv[2];

if (!orderId) {
  console.error("Please provide an order ID as an argument.");
  process.exit(1);
}

cancelOrder(orderId)
  .then(() => {
    console.log(`Order with ID ${orderId} has been successfully canceled.`);
    process.exit(0);
  })
  .catch((error: any) => {
    console.error(`Failed to cancel order with ID ${orderId}. Error: ${error.message}`);
    process.exit(1);
  });
