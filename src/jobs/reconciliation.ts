import cron from 'node-cron';
import Subscription from '../models/Subscription.js';
import User from '../models/User.js';
import Tier from '../models/Tier.js';
import Member from '../models/Member.js';
import Transaction from '../models/Transaction.js';
import { logger } from '../config/logger.js';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { getSafepayTrackerStatus } = require('../services/safepayService.js');

export const runReconciliationTask = async () => {
    logger.info('[Reconciliation] Starting cron job for stale subscriptions');
    try {
        // Find subscriptions created over an hour ago but still incomplete
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
            
            const staleSubscriptions = await Subscription.find({
                status: 'incomplete',
                createdAt: { $lt: oneHourAgo }
            });

            if (staleSubscriptions.length === 0) {
                 logger.info('[Reconciliation] No stale subscriptions found');
                 return;
            }

            logger.info(`[Reconciliation] Found ${staleSubscriptions.length} stale subscriptions.`);

            for (const sub of staleSubscriptions) {
                 if (!sub.safepaySubscriptionId) {
                     logger.info(`[Reconciliation] Marking ${sub._id} as canceled because it lacks tracker`);
                     sub.status = 'canceled';
                     await sub.save();
                     continue;
                 }

                 try {
                     const trackerData = await getSafepayTrackerStatus(sub.safepaySubscriptionId);
                     const state = trackerData?.data?.state;
                     
                     logger.info(`[Reconciliation] Tracker ${sub.safepaySubscriptionId} state: ${state}`);

                     // Depending on Safepay's response, we recover or cancel
                     if (state === 'TRACKER_ENDED' || state === 'TRACKER_PAID' || state === 'TRACKER_CAPTURED') {
                          logger.error(`[CRITICAL_RECONCILIATION_ERROR] Recovering paid subscription. SubID: ${sub._id}`);
                          
                          const plan = await Tier.findById(sub.planId);
                          const user = await User.findById(sub.userId);
                          
                          if (!plan || !user) {
                              logger.error(`[Reconciliation] Orphaned subscription lacks user or plan: ${sub._id}`);
                              sub.status = 'canceled';
                              await sub.save();
                              continue;
                          }

                          const nextBillingDate = new Date();
                          if (sub.interval === 'YEARLY') {
                              nextBillingDate.setDate(nextBillingDate.getDate() + 365);
                          } else {
                              nextBillingDate.setDate(nextBillingDate.getDate() + 30);
                          }
                          const priceToCharge = sub.interval === 'YEARLY' ? plan.price * 12 : plan.price;
                          const gross = priceToCharge;
                          const platformFee = Math.round(gross * 0.10);
                          const net = gross - platformFee;
                          const fourteenDaysFromNow = new Date();
                          fourteenDaysFromNow.setDate(fourteenDaysFromNow.getDate() + 14);

                          sub.status = 'active';
                          sub.currentPeriodStart = new Date();
                          sub.currentPeriodEnd = nextBillingDate;

                          await Promise.all([
                              sub.save(),
                              Member.findOneAndUpdate(
                                  { memberId: user._id, creatorId: plan.creatorId },
                                  {
                                      $set: { status: 'active', tier: plan.name },
                                      $setOnInsert: { pageId: plan.pageId }
                                  },
                                  { upsert: true, new: true }
                              ),
                              Transaction.create({
                                  userId: user._id,
                                  creatorId: plan.creatorId,
                                  pageId: plan.pageId,
                                  type: 'subscription',
                                  gross,
                                  platformFee,
                                  net,
                                  status: 'completed',
                                  releaseAt: fourteenDaysFromNow,
                                  description: `Subscription to ${plan.name} (Recovered by CRON)`,
                              }),
                              Tier.findByIdAndUpdate(plan._id, { $inc: { activeSubscribers: 1 } })
                          ]);
                          
                          logger.info(`[Reconciliation] Successfully recovered and activated subscription ${sub._id}`);
                     } else if (state === 'TRACKER_CANCELLED' || state === 'TRACKER_EXPIRED') {
                          sub.status = 'canceled';
                          await sub.save();
                          logger.info(`[Reconciliation] Cancelled stale subscription ${sub._id} based on state: ${state}`);
                     } else {
                          // Tracker might be Started, but it's very old. Cancel after 2 hours.
                          const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
                          // We check against the createdAt date for the sub, it's typed as Date in Mongoose
                          if ((sub as any).createdAt < twoHoursAgo) {
                              sub.status = 'canceled';
                              await sub.save();
                              logger.info(`[Reconciliation] Cancelled overly stale subscription ${sub._id} (age > 2hrs)`);
                          }
                     }
                 } catch (err) {
                      logger.error(`[Reconciliation] Error processing stale sub ${sub._id}:`, err);
                 }
            }
        } catch (err) {
            logger.error('[Reconciliation] Cron failure:', err);
        }
};

export const startReconciliationCron = () => {
    // Run every hour at the top of the hour (e.g. 1:00, 2:00)
    cron.schedule('0 * * * *', () => {
        runReconciliationTask();
    });
};
