"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listAccounts = void 0;
const coinbase_pro_node_1 = require("coinbase-pro-node");
const auth = {
    apiKey: "d009a2cf6d341de5322ef6469fb2c3af",
    apiSecret: "ThxkJUFitCjMWnZ1JWyJZN/Zri7hG5lylVOvzT+w9d2xk7FyIeoZMHdcA1KLy3eqWg8Un1Tc/8LRnatww7DAHQ==",
    passphrase: "xl77fley2mq",
    useSandbox: false,
};
const client = new coinbase_pro_node_1.CoinbasePro(auth);
const listAccounts = () => {
    console.log("asdasdfasdfasdf");
    client.rest.account
        .listAccounts()
        .then(accounts => {
        // const message = `You can trade "${accounts.length}" different pairs.`;
        console.log(accounts);
    })
        .catch(e => {
        console.log(e);
    });
};
exports.listAccounts = listAccounts;
//# sourceMappingURL=makeCoinbaseTrade.js.map