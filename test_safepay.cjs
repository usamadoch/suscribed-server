require("dotenv").config({ path: "c:/Users/d/Documents/suscribed/server/.env" });
const Safepay = require("@sfpy/node-core");

const safepay = Safepay(process.env.SAFEPAY_SECRET_KEY, {
    authType: "secret",
    host: "https://sandbox.api.getsafepay.com",
});

const url = safepay.checkout.createCheckoutUrl({
    env: "sandbox",
    tracker: "track_123",
    tbt: "tbt_456",
    source: "hosted",
    redirect_url: "http://localhost:3000/success",
    cancel_url: "http://localhost:3000/cancel",
});

console.log("SDK Generated URL:", url);
