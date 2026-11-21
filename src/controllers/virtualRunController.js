const mongoose = require('mongoose');
const Event = require('../models/Event');
const VirtualRunParticipant = require('../models/VirtualRunParticipant');
const VirtualRunRewardSettlement = require('../models/VirtualRunRewardSettlement');
const VirtualRunSession = require('../models/VirtualRunSession');
const { settleExpiredVirtualRun } = require('../services/virtualRunSettlement');
const { validateLocationPoint } = require('../utils/virtualRunTracking');

const asyncHandler = (handler) => (req, res) =>
  Promise.resolve(handler(req, res)).catch((error) => {
    console.error('Virtual run request failed:', error);
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    if (error.code === 11000) {
      return res.status(409).json({ message: 'A matching virtual run record already exists.' });
    }
    return res.status(500).json({ message: 'Virtual run request failed.' });
  });

const isObjectId = (value) => mongoose.isValidObjectId(value);

const serializeSession = (session) => ({
  id: session._id,
  status: session.status,
  startedAt: session.startedAt,
  pauseStartedAt: session.pauseStartedAt,
  totalPausedMs: session.totalPausedMs,
  distanceKm: session.totalDistanceKm,
  lastSequence: session.lastSequence,
  acceptedPointCount: session.acceptedPointCount,
  filteredPointCount: session.filteredPointCount,
  targetReachedAt: session.targetReachedAt,
  targetReachedAccuracyMeters: session.targetReachedAccuracyMeters,
  targetReachedPausedMs: session.targetReachedPausedMs
});

const findVirtualEvent = (id) => Event.findOne({ _id: id, eventType: 'virtualRun' });

const eventIsInProgress = (event, now = new Date()) =>
  event.publicationStatus !== 'draft' &&
  event.startDate <= now &&
  event.endDate >= now;

const slugify = (value) =>
  String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const validateEventInput = (body, existing = null) => {
  const title = String(body.title ?? existing?.title ?? '').trim();
  const startDate = new Date(body.startDate ?? existing?.startDate);
  const endDate = new Date(body.endDate ?? existing?.endDate);
  const targetDistanceKm = Number(
    body.targetDistanceKm ?? existing?.targetDistanceKm ?? 5,
  );
  const status = body.status ?? existing?.status ?? 'upcoming';
  const winnerRewardType =
    body.winnerRewardType ?? existing?.winnerRewardType ?? 'manual';
  const winnerRewardValue = Number(
    body.winnerRewardValue ?? existing?.winnerRewardValue ?? 0,
  );
  const winnerRewards = String(
    body.winnerRewards ?? existing?.winnerRewards ?? '',
  ).trim();
  const publicationStatus =
    body.publicationStatus ?? existing?.publicationStatus ?? 'draft';

  if (!title) return { error: 'Event name is required.' };
  if (!Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime()) ||
      endDate <= startDate) {
    return { error: 'A valid event start and end date are required.' };
  }
  if (!Number.isFinite(targetDistanceKm) || targetDistanceKm <= 0 || targetDistanceKm > 1000) {
    return { error: 'Target distance must be between 0 and 1000 KM.' };
  }
  if (
    !Number.isFinite(winnerRewardValue) ||
    winnerRewardValue < 0 ||
    winnerRewardValue > 100000
  ) {
    return { error: 'Winner reward value must be between 0 and 100000.' };
  }
  if (!['upcoming', 'active', 'completed'].includes(status)) {
    return { error: 'Event status must be upcoming, active, or completed.' };
  }
  if (!['voucher', 'discount', 'coins', 'manual'].includes(winnerRewardType)) {
    return { error: 'Choose a supported winner reward type.' };
  }
  if (!['draft', 'published'].includes(publicationStatus)) {
    return { error: 'Publication status must be draft or published.' };
  }
  if (publicationStatus === 'published') {
    if (winnerRewardType === 'manual' && !winnerRewards) {
      return { error: 'Describe the manual winner reward before publishing.' };
    }
    if (winnerRewardType !== 'manual' &&
        (!Number.isFinite(winnerRewardValue) || winnerRewardValue <= 0)) {
      return { error: 'Enter a positive value for the winner reward.' };
    }
    if (winnerRewardType === 'coins' && !Number.isInteger(winnerRewardValue)) {
      return { error: 'Coin rewards must be a whole number.' };
    }
    if (winnerRewardType === 'discount' && winnerRewardValue > 100) {
      return { error: 'Discount rewards cannot exceed 100 percent.' };
    }
  }

  return {
    value: {
      title,
      description: String(body.description ?? existing?.description ?? '').trim(),
      slug: String(body.slug ?? existing?.slug ?? slugify(title)).trim() || slugify(title),
      image: body.image ?? existing?.image ?? '',
      startDate,
      endDate,
      location: 'Virtual',
      price: 0,
      category: 'Virtual Running Challenge',
      websiteUrl: '',
      eventType: 'virtualRun',
      targetDistanceKm,
      participationRules: String(
        body.participationRules ?? existing?.participationRules ?? '',
      ).trim(),
      winnerRewards,
      winnerRewardType,
      winnerRewardValue,
      publicationStatus,
      status
    }
  };
};

