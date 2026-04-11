import Safepay from "@sfpy/node-core";

const SAFEPAY_ENV = process.env.SAFEPAY_ENV || "sandbox";
const IS_PROD = SAFEPAY_ENV === "production";
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
const createTracker = async (amount, planId, customerToken, currency = "PKR", options = {}) => {
    const { mode = "instrument", entry_mode = null } = options;
    // console.log(`[Safepay] createTracker: amount=${amount}, customerToken=${customerToken}, mode=${mode}, entry_mode=${entry_mode}`);
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
            mode: mode,
            entry_mode: entry_mode,
            // is_account_verification: mode === "instrument",
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



    console.log("tracker data: ", JSON.stringify(data));
    // v3 response: { data: { tracker: { token: "track_..." } } }
    const tracker = data?.data?.tracker;
    if (!tracker?.token) throw new Error("No tracker token returned: " + text);
    console.log(`[Safepay] createTracker successful for token: ${tracker.token}`);
    return tracker;
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

// ─── Fetch saved payment method from wallet ───────────────────────────────────

const getSavedPaymentMethod = async (customerToken) => {
    const res = await fetch(
        `${HOST}/user/customers/v1/${customerToken}/wallet/?limit=5&page=1`,
        {
            headers: {
                "X-SFPY-MERCHANT-SECRET": process.env.SAFEPAY_SECRET_KEY,
            },
        }
    );
    const data = await res.json();
    // Return the most recently saved payment method token
    const wallet = data?.data?.wallet;
    if (!wallet || wallet.length === 0) return null;
    // Sort by created_at descending, return most recent
    const sorted = wallet.sort(
        (a, b) => b.created_at.seconds - a.created_at.seconds
    );
    return sorted[0]?.token; // pm_xxx
};

// ─── Charge saved card (MIT / unscheduled_cof) ────────────────────────────────

// const chargesavedCard = async (customerToken, paymentMethodToken, amount, currency = "PKR") => {
//     console.log(`[Safepay] Charging saved card: customer=${customerToken}, pm=${paymentMethodToken}, amount=${amount}`);

//     const res = await fetch(`${HOST}/order/payments/v3/`, {
//         method: "POST",
//         headers: {
//             "Content-Type": "application/json",
//             "X-SFPY-MERCHANT-SECRET": process.env.SAFEPAY_SECRET_KEY,
//         },
//         body: JSON.stringify({
//             merchant_api_key: process.env.SAFEPAY_API_KEY,
//             intent: "CYBERSOURCE",
//             user: customerToken,
//             mode: "unscheduled_cof",
//             payment_method: paymentMethodToken, // pm_xxx
//             currency,
//             amount: amount * 100,
//         }),
//     });

//     const text = await res.text();
//     let data;
//     try { data = JSON.parse(text); } catch { throw new Error("Invalid JSON: " + text); }
//     if (!res.ok) throw new Error("Safepay charge error: " + JSON.stringify(data));

//     console.log(`[Safepay] Created Charge Tracker:`, JSON.stringify(data));

//     const trackerToken = data?.data?.tracker?.token;
//     if (!trackerToken) throw new Error("No tracker token returned for charging");

//     // Excecute the authorization action to actually process the charge
//     const actionRes = await fetch(`${HOST}/order/payments/v3/${trackerToken}`, {
//         method: "POST",
//         headers: {
//             "Content-Type": "application/json",
//             "X-SFPY-MERCHANT-SECRET": process.env.SAFEPAY_SECRET_KEY,
//         },
//         body: JSON.stringify({
//             action: "AUTHORIZATION",
//             payment_method: paymentMethodToken
//         }),
//     });

//     const actionText = await actionRes.text();
//     let actionData;
//     try { actionData = JSON.parse(actionText); } catch { throw new Error("Invalid JSON from action: " + actionText); }
//     if (!actionRes.ok) throw new Error("Safepay action error: " + JSON.stringify(actionData));

//     console.log(`[Safepay] Executed Charge Response:`, JSON.stringify(actionData));
//     return actionData;
// };

const chargesavedCard = async (customerToken, paymentMethodToken, amount, currency = "PKR") => {
    console.log(`[Safepay] Charging saved card: customer=${customerToken}, pm=${paymentMethodToken}, amount=${amount}`);

    // Step 1: Create the unscheduled_cof tracker
    const res = await fetch(`${HOST}/order/payments/v3/`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-SFPY-MERCHANT-SECRET": process.env.SAFEPAY_SECRET_KEY,
        },
        body: JSON.stringify({
            merchant_api_key: process.env.SAFEPAY_API_KEY,
            intent: "CYBERSOURCE",
            user: customerToken,
            mode: "unscheduled_cof",
            payment_method: paymentMethodToken,
            currency,
            amount: amount * 100,
        }),
    });

    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { throw new Error("Invalid JSON from tracker create: " + text); }
    if (!res.ok) throw new Error("Safepay create tracker error: " + JSON.stringify(data));

    console.log(`[Safepay] Created Charge Tracker:`, JSON.stringify(data));

    const trackerToken = data?.data?.tracker?.token;
    if (!trackerToken) throw new Error("No tracker token in response");

    // Step 2: Execute AUTHORIZATION — must include payment_method.tms.token in payload
    // entry_mode is "tms" so Safepay requires the token explicitly here too
    const actionRes = await fetch(`${HOST}/order/payments/v3/${trackerToken}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-SFPY-MERCHANT-SECRET": process.env.SAFEPAY_SECRET_KEY,
        },
        body: JSON.stringify({
            payload: {
                payment_method: {
                    tokenized_card: {          // ← changed from tms to tokenized_card
                        token: paymentMethodToken,
                    },
                },
                authorization: {
                    do_capture: true,  // true = auth + capture in one shot
                },
            },
        }),
    });

    const actionText = await actionRes.text();
    let actionData;
    try { actionData = JSON.parse(actionText); } catch { throw new Error("Invalid JSON from action: " + actionText); }
    if (!actionRes.ok) throw new Error("Safepay action error: " + JSON.stringify(actionData));

    console.log(`[Safepay] Executed Charge Response:`, JSON.stringify(actionData));
    return actionData;
};




// ─── Fetch Tracker Status ────────────────────────────────────────────────────────

const getSafepayTrackerStatus = async (trackerToken) => {
    console.log(`[Safepay] Fetching tracker status for: ${trackerToken}`);
    const res = await fetch(`${HOST}/reporter/api/v1/payments/${trackerToken}`, {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
            "X-SFPY-MERCHANT-SECRET": process.env.SAFEPAY_SECRET_KEY,
        },
    });

    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { throw new Error("Invalid JSON from tracker status fetch: " + text); }
    if (!res.ok) throw new Error("Safepay tracker status error: " + JSON.stringify(data));

    return data;
};


export {
    createSafepayPlan,
    getOrCreateSafepayCustomer,
    getSavedPaymentMethod,
    chargesavedCard,
    getSafepayTrackerStatus,
    getAuthToken,
    createTracker
};









