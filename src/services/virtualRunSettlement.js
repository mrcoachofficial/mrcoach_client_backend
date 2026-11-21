const crypto = require('node:crypto');
const mongoose = require('mongoose');
const CoinTransaction = require('../models/CoinTransaction');
const Event = require('../models/Event');
const UserWallet = require('../models/UserWallet');
const VirtualRunParticipant = require('../models/VirtualRunParticipant');
const VirtualRunRewardSettlement = require('../models/VirtualRunRewardSettlement');
const VirtualRunSession = require('../models/VirtualRunSession');
const Voucher = require('../models/Voucher');

const compareParticipants = (first, second) => {
  const timeDifference = first.bestTimeMs - second.bestTimeMs;
  if (timeDifference !== 0) return timeDifference;

  const firstAccuracy = first.bestAccuracyMeters ?? Number.POSITIVE_INFINITY;
  const secondAccuracy = second.bestAccuracyMeters ?? Number.POSITIVE_INFINITY;
  const accuracyDifference = firstAccuracy - secondAccuracy;
  if (accuracyDifference !== 0) return accuracyDifference;

  const finishDifference =
    new Date(first.completedAt).getTime() - new Date(second.completedAt).getTime();
  if (finishDifference !== 0) return finishDifference;
  return String(first._id).localeCompare(String(second._id));
};

const formatSettlement = (settlement) => ({
  status: settlement.status,
  winnerParticipantId: settlement.winnerParticipantId,
  winnerUserId: settlement.winnerUserId,
  winnerName: settlement.winnerName,
  completionTimeMs: settlement.completionTimeMs,
  gpsAccuracyMeters: settlement.gpsAccuracyMeters,
  distanceKm: settlement.distanceKm,
  rewardType: settlement.rewardType,
  rewardValue: settlement.rewardValue,
  rewardDescription: settlement.rewardDescription,
  rewardReference: settlement.rewardReference,
  settledAt: settlement.settledAt
});