exports.getVirtualRuns = asyncHandler(async (req, res) => {
  const now = new Date();
  const query = {
    eventType: 'virtualRun',
    publicationStatus: { $ne: 'draft' }
  };
  const status = req.query.status;
  if (status) {
    if (!['upcoming', 'active', 'completed'].includes(status)) {
      return res.status(400).json({ message: 'Invalid event status.' });
    }
    if (status === 'completed') {
      query.endDate = { $lte: now };
    } else if (status === 'active') {
      query.startDate = { $lte: now };
      query.endDate = { $gt: now };
    } else {
      query.startDate = { $gt: now };
      query.endDate = { $gt: now };
    }
  } else {
    query.endDate = { $gt: now };
  }

  const events = await Event.find(query).sort({ startDate: 1 }).lean();
  return res.json(events.map((event) => ({
    ...event,
    status: event.endDate <= now
      ? 'completed'
      : event.startDate <= now
        ? 'active'
        : 'upcoming'
  })));
});

exports.getVirtualRunDetails = asyncHandler(async (req, res) => {
  if (!isObjectId(req.params.id)) {
    return res.status(400).json({ message: 'Invalid event id.' });
  }
  const event = await findVirtualEvent(req.params.id);
  if (!event || event.publicationStatus === 'draft') {
    return res.status(404).json({ message: 'Virtual running event not found.' });
  }

  const settlement = event.endDate <= new Date()
    ? await settleExpiredVirtualRun(event._id)
    : await VirtualRunRewardSettlement.findOne({ eventId: event._id });
  const participantCount = await VirtualRunParticipant.countDocuments({ eventId: event._id });
  return res.json({
    ...event.toObject(),
    status: event.endDate <= new Date()
      ? 'completed'
      : event.startDate <= new Date()
        ? 'active'
        : 'upcoming',
    participantCount,
    settlement
  });
});

