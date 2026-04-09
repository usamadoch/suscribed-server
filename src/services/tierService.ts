import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { createSafepayPlan } = require('./safepayService.js');

export class TierService {
    /**
     * Create both monthly and yearly Safepay plans for a tier
     */
    static async createSafepayPlans(name: string, price: number): Promise<{ safepayPlanId: string, safepayYearlyPlanId: string }> {
        // Create Safepay plans (Monthly)
        const safepayResponse = await createSafepayPlan(name, price, 'MONTH', 1);
        const safepayPlanId = safepayResponse?.data?.plan_id || safepayResponse?.token;

        if (!safepayPlanId) {
            throw new Error(`Monthly Safepay plan creation failed: ${JSON.stringify(safepayResponse)}`);
        }

        // Create Safepay plans (Yearly)
        const safepayYearlyResponse = await createSafepayPlan(`${name} (Yearly)`, price * 12, 'YEAR', 1);
        const safepayYearlyPlanId = safepayYearlyResponse?.data?.plan_id || safepayYearlyResponse?.token;

        if (!safepayYearlyPlanId) {
            // Ideally we'd want to cleanup the monthly plan here if we were being very strict, 
            // but Safepay doesn't always have a delete API easily accessible/standardized in this snippet.
            throw new Error(`Yearly Safepay plan creation failed: ${JSON.stringify(safepayYearlyResponse)}`);
        }

        return { safepayPlanId, safepayYearlyPlanId };
    }
}
