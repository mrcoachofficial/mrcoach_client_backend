const Event = require('../models/Event');
const EventBooking = require('../models/EventBooking');
const EventSyncLog = require('../models/EventSyncLog');
const User = require('../models/User');
const mongoose = require('mongoose');
const { parseDateOnly } = require('../utils/activityChallenge');

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const isValidEventId = id => mongoose.isValidObjectId(id);

const parseEventCalendarDate = (value, endOfDay = false) => {
  if (value == null || value === '') return null;
  if (typeof value === 'string' && DATE_ONLY_PATTERN.test(value)) {
    return parseDateOnly(value, endOfDay);
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const isEventFull = (participantsCount, maxParticipants) =>
  Number.isFinite(maxParticipants) &&
  maxParticipants > 0 &&
  participantsCount >= maxParticipants;

const ACTIVITY_TYPES = ['walking', 'running', 'cycling'];
const EVENT_TYPES = ['inPerson', 'virtualRun', 'activityChallenge'];
const PUBLICATION_STATUSES = ['draft', 'published'];

// Every public event list hides drafts, cancelled events and virtual runs.
const buildPublicEventFilter = () => ({
  eventType: { $ne: 'virtualRun' },
  status: { $ne: 'cancelled' },
  publicationStatus: { $ne: 'draft' }
});

const normalizeActivityTypes = value => {
  if (value == null) return undefined;
  const source = Array.isArray(value) ? value : [value];
  const types = source
    .map(type => String(type).trim().toLowerCase())
    .filter(type => ACTIVITY_TYPES.includes(type));
  return types.length > 0 ? [...new Set(types)] : undefined;
};

const getParticipantCounts = async events => {
  const eventIds = events
    .map(event => event._id?.toString())
    .filter(Boolean);
  if (eventIds.length === 0) return new Map();

  const counts = await EventBooking.aggregate([
    {
      $match: {
        event_id: { $in: eventIds },
        payment_status: { $regex: /^PAID$/i }
      }
    },
    {
      $group: {
        _id: '$event_id',
        participants: { $sum: { $ifNull: ['$ticket_quantity', 1] } }
      }
    }
  ]);

  return new Map(counts.map(count => [count._id, count.participants]));
};

// Normalises an event document for the mobile client. Older records stored
// `title`/`bannerImage` while newer ones use `name`/`image`, so expose both.
const toPlainEvent = event =>
  typeof event?.toObject === 'function' ? event.toObject() : event;

const serializeEvent = (eventDocument, participantsCount = 0) => {
  const event = toPlainEvent(eventDocument) || {};
  const mergedParticipants =
    (event.participants?.length || 0) + participantsCount;
  return {
    ...event,
    id: event._id?.toString(),
    name: event.name || event.title || '',
    title: event.title || event.name || '',
    startDateTime: event.startDateTime || event.startDate,
    locationName: event.locationName || event.location || '',
    location: event.locationName || event.location || '',
    image: event.image || event.bannerImage || '',
    bannerImage: event.bannerImage || event.image || '',
    targetDistance: event.targetDistance ?? event.targetDistanceKm,
    targetDistanceKm: event.targetDistanceKm ?? event.targetDistance,
    rules: event.rules || event.participationRules || '',
    rewards: event.rewards || event.winnerRewards || '',
    activityStartDate: event.startDate,
    activityEndDate: event.endDate,
    participantsCount: mergedParticipants,
    isFull: isEventFull(mergedParticipants, event.maxParticipants)
  };
};

const buildEventLeaderboard = (participants, targetDistance) =>
  [...participants]
    .filter(
      participant =>
        participant.status === 'completed' &&
        participant.distance >= targetDistance &&
        participant.time != null
    )
    .sort((first, second) => first.time - second.time)
    .map((participant, index) => ({
      rank: index + 1,
      userId: participant.userId?._id ?? participant.userId,
      name: participant.userId?.name ?? 'Participant',
      distance: participant.distance,
      time: participant.time,
      completedAt: participant.completedAt
    }));

const getEvents = async (req, res) => {
  try {
    const status = req.query.status;
    if (!['upcoming', 'active', 'completed'].includes(status)) {
      return res.status(400).json({
        message: 'Status must be upcoming, active, or completed.'
      });
    }

    // Classify by date so the result matches /upcoming and /completed, then
    // narrow to the requested status when it is explicit.
    const isUpcoming = status !== 'completed';
    const query = buildFilterQuery(req, isUpcoming);
    if (status === 'active') {
      const now = new Date();
      query.startDate = { ...(query.startDate || {}), $lte: now };
      query.endDate = { $gt: now };
    }
    const events = await Event.find(query)
      .populate('participants.userId', 'name profileImage')
      .sort({ startDate: status === 'completed' ? -1 : 1 })
      .lean();
    const countByEventId = await getParticipantCounts(events);

    res.json(
      events.map(event =>
        serializeEvent(
          event,
          countByEventId.get(event._id.toString()) || 0
        )
      )
    );
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Helper to construct filter query based on user options
const buildFilterQuery = (req, isUpcoming) => {
  const query = buildPublicEventFilter();
  const now = new Date();

  // 1. Classification: Upcoming vs Completed based on current datetime vs endDate
  if (isUpcoming === true) {
    query.endDate = { $gt: now };
  } else if (isUpcoming === false) {
    query.endDate = { $lte: now };
  }

  // 2. Filter by Date (e.g., YYYY-MM-DD)
  if (req.query.date) {
    const filterDate = new Date(req.query.date);
    const startOfDay = new Date(filterDate.setHours(0, 0, 0, 0));
    const endOfDay = new Date(filterDate.setHours(23, 59, 59, 999));
    query.startDate = { $gte: startOfDay, $lte: endOfDay };
  }

  // 3. Filter by Month and/or Year
  if (req.query.month || req.query.year) {
    const year = req.query.year ? parseInt(req.query.year) : now.getFullYear();
    if (req.query.month) {
      const month = parseInt(req.query.month) - 1; // 0-indexed month
      const start = new Date(year, month, 1);
      const end = new Date(year, month + 1, 0, 23, 59, 59, 999);
      query.startDate = { $gte: start, $lte: end };
    } else {
      const start = new Date(year, 0, 1);
      const end = new Date(year, 11, 31, 23, 59, 59, 999);
      query.startDate = { $gte: start, $lte: end };
    }
  }

  // 4. Filter by Price Range
  if (req.query.minPrice !== undefined || req.query.maxPrice !== undefined) {
    query.price = {};
    if (req.query.minPrice !== undefined && req.query.minPrice !== '') {
      query.price.$gte = parseFloat(req.query.minPrice);
    }
    if (req.query.maxPrice !== undefined && req.query.maxPrice !== '') {
      query.price.$lte = parseFloat(req.query.maxPrice);
    }
  }

  // 5. Filter by Event Category / Type
  if (req.query.category && req.query.category !== '') {
    query.category = { $regex: new RegExp(req.query.category, 'i') };
  }

  return query;
};

// @desc    Get upcoming events
// @route   GET /api/events/upcoming
// @access  Public
const getUpcomingEvents = async (req, res) => {
  try {
    const query = buildFilterQuery(req, true);
    const events = await Event.find(query)
      .populate('participants.userId', 'name profileImage')
      .sort({ startDate: 1 }) // nearest start first
      .lean();
    const countByEventId = await getParticipantCounts(events);
    res.json(
      events.map(event =>
        serializeEvent(event, countByEventId.get(event._id.toString()) || 0)
      )
    );
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get completed events
// @route   GET /api/events/completed
// @access  Public
const getCompletedEvents = async (req, res) => {
  try {
    const query = buildFilterQuery(req, false);
    const events = await Event.find(query)
      .populate('participants.userId', 'name profileImage')
      .sort({ endDate: -1 }) // most recently completed first
      .lean();
    const countByEventId = await getParticipantCounts(events);
    res.json(
      events.map(event =>
        serializeEvent(event, countByEventId.get(event._id.toString()) || 0)
      )
    );
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getAdminEvents = async (req, res) => {
  try {
    // Events created before ownership was tracked have no `createdBy`, so keep
    // them visible instead of hiding the admin's existing event history.
    const events = await Event.find({
      $or: [
        { createdBy: req.user._id },
        { createdBy: { $exists: false } },
        { createdBy: null }
      ]
    })
      .sort({ createdAt: -1 })
      .lean();
    return res.json(events.map(event => serializeEvent(event)));
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const getEventParticipants = async (req, res) => {
  try {
    if (!isValidEventId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid event id.' });
    }

    const event = await Event.findById(req.params.id)
      .populate('participants.userId', 'name email phoneNumber profileImage');
    if (!event) {
      return res.status(404).json({ message: 'Event not found.' });
    }

    return res.json(event.participants);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Create a new event
// @route   POST /api/events
// @access  Private/Admin
const createEvent = async (req, res) => {
  try {
    const {
      name,
      title,
      description,
      slug,
      image,
      bannerImage,
      sport,
      format,
      startDateTime,
      recurrence,
      locationName,
      city,
      lat,
      lng,
      organizer,
      maxParticipants,
      targetDistance,
      startDate,
      endDate,
      rules,
      rewards,
      status,
      location,
      price,
      category,
      websiteUrl,
      eventType,
      allowedActivityTypes,
      minDurationMinutes,
      minDistanceKm,
      progressMetric,
      requiredActivityCount,
      requiredQualifyingDays,
      requiredQualifyingSessions,
      rewardCoins,
      badgeName,
      publicationStatus
    } = req.body;
    const eventName = String(name || title || '').trim();
    if (!eventName || !startDate || !endDate) {
      return res.status(400).json({
        message: 'Name, startDate, and endDate are required.'
      });
    }

    const parsedStartDate = parseEventCalendarDate(startDate);
    const parsedEndDate = parseEventCalendarDate(endDate, true);
    if (!parsedStartDate || !parsedEndDate || parsedEndDate < parsedStartDate) {
      return res.status(400).json({
        message: 'Provide valid dates with endDate on or after startDate.'
      });
    }

    const resolvedEventType = eventType || 'inPerson';
    if (!EVENT_TYPES.includes(resolvedEventType)) {
      return res.status(400).json({
        message: `eventType must be one of ${EVENT_TYPES.join(', ')}.`
      });
    }

    const parsedTargetDistance = Number(
      targetDistance ?? req.body.targetDistanceKm ?? 5
    );
    if (!Number.isFinite(parsedTargetDistance) || parsedTargetDistance <= 0) {
      return res.status(400).json({
        message: 'targetDistance must be a positive number.'
      });
    }

    const eventStatus = status ?? 'upcoming';
    if (!['upcoming', 'active', 'completed'].includes(eventStatus)) {
      return res.status(400).json({
        message: 'Status must be upcoming, active, or completed.'
      });
    }

    const resolvedPublicationStatus = publicationStatus || 'published';
    if (!PUBLICATION_STATUSES.includes(resolvedPublicationStatus)) {
      return res.status(400).json({
        message: 'publicationStatus must be draft or published.'
      });
    }

    const activityCount = Number(
      requiredActivityCount ??
        requiredQualifyingDays ??
        requiredQualifyingSessions
    );
    const eventSlug =
      slug ||
      `${eventName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')}-${Date.now()}`;

    const event = new Event({
      name: eventName,
      title: eventName,
      description: description || '',
      slug: eventSlug,
      image: image || bannerImage || '',
      bannerImage: bannerImage || image || '',
      sport: sport || '',
      format: format || '',
      startDateTime: startDateTime
        ? new Date(startDateTime)
        : parsedStartDate,
      recurrence: recurrence || '',
      locationName: locationName || location || '',
      city: city || '',
      lat: lat == null || lat === '' ? undefined : Number(lat),
      lng: lng == null || lng === '' ? undefined : Number(lng),
      organizer: organizer || {},
      maxParticipants:
        maxParticipants == null || maxParticipants === ''
          ? undefined
          : Number(maxParticipants),
      targetDistance: parsedTargetDistance,
      targetDistanceKm: parsedTargetDistance,
      startDate: parsedStartDate,
      endDate: parsedEndDate,
      rules: rules || '',
      participationRules: rules || '',
      rewards: rewards || '',
      winnerRewards: rewards || '',
      status: eventStatus,
      publicationStatus: resolvedPublicationStatus,
      eventType: resolvedEventType,
      allowedActivityTypes: normalizeActivityTypes(allowedActivityTypes),
      minDurationMinutes:
        minDurationMinutes == null || minDurationMinutes === ''
          ? undefined
          : Number(minDurationMinutes),
      minDistanceKm:
        minDistanceKm == null || minDistanceKm === ''
          ? undefined
          : Number(minDistanceKm),
      progressMetric:
        progressMetric === 'days' || progressMetric === 'sessions'
          ? progressMetric
          : resolvedEventType === 'activityChallenge'
          ? 'days'
          : undefined,
      requiredActivityCount:
        Number.isFinite(activityCount) && activityCount > 0
          ? activityCount
          : undefined,
      rewardCoins:
        rewardCoins == null || rewardCoins === ''
          ? 0
          : Number(rewardCoins),
      badgeName: badgeName || '',
      createdBy: req.user._id,
      location: location || locationName || '',
      price: price ? parseFloat(price) : 0,
      category: category || 'Fitness',
      websiteUrl: websiteUrl || ''
    });

    const createdEvent = await event.save();
    res.status(201).json(serializeEvent(createdEvent));
  } catch (error) {
    const statusCode = error.name === 'ValidationError' ? 400 : 500;
    res.status(statusCode).json({ message: error.message });
  }
};

const getUploadedEventBanner = (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'A bannerImage file is required.' });
  }
  const imageUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
  return res.status(201).json({ imageUrl, bannerImage: imageUrl });
};

const joinEvent = async (req, res) => {
  try {
    if (!isValidEventId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid event id.' });
    }

    const now = new Date();
    const event = await Event.findOneAndUpdate(
      {
        _id: req.params.id,
        status: { $ne: 'completed' },
        publicationStatus: { $ne: 'draft' },
        endDate: { $gt: now },
        'participants.userId': { $ne: req.user._id }
      },
      { $push: { participants: { userId: req.user._id } } },
      { new: true }
    );
    if (event) {
      const participant = event.participants[event.participants.length - 1];
      return res.status(201).json({
        message: 'Successfully joined the event.',
        eventId: event._id,
        participant
      });
    }

    const existingEvent = await Event.findById(req.params.id);
    if (!existingEvent) {
      return res.status(404).json({ message: 'Event not found.' });
    }
    if (
      existingEvent.status === 'completed' ||
      existingEvent.endDate <= now
    ) {
      return res.status(400).json({ message: 'This event has ended.' });
    }
    const existingParticipant = existingEvent.participants.find(
      participant =>
        participant.userId?.toString() === req.user._id.toString()
    );
    if (existingParticipant) {
      return res.status(200).json({
        message: 'You have already joined this event.',
        eventId: existingEvent._id,
        participant: existingParticipant
      });
    }
    return res.status(409).json({ message: 'Could not join this event.' });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const leaveEvent = async (req, res) => {
  try {
    if (!isValidEventId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid event id.' });
    }

    const now = new Date();
    const event = await Event.findOneAndUpdate(
      {
        _id: req.params.id,
        status: { $ne: 'completed' },
        endDate: { $gt: now },
        'participants.userId': req.user._id
      },
      { $pull: { participants: { userId: req.user._id } } },
      { new: true }
    );
    if (event) {
      return res.status(200).json({
        message: 'You have left the event.',
        eventId: event._id
      });
    }

    const existingEvent = await Event.findById(req.params.id);
    if (!existingEvent) {
      return res.status(404).json({ message: 'Event not found.' });
    }
    if (
      existingEvent.status === 'completed' ||
      existingEvent.endDate <= now
    ) {
      return res.status(400).json({ message: 'This event has ended.' });
    }
    return res.status(200).json({
      message: 'You are not currently joined to this event.',
      eventId: existingEvent._id
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const completeEvent = async (req, res) => {
  try {
    if (!isValidEventId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid event id.' });
    }
    const distance = Number(req.body?.distance);
    const time = Number(req.body?.timeSeconds ?? req.body?.time);
    if (
      !Number.isFinite(distance) ||
      distance <= 0 ||
      !Number.isFinite(time) ||
      time <= 0
    ) {
      return res.status(400).json({
        message: 'distance and time must be positive numbers.'
      });
    }

    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: 'Event not found.' });
    if (event.status === 'completed' || event.endDate <= new Date()) {
      return res.status(400).json({ message: 'This event has ended.' });
    }

    const participant = event.participants.find(
      entry => entry.userId.toString() === req.user._id.toString()
    );
    if (!participant) {
      return res.status(400).json({ message: 'Join this event before completing it.' });
    }

    const targetDistance = event.targetDistance ?? event.targetDistanceKm;
    if (distance < targetDistance) {
      return res.status(400).json({
        message: `Complete at least ${targetDistance} distance to finish this event.`
      });
    }
    if (participant.time != null && participant.time <= time) {
      return res.status(200).json({
        message: 'Your existing result is faster.',
        participant
      });
    }

    participant.distance = distance;
    participant.time = time;
    participant.status = 'completed';
    participant.completedAt = new Date();
    await event.save();

    return res.status(200).json({
      message: 'Event result recorded.',
      participant
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const getEventLeaderboard = async (req, res) => {
  try {
    if (!isValidEventId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid event id.' });
    }

    const event = await Event.findById(req.params.id)
      .populate('participants.userId', 'name');
    if (!event) return res.status(404).json({ message: 'Event not found.' });

    const targetDistance = event.targetDistance ?? event.targetDistanceKm;
    return res.status(
      200
    ).json(buildEventLeaderboard(event.participants, targetDistance));
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Update an event
// @route   PUT /api/events/:id
// @access  Private/Admin
const updateEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);

    if (event) {
      if (req.body.name !== undefined || req.body.title !== undefined) {
        event.name = req.body.name || req.body.title;
        event.title = req.body.title || req.body.name;
      }
      event.title = req.body.title || event.title;
      event.slug = req.body.slug || event.slug;
      event.image = req.body.image || event.image;
      if (req.body.bannerImage !== undefined) {
        event.bannerImage = req.body.bannerImage;
      }
      if (req.body.description !== undefined) {
        event.description = req.body.description;
      }
      for (const field of [
        'sport',
        'format',
        'recurrence',
        'locationName',
        'city',
        'organizer'
      ]) {
        if (req.body[field] !== undefined) event[field] = req.body[field];
      }
      for (const field of [
        'rules',
        'rewards'
      ]) {
        if (req.body[field] !== undefined) {
          event[field] = req.body[field];
          event[field === 'rules' ? 'participationRules' : 'winnerRewards'] =
            req.body[field];
        }
      }
      if (req.body.startDateTime !== undefined) {
        event.startDateTime = new Date(req.body.startDateTime);
      }
      if (req.body.lat !== undefined) {
        event.lat = req.body.lat === null ? undefined : Number(req.body.lat);
      }
      if (req.body.lng !== undefined) {
        event.lng = req.body.lng === null ? undefined : Number(req.body.lng);
      }
      if (req.body.maxParticipants !== undefined) {
        event.maxParticipants =
          req.body.maxParticipants === null || req.body.maxParticipants === ''
            ? undefined
            : Number(req.body.maxParticipants);
      }
      if (
        req.body.targetDistance !== undefined ||
        req.body.targetDistanceKm !== undefined
      ) {
        const targetDistance = Number(
          req.body.targetDistance ?? req.body.targetDistanceKm
        );
        if (!Number.isFinite(targetDistance) || targetDistance <= 0) {
          return res.status(400).json({
            message: 'targetDistance must be a positive number.'
          });
        }
        event.targetDistance = targetDistance;
        event.targetDistanceKm = targetDistance;
      }
      if (req.body.startDate) {
        const parsedStartDate = parseEventCalendarDate(req.body.startDate);
        if (!parsedStartDate) {
          return res.status(400).json({ message: 'Provide a valid startDate.' });
        }
        event.startDate = parsedStartDate;
      }
      if (req.body.endDate) {
        const parsedEndDate = parseEventCalendarDate(req.body.endDate, true);
        if (!parsedEndDate) {
          return res.status(400).json({ message: 'Provide a valid endDate.' });
        }
        event.endDate = parsedEndDate;
      }
      if (event.endDate < event.startDate) {
        return res.status(400).json({
          message: 'Provide valid dates with endDate on or after startDate.'
        });
      }
      if (req.body.status !== undefined) {
        if (!['upcoming', 'active', 'completed', 'cancelled'].includes(req.body.status)) {
          return res.status(400).json({ message: 'Invalid event status.' });
        }
        event.status = req.body.status;
      }
      event.location = req.body.location || req.body.locationName || event.location;
      if (req.body.price !== undefined) event.price = parseFloat(req.body.price);
      event.category = req.body.category || event.category;
      event.websiteUrl = req.body.websiteUrl || event.websiteUrl;

      if (req.body.eventType !== undefined) {
        if (!EVENT_TYPES.includes(req.body.eventType)) {
          return res.status(400).json({
            message: `eventType must be one of ${EVENT_TYPES.join(', ')}.`
          });
        }
        event.eventType = req.body.eventType;
      }
      if (req.body.publicationStatus !== undefined) {
        if (!PUBLICATION_STATUSES.includes(req.body.publicationStatus)) {
          return res.status(400).json({
            message: 'publicationStatus must be draft or published.'
          });
        }
        event.publicationStatus = req.body.publicationStatus;
      }
      if (req.body.allowedActivityTypes !== undefined) {
        event.allowedActivityTypes = normalizeActivityTypes(
          req.body.allowedActivityTypes
        );
      }
      for (const field of [
        'minDurationMinutes',
        'minDistanceKm',
        'requiredActivityCount',
        'rewardCoins'
      ]) {
        if (req.body[field] !== undefined) {
          event[field] =
            req.body[field] === null || req.body[field] === ''
              ? undefined
              : Number(req.body[field]);
        }
      }
      if (req.body.progressMetric !== undefined) {
        event.progressMetric =
          req.body.progressMetric === 'days' ||
          req.body.progressMetric === 'sessions'
            ? req.body.progressMetric
            : undefined;
      }
      if (req.body.badgeName !== undefined) {
        event.badgeName = req.body.badgeName;
      }
      if (!event.image && event.bannerImage) {
        event.image = event.bannerImage;
      }

      const updatedEvent = await event.save();
      res.json(serializeEvent(updatedEvent));
    } else {
      res.status(404).json({ message: 'Event not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete an event
// @route   DELETE /api/events/:id
// @access  Private/Admin
const deleteEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);

    if (event) {
      await Event.deleteOne({ _id: event._id });
      res.json({ message: 'Event removed permanently' });
    } else {
      res.status(404).json({ message: 'Event not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const cancelEvent = async (req, res) => {
  try {
    if (!isValidEventId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid event id.' });
    }

    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ message: 'Event not found.' });
    }
    event.status = 'cancelled';
    const cancelledEvent = await event.save();
    return res.json(cancelledEvent);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Synchronize event bookings from Website
// @route   POST /api/events/sync-booking
// @access  Private/Sync API Secret
const syncEventBooking = async (req, res) => {
  const payload = req.body;
  const ipAddress = req.ip || req.connection?.remoteAddress || '';
  const userAgent = req.headers['user-agent'] || '';

  try {
    // 1. Validate payload fields
    const requiredFields = [
      'user_name',
      'verified_mobile_number',
      'event_id',
      'event_title',
      'payment_id',
      'payment_status',
      'amount_paid',
      'booking_date_time'
    ];

    const missingFields = requiredFields.filter(field => payload[field] === undefined || payload[field] === null || payload[field] === '');
    
    if (missingFields.length > 0) {
      await EventSyncLog.create({
        requestPayload: payload,
        status: 'invalid_payload',
        errorMessage: `Missing required fields: ${missingFields.join(', ')}`,
        ipAddress,
        userAgent
      });
      return res.status(400).json({
        success: false,
        message: `Validation failed: Missing required fields: ${missingFields.join(', ')}`
      });
    }

    // 2. Payment status validation
    const paymentStatus = String(payload.payment_status).toUpperCase();
    if (paymentStatus !== 'PAID') {
      await EventSyncLog.create({
        requestPayload: payload,
        status: 'failed',
        errorMessage: `Payment status is ${paymentStatus}, only PAID bookings are processed`,
        ipAddress,
        userAgent
      });
      return res.status(400).json({
        success: false,
        message: `Validation failed: Only PAID bookings are allowed. Got status: ${paymentStatus}`
      });
    }

    // 3. Duplicate check
    const duplicateQuery = {
      $or: [
        { payment_id: payload.payment_id }
      ]
    };
    if (payload.booking_id) {
      duplicateQuery.$or.push({ booking_id: payload.booking_id });
    }
    if (payload.website_order_id) {
      duplicateQuery.$or.push({ website_order_id: payload.website_order_id });
    }

    const existingBooking = await EventBooking.findOne(duplicateQuery);
    if (existingBooking) {
      await EventSyncLog.create({
        requestPayload: payload,
        status: 'duplicate',
        errorMessage: `Duplicate booking attempt matched query: ${JSON.stringify(duplicateQuery.$or)}`,
        ipAddress,
        userAgent
      });
      return res.status(409).json({
        success: false,
        message: 'Duplicate booking: payment_id, booking_id, or website_order_id already exists.'
      });
    }

    // 4. Auto user mapping
    const email = payload.user_email ? String(payload.user_email).toLowerCase().trim() : '';
    const rawPhone = String(payload.verified_mobile_number).trim();
    
    // Normalize phone number to match with or without +91 prefix
    const phoneVariants = [rawPhone];
    if (rawPhone.startsWith('+91')) {
      phoneVariants.push(rawPhone.replace('+91', ''));
    } else if (rawPhone.length === 10) {
      phoneVariants.push('+91' + rawPhone);
    }

    const userQuery = {
      $or: [
        { phoneNumber: { $in: phoneVariants } }
      ]
    };
    if (email) {
      userQuery.$or.push({ email });
    }

    const mappedUser = await User.findOne(userQuery);
    const userId = mappedUser ? mappedUser._id : null;

    // 5. Create EventBooking
    const eventBooking = await EventBooking.create({
      userId,
      user_name: payload.user_name,
      user_email: payload.user_email || '',
      verified_mobile_number: payload.verified_mobile_number,
      event_id: payload.event_id,
      event_title: payload.event_title,
      booking_id: payload.booking_id || null,
      website_order_id: payload.website_order_id || null,
      payment_gateway_order_id: payload.payment_gateway_order_id || null,
      payment_id: payload.payment_id,
      payment_status: payload.payment_status,
      amount_paid: Number(payload.amount_paid),
      currency: payload.currency || 'INR',
      ticket_quantity: Number(payload.ticket_quantity) || 1,
      booking_date_time: new Date(payload.booking_date_time),
      event_date: payload.event_date ? new Date(payload.event_date) : null,
      booking_source: payload.booking_source || 'website',
      sync_status: 'success',
      metadata: payload.metadata || {},
      syncedAt: new Date()
    });

    // 6. Create success log
    await EventSyncLog.create({
      requestPayload: payload,
      status: 'success',
      errorMessage: null,
      ipAddress,
      userAgent
    });

    return res.status(201).json({
      success: true,
      message: 'Event booking synchronized successfully',
      bookingId: eventBooking._id,
      mappedUser: userId ? 'mapped' : 'guest'
    });

  } catch (error) {
    console.error('Error syncing event booking:', error);
    await EventSyncLog.create({
      requestPayload: payload,
      status: 'failed',
      errorMessage: error.message,
      ipAddress,
      userAgent
    });
    return res.status(500).json({
      success: false,
      message: 'Internal server error while syncing event booking'
    });
  }
};

module.exports = {
  buildEventLeaderboard,
  isEventFull,
  parseEventCalendarDate,
  getEvents,
  getUpcomingEvents,
  getCompletedEvents,
  getAdminEvents,
  getEventParticipants,
  getUploadedEventBanner,
  createEvent,
  joinEvent,
  leaveEvent,
  completeEvent,
  getEventLeaderboard,
  updateEvent,
  deleteEvent,
  cancelEvent,
  syncEventBooking
};
