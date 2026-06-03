const express = require('express');
const router = express.Router();
const { 
  getAdminBookings, updateAdminService, deleteAdminService, adminLogin, 
  getAdminSlots, createAdminSlot, deleteAdminSlot,
  getAdminProducts, createAdminProduct, updateAdminProduct, deleteAdminProduct,
  changeAdminPassword, getAdminConfigs, updateAdminConfig, getAdminUsers,
  importAdminUsers, getAdminOverview, updateAdminUser,
  deleteAdminUser, getAdminUserDetail, getAdminEventBookings,
  getAdminEventOverview, exportVerifiedPhoneNumbers, deleteAdminBooking
} = require('../controllers/adminController');

router.post('/login', adminLogin);
router.route('/overview').get(getAdminOverview);
router.route('/bookings').get(getAdminBookings);
router.route('/bookings/:id').delete(deleteAdminBooking);
router.route('/users').get(getAdminUsers);
router.route('/users/import').post(importAdminUsers);
router.route('/users/export-verified-phones').get(exportVerifiedPhoneNumbers);
router.route('/users/:id').put(updateAdminUser).delete(deleteAdminUser);
router.route('/users/:id/detail').get(getAdminUserDetail);
router.route('/event-bookings').get(getAdminEventBookings);
router.route('/event-bookings/overview').get(getAdminEventOverview);
router.route('/services/:id').put(updateAdminService).delete(deleteAdminService);
router.route('/slots').get(getAdminSlots).post(createAdminSlot);
router.route('/slots/:id').delete(deleteAdminSlot);
router.route('/products').get(getAdminProducts).post(createAdminProduct);
router.route('/products/:id').put(updateAdminProduct).delete(deleteAdminProduct);
router.put('/change-password', changeAdminPassword);
router.route('/config').get(getAdminConfigs).put(updateAdminConfig);

module.exports = router;
