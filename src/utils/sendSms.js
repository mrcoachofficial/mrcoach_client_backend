const axios = require('axios');

/**
 * Helper to send SMS using MSG91
 * @param {string} phoneNumber - Recipient's phone number
 * @param {string} otp - The generated OTP code
 */
const sendSms = async (phoneNumber, otp) => {
  const authKey = process.env.MSG91_AUTH_KEY;
  const templateId = process.env.MSG91_TEMPLATE_ID;

  if (!authKey || !templateId || authKey.includes('your_msg91') || templateId.includes('your_msg91')) {
    console.log(`\n====================================`);
    console.log(`[SMS MSG91 Fallback] OTP for ${phoneNumber}: ${otp}`);
    console.log(`====================================\n`);
    return true;
  }

  try {
    // MSG91 API configuration endpoint
    // Standard parameters for sending OTP: authkey, template_id, mobile, otp
    const response = await axios.get('https://control.msg91.com/api/v5/otp', {
      params: {
        otp: otp,
        mobile: phoneNumber.replace(/\D/g, ''), // Keep digits only (e.g. 919876543210)
        authkey: authKey,
        template_id: templateId
      }
    });

    console.log('MSG91 Response:', response.data);
    return response.data && response.data.type === 'success';
  } catch (error) {
    console.error('MSG91 API error sending SMS:', error.response?.data || error.message);
    return false;
  }
};

module.exports = sendSms;
