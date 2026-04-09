
import 'dotenv/config';
import Safepay from "@sfpy/node-core";

async function verify() {
  console.log('--- Safepay Verification Tool ---');
  
  const apiKey = process.env.SAFEPAY_API_KEY;
  const secretKey = process.env.SAFEPAY_SECRET_KEY;
  const env = process.env.NODE_ENV || 'development';
  const host = env === 'production' ? 'https://api.getsafepay.com' : 'https://sandbox.api.getsafepay.com';

  console.log(`Environment: ${env}`);
  console.log(`Host: ${host}`);

  async function testCall(key: string, authType: string) {
    console.log(`\n--- Testing General API with key: ${key.substring(0, 10)}... (${authType}) ---`);
    const safepay = new (Safepay as any)(key, {
      authType: authType,
      host: host
    });

    try {
      const response = await safepay.customers.object.create({
        first_name: "Verification",
        last_name: "Test",
        email: `test-${Date.now()}@example.com`,
        phone_number: "+923331234567",
        country: "PK",
        is_guest: true
      });
      console.log('✅ Success!');
      return true;
    } catch (error: any) {
      console.error('❌ Failed.');
      return false;
    }
  }

  async function testPlans(key: string, authType: string) {
    console.log(`\n--- Testing Plans creation with key: ${key.substring(0, 10)}... ---`);
    const safepay = new (Safepay as any)(key, {
      authType: authType,
      host: host
    });

    // Manually add the plans resource since it's missing in node-core
    const Plans = (Safepay as any).SafepayResource.extend({
      basePath: "/subscriptions",
      create: (Safepay as any).SafepayResource.method({
        method: "POST",
        path: "/v1/plans"
      })
    });
    
    // The service expects it at safepay.client.plans
    if (!safepay.client) safepay.client = {};
    safepay.client.plans = new Plans(safepay);

    try {
      const response = await safepay.client.plans.create({
        payload: {
          amount: "500",
          currency: 'PKR',
          interval: 'MONTH',
          type: 'RECURRING',
          interval_count: 1,
          product: 'Test Plan',
          active: true
        }
      });
      console.log('✅ Success creating plan!');
      console.log('Plan Token:', response.data.token);
      return true;
    } catch (error: any) {
      console.error('❌ Plans creation failed.');
      if (error.response) {
        console.error('Status:', error.response.status);
        console.error('Data:', JSON.stringify(error.response.data, null, 2));
      } else {
        console.error('Error:', error.message);
      }
      return false;
    }
  }

  if (secretKey) {
    await testCall(secretKey, 'secret');
    await testPlans(secretKey, 'secret');
  } else {
    console.error('❌ SAFEPAY_SECRET_KEY not found in .env');
  }
}

verify();