exports.joinVirtualRun = asyncHandler(async (req, res) => {
  if (!isObjectId(req.params.id)) {
    return res.status(400).json({ message: 'Invalid event id.' });
  }
  const event = await findVirtualEvent(req.params.id);
  if (!event) return res.status(404).json({ message: 'Virtual running event not found.' });
  if (event.publicationStatus === 'draft') {
    return res.status(404).json({ message: 'Virtual running event not found.' });
  }
  if (event.endDate < new Date()) {
    return res.status(409).json({ message: 'This virtual running event has ended.' });
  }

  const participant = await VirtualRunParticipant.findOneAndUpdate(
    { eventId: event._id, userId: req.user._id },
    { $setOnInsert: { eventId: event._id, userId: req.user._id, status: 'joined' } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  return res.status(200).json({ success: true, participant });
});

exports.getMyVirtualRun = asyncHandler(async (req, res) => {
  if (!isObjectId(req.params.id)) {
    return res.status(400).json({ message: 'Invalid event id.' });
  }
  const event = await findVirtualEvent(req.params.id);
  if (!event) return res.status(404).json({ message: 'Virtual running event not found.' });

  const participant = await VirtualRunParticipant.findOne({
    eventId: event._id,
    userId: req.user._id
  });
  if (!participant) return res.status(404).json({ message: 'Join this event before tracking a run.' });

  const session = await VirtualRunSession.findOne({
    eventId: event._id,
    userId: req.user._id,
    isActive: true
  });
  return res.json({
    participant: {
      status: participant.status,
      bestDistanceKm: participant.bestDistanceKm,
      bestTimeMs: participant.bestTimeMs,
      bestAccuracyMeters: participant.bestAccuracyMeters,
      completedAt: participant.completedAt,
      winnerRewardIssued: participant.winnerRewardIssued
    },
    session: session ? serializeSession(session) : null
  });
});

exports.getMyVirtualRuns = asyncHandler(async (req, res) => {
  const participants = await VirtualRunParticipant.find({ userId: req.user._id })
    .populate({
      path: 'eventId',
      match: { eventType: 'virtualRun' }
    })
    .sort({ updatedAt: -1 });
  const now = new Date();
  const runs = participants
    .filter((participant) => participant.eventId)
    .map((participant) => {
      const event = participant.eventId.toObject();
      return {
        ...event,
        status: event.endDate <= now
          ? 'completed'
          : event.startDate <= now
            ? 'active'
            : 'upcoming',
        participant: {
          status: participant.status,
          bestDistanceKm: participant.bestDistanceKm,
          bestTimeMs: participant.bestTimeMs,
          bestAccuracyMeters: participant.bestAccuracyMeters,
          completedAt: participant.completedAt,
          winnerRewardIssued: participant.winnerRewardIssued
        }
      };
    });
  return res.json(runs);
});

exports.startVirtualRun = asyncHandler(async (req, res) => {
  if (!isObjectId(req.params.id)) {
    return res.status(400).json({ message: 'Invalid event id.' });
  }
  const event = await findVirtualEvent(req.params.id);
  if (!event) return res.status(404).json({ message: 'Virtual running event not found.' });
  if (event.publicationStatus === 'draft') {
    return res.status(404).json({ message: 'Virtual running event not found.' });
  }
  if (!eventIsInProgress(event)) {
    return res.status(409).json({ message: 'This event is not currently accepting run sessions.' });
  }

  const participant = await VirtualRunParticipant.findOne({
    eventId: event._id,
    userId: req.user._id
  });
  if (!participant) return res.status(403).json({ message: 'Join the event before starting a run.' });

  const mongoSession = await mongoose.startSession();
  let result;
  let created = false;
  try {
    await mongoSession.withTransaction(async () => {
      const existing = await VirtualRunSession.findOne({
        eventId: event._id,
        userId: req.user._id,
        isActive: true
      }).session(mongoSession);
      if (existing) {
        result = serializeSession(existing);
        return;
      }

      const startedAt = new Date();
      const [run] = await VirtualRunSession.create([{
        eventId: event._id,
        userId: req.user._id,
        startedAt,
        trackingResumedAt: startedAt
      }], { session: mongoSession });
      const updatedParticipant = await VirtualRunParticipant.findOneAndUpdate(
        { _id: participant._id, userId: req.user._id },
        {
          $set: {
            status: 'running',
            currentSessionId: run._id
          }
        },
        { new: true, session: mongoSession }
      );
      if (!updatedParticipant) {
        const error = new Error(
          'Event participation changed before the run started.'
        );
        error.statusCode = 409;
        throw error;
      }
      result = serializeSession(run);
      created = true;
    });
  } catch (error) {
    if (error.code !== 11000) throw error;
    const concurrentRun = await VirtualRunSession.findOne({
      eventId: event._id,
      userId: req.user._id,
      isActive: true
    });
    if (!concurrentRun) throw error;
    result = serializeSession(concurrentRun);
  } finally {
    await mongoSession.endSession();
  }
  return res.status(created ? 201 : 200).json({ success: true, session: result });
});

exports.uploadVirtualRunPoints = asyncHandler(async (req, res) => {
  if (!isObjectId(req.params.sessionId)) {
    return res.status(400).json({ message: 'Invalid run session id.' });
  }
  const { points } = req.body;
  if (!Array.isArray(points) || points.length === 0 || points.length > 100) {
    return res.status(400).json({ message: 'Upload between 1 and 100 location points.' });
  }

  const session = await VirtualRunSession.findOne({
    _id: req.params.sessionId,
    userId: req.user._id,
    status: 'running',
    isActive: true
  });
  if (!session) return res.status(409).json({ message: 'Run session is not active.' });
  const event = await findVirtualEvent(session.eventId);
  if (!event || event.publicationStatus === 'draft') {
    return res.status(404).json({ message: 'Virtual running event not found.' });
  }

  let lastSequence = session.lastSequence;
  let lastPoint = session.lastPoint;
  let addedDistanceMeters = 0;
  let acceptedCount = 0;
  let filteredCount = 0;
  let targetReachedAt = session.targetReachedAt;
  let targetReachedAccuracyMeters = session.targetReachedAccuracyMeters;
  let targetReachedSequence = session.targetReachedSequence;
  let targetReachedPausedMs = session.targetReachedPausedMs;
  let totalDistanceKm = session.totalDistanceKm;
  const now = Date.now();
  for (const input of points) {
    const sequence = Number(input?.sequence);
    if (Number.isSafeInteger(sequence) && sequence <= session.lastSequence) {
      continue;
    }
    if (!Number.isSafeInteger(sequence) || sequence <= lastSequence) {
      return res.status(400).json({ message: 'Location sequence numbers must increase.' });
    }
    const validation = validateLocationPoint(input, lastPoint, now);
    if (!validation.valid) return res.status(422).json({ message: validation.reason });
    if (
      validation.point.timestamp.getTime() <
      session.trackingResumedAt.getTime() - 5000
    ) {
      return res.status(422).json({
        message: 'A location point predates the current tracking session.'
      });
    }
    if (validation.point.timestamp > event.endDate) {
      return res.status(422).json({
        message: 'Location points after the event end time cannot qualify.'
      });
    }

    lastSequence = sequence;
    acceptedCount += 1;
    if (validation.filtered) filteredCount += 1;
    addedDistanceMeters += validation.distanceMeters;
    const segmentDistanceMeters = validation.distanceMeters;
    if (validation.updateBaseline) {
      if (
        !targetReachedAt &&
        lastPoint &&
        segmentDistanceMeters > 0 &&
        totalDistanceKm < event.targetDistanceKm &&
        totalDistanceKm + segmentDistanceMeters / 1000 >=
          event.targetDistanceKm
      ) {
        const crossingFraction =
          ((event.targetDistanceKm - totalDistanceKm) * 1000) /
          segmentDistanceMeters;
        const previousTimestamp = new Date(lastPoint.timestamp).getTime();
        const crossingTimestamp =
          previousTimestamp +
          (validation.point.timestamp.getTime() - previousTimestamp) *
            crossingFraction;
        targetReachedAt = new Date(crossingTimestamp);
        targetReachedAccuracyMeters = Math.max(
          lastPoint.accuracy,
          validation.point.accuracy
        );
        targetReachedSequence = sequence;
        targetReachedPausedMs = session.totalPausedMs;
      }
      totalDistanceKm += segmentDistanceMeters / 1000;
      lastPoint = {
        latitude: validation.point.latitude,
        longitude: validation.point.longitude,
        accuracy: validation.point.accuracy,
        timestamp: validation.point.timestamp
      };
    }
  }

  if (lastSequence === session.lastSequence) {
    return res.json({
      success: true,
      duplicateOnly: true,
      distanceKm: session.totalDistanceKm,
      lastSequence: session.lastSequence
    });
  }

  const updated = await VirtualRunSession.findOneAndUpdate(
    {
      _id: session._id,
      status: 'running',
      isActive: true,
      lastSequence: session.lastSequence
    },
    {
      $set: {
        lastSequence,
        lastPoint,
        ...(targetReachedAt
          ? {
              targetReachedAt,
              targetReachedAccuracyMeters,
              targetReachedSequence,
              targetReachedPausedMs
            }
          : {})
      },
      $inc: {
        totalDistanceKm: addedDistanceMeters / 1000,
        acceptedPointCount: acceptedCount,
        filteredPointCount: filteredCount
      }
    },
    { new: true }
  );
  if (!updated) {
    return res.status(409).json({ message: 'Run data changed; reload the active session and retry.' });
  }
  return res.json({
    success: true,
    distanceKm: updated.totalDistanceKm,
    lastSequence: updated.lastSequence,
    acceptedPointCount: updated.acceptedPointCount,
    filteredPointCount: updated.filteredPointCount
  });
});

exports.pauseVirtualRun = asyncHandler(async (req, res) => {
  if (!isObjectId(req.params.sessionId)) {
    return res.status(400).json({ message: 'Invalid run session id.' });
  }
  const session = await VirtualRunSession.findOneAndUpdate(
    { _id: req.params.sessionId, userId: req.user._id, status: 'running', isActive: true },
    { $set: { status: 'paused', pauseStartedAt: new Date(), lastPoint: null } },
    { new: true }
  );
  if (!session) return res.status(409).json({ message: 'Run session cannot be paused.' });
  return res.json({ success: true, session: serializeSession(session) });
});

exports.resumeVirtualRun = asyncHandler(async (req, res) => {
  if (!isObjectId(req.params.sessionId)) {
    return res.status(400).json({ message: 'Invalid run session id.' });
  }
  const session = await VirtualRunSession.findOne({
    _id: req.params.sessionId,
    userId: req.user._id,
    status: 'paused',
    isActive: true
  });
  if (!session) return res.status(409).json({ message: 'Run session cannot be resumed.' });

  const now = new Date();
  const totalPausedMs =
    session.totalPausedMs +
    Math.max(0, now.getTime() - session.pauseStartedAt.getTime());
  const resumed = await VirtualRunSession.findOneAndUpdate(
    {
      _id: session._id,
      userId: req.user._id,
      status: 'paused',
      isActive: true,
      pauseStartedAt: session.pauseStartedAt
    },
    {
      $set: {
        totalPausedMs,
        pauseStartedAt: null,
        trackingResumedAt: now,
        status: 'running'
      },
      $unset: { lastPoint: 1 }
    },
    { new: true }
  );
  if (!resumed) {
    return res.status(409).json({ message: 'Run session changed while resuming.' });
  }
  return res.json({ success: true, session: serializeSession(resumed) });
});

exports.finishVirtualRun = asyncHandler(async (req, res) => {
  if (!isObjectId(req.params.sessionId)) {
    return res.status(400).json({ message: 'Invalid run session id.' });
  }
  const mongoSession = await mongoose.startSession();
  let response;
  try {
    await mongoSession.withTransaction(async () => {
    const session = await VirtualRunSession.findOne({
      _id: req.params.sessionId,
      userId: req.user._id,
      status: 'running',
      isActive: true
    }).session(mongoSession);
    if (!session) {
      const error = new Error('Run session is not active.');
      error.statusCode = 409;
      throw error;
    }
    const event = await findVirtualEvent(session.eventId).session(mongoSession);
    if (!event || event.publicationStatus === 'draft') {
      const error = new Error('Virtual running event not found.');
      error.statusCode = 404;
      throw error;
    }
    if (
      session.totalDistanceKm < event.targetDistanceKm ||
      !session.targetReachedAt
    ) {
      const error = new Error(
        `Complete the full ${event.targetDistanceKm} KM target before finishing.`
      );
      error.statusCode = 409;
      throw error;
    }
    if (session.targetReachedAt > event.endDate) {
      const error = new Error(
        'The target distance must be completed before the event end time.'
      );
      error.statusCode = 409;
      throw error;
    }

    const finishedAt = new Date();
    const elapsedMs = Math.max(
      0,
      session.targetReachedAt.getTime() -
        session.startedAt.getTime() -
        (session.targetReachedPausedMs ?? 0)
    );
    const qualifies =
      elapsedMs > 0 &&
      elapsedMs >= ((event.targetDistanceKm * 1000) / 12) * 1000;
    const finalizedSession = await VirtualRunSession.findOneAndUpdate(
      {
        _id: session._id,
        userId: req.user._id,
        status: 'running',
        isActive: true,
        lastSequence: session.lastSequence
      },
      {
        $set: {
          finishedAt,
          isActive: false,
          status: qualifies ? 'completed' : 'invalid',
          completionTimeMs: qualifies ? elapsedMs : null
        },
        $unset: { lastPoint: 1 }
      },
      { new: true, session: mongoSession }
    );
    if (!finalizedSession) {
      const error = new Error(
        'GPS points changed while finishing. Sync the run and try again.'
      );
      error.statusCode = 409;
      throw error;
    }

    const participant = await VirtualRunParticipant.findOne({
      eventId: event._id,
      userId: req.user._id
    }).session(mongoSession);
    if (participant) {
      participant.currentSessionId = null;
      if (qualifies) {
        const isBest =
          participant.bestTimeMs == null ||
          elapsedMs < participant.bestTimeMs ||
          (elapsedMs === participant.bestTimeMs &&
            session.targetReachedAccuracyMeters <
              (participant.bestAccuracyMeters ?? Number.POSITIVE_INFINITY));
        participant.status = 'completed';
        participant.bestDistanceKm = Math.max(
          participant.bestDistanceKm,
          session.totalDistanceKm
        );
        if (isBest) {
          participant.bestTimeMs = elapsedMs;
          participant.bestAccuracyMeters =
            session.targetReachedAccuracyMeters;
          participant.completedAt = finishedAt;
        }
      } else {
        participant.status =
          participant.bestTimeMs == null ? 'joined' : 'completed';
      }
      await participant.save({ session: mongoSession });
    }

    response = {
      success: true,
      qualified: qualifies,
      status: qualifies ? 'completed' : 'notQualified',
      distanceKm: session.totalDistanceKm,
      targetDistanceKm: event.targetDistanceKm,
      elapsedMs: qualifies ? elapsedMs : null,
      gpsAccuracyMeters: session.targetReachedAccuracyMeters,
      message: qualifies
        ? 'Run completed and submitted for the leaderboard.'
        : 'The recorded run did not meet the minimum valid completion time.'
    };
    });
  } catch (error) {
    if (error.statusCode) {
    return res.status(error.statusCode).json({ message: error.message });
    }
    throw error;
  } finally {
    await mongoSession.endSession();
  }
  return res.json(response);
});

exports.getVirtualRunLeaderboard = asyncHandler(async (req, res) => {
  if (!isObjectId(req.params.id)) {
    return res.status(400).json({ message: 'Invalid event id.' });
  }
  const event = await findVirtualEvent(req.params.id);
  if (!event || event.publicationStatus === 'draft') {
    return res.status(404).json({ message: 'Virtual running event not found.' });
  }
  const now = new Date();
  const settlement = event.endDate <= now
    ? await settleExpiredVirtualRun(event._id)
    : null;
  const participants = await VirtualRunParticipant.find({
    eventId: event._id,
    status: 'completed',
    bestDistanceKm: { $gte: event.targetDistanceKm },
    bestTimeMs: { $ne: null }
  })
    .populate('userId', 'name')
    .sort({
      bestTimeMs: 1,
      bestAccuracyMeters: 1,
      completedAt: 1,
      _id: 1
    });

  const entries = participants.map((participant, index) => ({
    rank: index + 1,
    participantName: participant.userId?.name ?? 'Participant',
    distanceKm: participant.bestDistanceKm,
    completionTimeMs: participant.bestTimeMs,
    gpsAccuracyMeters: participant.bestAccuracyMeters,
    completedAt: participant.completedAt,
    status: 'completed'
  }));
  return res.json({
    isFinal: Boolean(settlement),
    eventEndDate: event.endDate,
    entries,
    settlement
  });
});

exports.adminGetVirtualRuns = asyncHandler(async (_req, res) => {
  const events = await Event.find({ eventType: 'virtualRun' })
    .sort({ startDate: -1 })
    .lean();
  const settlements = await VirtualRunRewardSettlement.find({
    eventId: { $in: events.map((event) => event._id) }
  }).lean();
  const settlementByEvent = new Map(
    settlements.map((settlement) => [String(settlement.eventId), settlement])
  );
  const eventsWithSettlement = events.map((event) => ({
    ...event,
    settlement: settlementByEvent.get(String(event._id)) ?? null
  }));
  return res.json(eventsWithSettlement);
});

exports.adminCreateVirtualRun = asyncHandler(async (req, res) => {
  const validated = validateEventInput(req.body);
  if (validated.error) return res.status(400).json({ message: validated.error });
  const event = await Event.create(validated.value);
  return res.status(201).json(event);
});

exports.adminUpdateVirtualRun = asyncHandler(async (req, res) => {
  if (!isObjectId(req.params.id)) {
    return res.status(400).json({ message: 'Invalid event id.' });
  }
  const event = await findVirtualEvent(req.params.id);
  if (!event) return res.status(404).json({ message: 'Virtual running event not found.' });
  if (event.resultsFinalizedAt) {
    return res.status(409).json({
      message: 'Finalized events cannot be edited.'
    });
  }
  const participantCount = await VirtualRunParticipant.countDocuments({
    eventId: event._id
  });
  if (participantCount > 0) {
    const lockedFields = [
      'targetDistanceKm',
      'startDate',
      'endDate',
      'winnerRewardType',
      'winnerRewardValue',
      'winnerRewards'
    ];
    if (
      lockedFields.some(
        (field) =>
          req.body[field] !== undefined &&
          String(req.body[field]) !== String(event[field])
      ) ||
      req.body.publicationStatus === 'draft'
    ) {
      return res.status(409).json({
        message:
          'Distance, dates, reward terms, and publication cannot change after users join.'
      });
    }
  }
  const validated = validateEventInput(req.body, event);
  if (validated.error) return res.status(400).json({ message: validated.error });
  Object.assign(event, validated.value);
  await event.save();
  return res.json(event);
});

exports.adminFulfillManualReward = asyncHandler(async (req, res) => {
  if (!isObjectId(req.params.id)) {
    return res.status(400).json({ message: 'Invalid event id.' });
  }
  const event = await findVirtualEvent(req.params.id);
  if (!event) {
    return res.status(404).json({ message: 'Virtual running event not found.' });
  }
  if (!event.resultsFinalizedAt) {
    return res.status(409).json({
      message: 'Winner rewards can only be fulfilled after final results.'
    });
  }

  const mongoSession = await mongoose.startSession();
  let fulfilled;
  let alreadyFulfilled = false;
  try {
    await mongoSession.withTransaction(async () => {
      const settlement = await VirtualRunRewardSettlement.findOne({
        eventId: event._id
      }).session(mongoSession);
      if (!settlement || settlement.rewardType !== 'manual') {
        const error = new Error(
          'This event has no pending manual winner reward.'
        );
        error.statusCode = 409;
        throw error;
      }
      if (settlement.status !== 'pending_manual' && settlement.status !== 'issued') {
        const error = new Error(
          'This event has no pending manual winner reward.'
        );
        error.statusCode = 409;
        throw error;
      }
      alreadyFulfilled = settlement.status === 'issued';
      if (!alreadyFulfilled) {
        settlement.status = 'issued';
        settlement.rewardReference = String(req.body?.reference ?? '').trim();
        settlement.fulfilledAt = new Date();
        settlement.fulfilledBy = req.user._id;
        await settlement.save({ session: mongoSession });
      }
      await VirtualRunParticipant.updateOne(
        { _id: settlement.winnerParticipantId },
        { $set: { winnerRewardIssued: true } },
        { session: mongoSession }
      );
      fulfilled = settlement;
    });
  } finally {
    await mongoSession.endSession();
  }
  return res.json({
    success: true,
    alreadyFulfilled,
    settlement: fulfilled
  });
});

exports.adminDeleteVirtualRun = asyncHandler(async (req, res) => {
  if (!isObjectId(req.params.id)) {
    return res.status(400).json({ message: 'Invalid event id.' });
  }
  const event = await findVirtualEvent(req.params.id);
  if (!event) return res.status(404).json({ message: 'Virtual running event not found.' });
  const participantCount = await VirtualRunParticipant.countDocuments({ eventId: event._id });
  const activeRunCount = await VirtualRunSession.countDocuments({
    eventId: event._id,
    isActive: true
  });
  const settlement = await VirtualRunRewardSettlement.exists({
    eventId: event._id
  });
  if (participantCount || activeRunCount || settlement) {
    return res.status(409).json({
      message: 'Events with participants or active runs cannot be deleted. Mark the event completed instead.'
    });
  }
  await event.deleteOne();
  return res.json({ success: true });
});
