const Safepay = require("@sfpy/node-core");
const { v4: uuidv4 } = require("uuid");

const IS_PROD = process.env.NODE_ENV === "production";
const HOST = IS_PROD
    ? "https://api.getsafepay.com"
    : "https://sandbox.api.getsafepay.com";
const ENV = IS_PROD ? "production" : "sandbox";

// SDK instance — used for passport (tbt) and checkout URL generation
const safepay = Safepay(process.env.SAFEPAY_SECRET_KEY, {
    authType: "secret",
    host: HOST,
});

// ─── Plan ────────────────────────────────────────────────────────────────────

const createSafepayPlan = async (name, amount, interval = "MONTH", interval_count = 1) => {
    const response = await fetch(`${HOST}/client/plans/v1/`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-SFPY-MERCHANT-SECRET": process.env.SAFEPAY_SECRET_KEY,
        },
        body: JSON.stringify({
            amount: amount.toString(),
            currency: "PKR",
            interval,
            type: "RECURRING",
            interval_count,
            product: name,
            active: true,
        }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(`Safepay plan error: ${JSON.stringify(data)}`);
    return data;
};

// ─── Tracker ─────────────────────────────────────────────────────────────────

/**
 * Create a payment tracker (raw fetch — SDK's Tracker.action is for
 * acting on an *existing* tracker token, not creating one).
 */
const createTracker = async (amount, planId, customerToken, currency = "PKR") => {
    console.log(`[Safepay] createTracker: amount=${amount}, planId=${planId}, customerToken=${customerToken}`);
    const res = await fetch(`${HOST}/order/payments/v3/`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-SFPY-MERCHANT-SECRET": process.env.SAFEPAY_SECRET_KEY,
        },
        body: JSON.stringify({
            // client: process.env.SAFEPAY_API_KEY,   // public key (sec_xxx)
            // environment: ENV,
            merchant_api_key: process.env.SAFEPAY_API_KEY,
            intent: "CYBERSOURCE",
            user: customerToken,
            mode: "instrument",

            currency,
            amount: amount * 100,

            // plan_id: planId,
        }),
    });

    const text = await res.text();
    // console.log("[Safepay] createTracker status:", res.status, "body:", text);

    let data;
    try { data = JSON.parse(text); } catch { throw new Error("Invalid JSON from Safepay: " + text); }
    if (!res.ok) throw new Error("Safepay tracker error: " + JSON.stringify(data));

    // v3 response: { data: { tracker: { token: "track_..." } } }
    const token = data?.data?.tracker?.token;
    if (!token) throw new Error("No tracker token returned: " + text);
    console.log(`[Safepay] createTracker successful: token=${token}`);
    return token;
};

// ─── Passport (tbt) ──────────────────────────────────────────────────────────

/**
 * Fetch a passport token (tbt) scoped to our public client key.
 *
 * WHY: Safepay's checkout page uses the tbt to authenticate requests
 * and find the tracker.  If `client` is omitted from the body the tbt
 * is returned unscoped and Safepay cannot associate it with any tracker,
 * producing the "cannot find tracker using keys" error.
 */
const getAuthToken = async () => {
    const response = await safepay.client.passport.create({
        client: process.env.SAFEPAY_API_KEY,
        environment: ENV,
    });

    // const response = safepay.auth.passport.create()

    // console.log("[Safepay] passport response:", JSON.stringify(response));

    // Passport response: { data: "<tbt string>" }  (data is the token itself, not an object)
    const tbt = response?.data;
    if (!tbt || typeof tbt !== "string") throw new Error("No tbt token returned: " + JSON.stringify(response));
    return tbt;
};

// ─── Customer ─────────────────────────────────────────────────────────────────

const getOrCreateSafepayCustomer = async (user) => {
    console.log("existing token:", user.safepayCustomerToken);

    if (user.safepayCustomerToken) {
        console.log(`[Safepay] Using existing customer token: ${user.safepayCustomerToken} for user: ${user.email}`);
        return user.safepayCustomerToken;
    }

    console.log(`[Safepay] Creating new customer for user: ${user.email}`);

    const res = await fetch(`${HOST}/user/customers/v1/`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-SFPY-MERCHANT-SECRET": process.env.SAFEPAY_SECRET_KEY,
        },
        body: JSON.stringify({

            first_name: "David",
            last_name: "Hameed",
            phone_number: "+923000000000",
            email: user.email,

            country: "PK",
            is_guest: false,
        }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error("Safepay customer error: " + JSON.stringify(data));

    const token = data?.data?.token;
    if (!token) throw new Error("No customer token returned: " + JSON.stringify(data));

    user.safepayCustomerToken = token;
    await user.save();

    console.log(`[Safepay] Created new customer token: ${token} for user: ${user.email}`);
    return token;
};

// ─── Checkout URL ─────────────────────────────────────────────────────────────

const generateSubscriptionCheckoutUrl = async (user, planId, amount, redirectUrl, cancelUrl) => {
    console.log(`[Safepay] Generating checkout URL for user: ${user.email}, planId: ${planId}, amount: ${amount}`);
    const customerToken = await getOrCreateSafepayCustomer(user);

    // Run tracker creation & tbt fetch in parallel for speed
    const [tracker, tbt] = await Promise.all([
        createTracker(amount, planId, customerToken),
        getAuthToken()
    ]);

    console.log("[Safepay] tracker token:", tracker);
    console.log("[Safepay] authentication token (tbt):", tbt);

    // Use the SDK's built-in URL builder — it handles environment-specific base URLs automatically
    const checkoutUrl = safepay.checkout.createCheckoutUrl({
        env: ENV,
        tracker,
        tbt,
        source: "custom",
        redirect_url: redirectUrl,
        cancel_url: cancelUrl,
    });

    console.log(`[Safepay] Generated checkout URL: ${checkoutUrl}`);
    return checkoutUrl;
};

module.exports = { createSafepayPlan, generateSubscriptionCheckoutUrl, getOrCreateSafepayCustomer };









