




// safepay.js
const Safepay = require("@sfpy/node-core");

const safepay = Safepay({
  api_key: process.env.SAFEPAY_SECRET_KEY,
  authType: "jwt",
  host: "https://sandbox.api.getsafepay.com",
});


console.log("safepay keys:", Object.keys(safepay));
console.log("safepay.client:", safepay.client);
console.log("safepay.client keys:", Object.keys(safepay.client));



module.exports = { safepay };
