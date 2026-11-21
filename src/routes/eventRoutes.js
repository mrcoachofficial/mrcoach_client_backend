
const express = require('express');
const router = express.Router();
const {
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
} = require('../controllers/eventController');
const { protect, admin } = require('../middleware/authMiddleware');
const eventSyncAuth = require('../middleware/eventSyncAuth');
const { uploadEventBanner } = require('../middleware/eventBannerUpload');
const virtualRunController = require('../controllers/virtualRunController');

router.get('/virtual-runs', virtualRunController.getVirtualRuns);
router.get('/virtual-runs/my-events', protect, virtualRunController.getMyVirtualRuns);
router.get('/virtual-runs/:id', virtualRunController.getVirtualRunDetails);
router.get('/virtual-runs/:id/leaderboard', virtualRunController.getVirtualRunLeaderboard);
router.post('/virtual-runs/:id/join', protect, virtualRunController.joinVirtualRun);
router.get('/virtual-runs/:id/my-run', protect, virtualRunController.getMyVirtualRun);
router.post('/virtual-runs/:id/runs', protect, virtualRunController.startVirtualRun);
router.post('/virtual-runs/runs/:sessionId/points', protect, virtualRunController.uploadVirtualRunPoints);
router.post('/virtual-runs/runs/:sessionId/pause', protect, virtualRunController.pauseVirtualRun);
router.post('/virtual-runs/runs/:sessionId/resume', protect, virtualRunController.resumeVirtualRun);


router.post('/virtual-runs/runs/:sessionId/finish', protect, virtualRunController.finishVirtualRun);

router.get('/admin/virtual-runs', protect, admin, virtualRunController.adminGetVirtualRuns);
router.post('/admin/virtual-runs', protect, admin, virtualRunController.adminCreateVirtualRun);
router.put('/admin/virtual-runs/:id', protect, admin, virtualRunController.adminUpdateVirtualRun);
router.post('/admin/virtual-runs/:id/reward/fulfill', protect, admin, virtualRunController.adminFulfillManualReward);
router.delete('/admin/virtual-runs/:id', protect, admin, virtualRunController.adminDeleteVirtualRun);

router.route('/upcoming')
  .get(getUpcomingEvents); // Public: Everyone can view upcoming events

router.route('/completed')
  .get(getCompletedEvents); // Public: Everyone can view completed events

router.route('/sync-booking')
  .post(eventSyncAuth, syncEventBooking); // Secure webhook sync route

router.get('/admin/mine', protect, admin, getAdminEvents);
router.post('/upload-banner', protect, admin, uploadEventBanner, getUploadedEventBanner);
router.get('/:id/participants', protect, admin, getEventParticipants);
router.patch('/:id/cancel', protect, admin, cancelEvent);
router.get('/:id/leaderboard', getEventLeaderboard);
router.post('/:id/join', protect, joinEvent);
router.delete('/:id/join', protect, leaveEvent);
router.post('/:id/complete', protect, completeEvent);

router.route('/')
  .get(getEvents) // Public: events by status
  .post(protect, admin, uploadEventBanner, createEvent); // Admin only: Can create new events

router.route('/:id')
  .put(protect, admin, uploadEventBanner, updateEvent) // Admin only
  .delete(protect, admin, deleteEvent); // Admin only

module.exports = router;