const settleExpiredVirtualRun = async (eventId, now = new Date()) => {
  const existingSettlement = await VirtualRunRewardSettlement.findOne({ eventId });
  if (existingSettlement) return formatSettlement(existingSettlement);

  const session = await mongoose.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      const event = await Event.findOne({
        _id: eventId,
        eventType: 'virtualRun',
        publicationStatus: { $ne: 'draft' },
        endDate: { $lte: now }
      }).session(session);
      if (!event) return;

      const existing = await VirtualRunRewardSettlement.findOne({
        eventId: event._id
      }).session(session);
      if (existing) {
        result = formatSettlement(existing);
        return;
      }

      const openSessions = await VirtualRunSession.find({
        eventId: event._id,
        isActive: true
      }).session(session);
      for (const run of openSessions) {
        const reachedInTime =
          run.targetReachedAt &&
          run.targetReachedAt <= event.endDate &&
          run.totalDistanceKm >= event.targetDistanceKm;
        const elapsedMs = reachedInTime
          ? run.targetReachedAt.getTime() -
            run.startedAt.getTime() -
            (run.targetReachedPausedMs ?? 0)
          : 0;
        const qualifies =
          reachedInTime &&
          elapsedMs > 0 &&
          elapsedMs >= ((event.targetDistanceKm * 1000) / 12) * 1000;
        run.status = qualifies ? 'completed' : 'invalid';
        run.isActive = false;
        run.finishedAt = now;
        run.completionTimeMs = qualifies ? elapsedMs : null;
        run.lastPoint = undefined;
        await run.save({ session });

        const participant = await VirtualRunParticipant.findOne({
          eventId: event._id,
          userId: run.userId
        }).session(session);
        if (!participant) continue;
        participant.currentSessionId = null;
        if (qualifies) {
          const isBest =
            participant.bestTimeMs == null ||
            elapsedMs < participant.bestTimeMs ||
            (elapsedMs === participant.bestTimeMs &&
              run.targetReachedAccuracyMeters <
                (participant.bestAccuracyMeters ?? Number.POSITIVE_INFINITY));
          participant.status = 'completed';
          participant.bestDistanceKm = Math.max(
            participant.bestDistanceKm,
            run.totalDistanceKm
          );
          if (isBest) {
            participant.bestTimeMs = elapsedMs;
            participant.bestAccuracyMeters = run.targetReachedAccuracyMeters;
            participant.completedAt = now;
          }
        } else {
          participant.status =
            participant.bestTimeMs == null ? 'joined' : 'completed';
        }
        await participant.save({ session });
      }

      const participants = await VirtualRunParticipant.find({
        eventId: event._id,
        status: 'completed',
        bestDistanceKm: { $gte: event.targetDistanceKm },
        bestTimeMs: { $ne: null }
      })
        .populate('userId', 'name')
        .session(session);
      const eligibleParticipants = participants.filter(
        (participant) => participant.userId
      );
      eligibleParticipants.sort(compareParticipants);
      const winner = eligibleParticipants[0] ?? null;
      const settledAt = now;
      let rewardStatus = 'no_winner';
      let rewardReference = '';
      const hasConfiguredReward =
        event.winnerRewardType !== 'manual' || Boolean(event.winnerRewards);
      if (winner) {
        if (!hasConfiguredReward) {
          rewardStatus = 'no_reward_configured';
        } else if (event.winnerRewardType === 'coins') {
          const coins = Math.floor(event.winnerRewardValue);
          const wallet = await UserWallet.findOneAndUpdate(
            { userId: winner.userId._id },
            {
              $inc: {
                currentCoins: coins,
                lifetimeCoins: coins
              }
            },
            { new: true, upsert: true, setDefaultsOnInsert: true, session }
          );
          await CoinTransaction.create([{
            userId: winner.userId._id,
            type: 'earned',
            coins,
            virtualRunEventId: event._id,
            description: `Winner reward for virtual running challenge: ${event.title}`
          }], { session });
          rewardStatus = 'issued';
          rewardReference = String(wallet._id);
        } else if (
          event.winnerRewardType === 'voucher' ||
          event.winnerRewardType === 'discount'
        ) {
          const voucherCode =
            `VRC-${String(event._id).slice(-6).toUpperCase()}-` +
            crypto.randomBytes(5).toString('hex').toUpperCase();
          const expiryDate = new Date(event.endDate);
          expiryDate.setDate(expiryDate.getDate() + 90);
          await Voucher.create([{
            userId: winner.userId._id,
            sourceEventId: event._id,
            voucherCode,
            amount: event.winnerRewardValue,
            coinsUsed: 0,
            isPercentage: event.winnerRewardType === 'discount',
            expiryDate,
            status: 'active'
          }], { session });
          rewardStatus = 'issued';
          rewardReference = voucherCode;
        } else {
          rewardStatus = 'pending_manual';
        }
      }

      const [settlement] = await VirtualRunRewardSettlement.create([{
        eventId: event._id,
        winnerParticipantId: winner?._id ?? null,
        winnerUserId: winner?.userId?._id ?? null,
        winnerName: winner?.userId?.name ?? '',
        completionTimeMs: winner?.bestTimeMs ?? null,
        gpsAccuracyMeters: winner?.bestAccuracyMeters ?? null,
        distanceKm: winner?.bestDistanceKm ?? null,
        rewardType:
          winner && hasConfiguredReward ? event.winnerRewardType : 'none',
        rewardValue: winner ? event.winnerRewardValue : 0,
        rewardDescription: winner ? event.winnerRewards : '',
        rewardReference,
        status: rewardStatus,
        settledAt
      }], { session });

      if (winner) {
        await VirtualRunParticipant.updateOne(
          { _id: winner._id },
          { $set: { winnerRewardIssued: rewardStatus === 'issued' } },
          { session }
        );
      }
      event.status = 'completed';
      event.resultsFinalizedAt = settledAt;
      await event.save({ session });
      result = formatSettlement(settlement);
    });
  } catch (error) {
    if (error.code !== 11000) throw error;
    const concurrentSettlement = await VirtualRunRewardSettlement.findOne({ eventId });
    if (concurrentSettlement) return formatSettlement(concurrentSettlement);
    throw error;
  } finally {
    await session.endSession();
  }
  return result ?? null;
};

let workerTimer;
let workerRunning = false;

const settleDueVirtualRuns = async () => {
  if (workerRunning) return;
  workerRunning = true;
  try {
    const now = new Date();
    const expiredEvents = await Event.find({
      eventType: 'virtualRun',
      publicationStatus: { $ne: 'draft' },
      endDate: { $lte: now },
      resultsFinalizedAt: null
    }).select('_id');
    for (const event of expiredEvents) {
      try {
        await settleExpiredVirtualRun(event._id, now);
      } catch (error) {
        console.error(`Could not finalize virtual run ${event._id}:`, error);
      }
    }
  } finally {
    workerRunning = false;
  }
};

const startVirtualRunSettlementWorker = () => {
  if (workerTimer) return;
  const runSafely = () => {
    void settleDueVirtualRuns().catch((error) => {
      console.error('Virtual run settlement scan failed:', error);
    });
  };
  runSafely();
  workerTimer = setInterval(runSafely, 60_000);
  workerTimer.unref();
};

module.exports = {
  compareParticipants,
  formatSettlement,
  settleExpiredVirtualRun,
  settleDueVirtualRuns,
  startVirtualRunSettlementWorker
};
