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
    const cleanPhone = phoneNumber.replace(/\D/g, ''); // Keep digits only (e.g. 919876543210)
    const senderNumber = process.env.MSG91_WHATSAPP_NUMBER || '917448421134';
    const namespace = process.env.MSG91_WHATSAPP_NAMESPACE || 'c6b2f8ab_03db_4801_b39d_9ca18b52f445';

    console.log(`Sending WhatsApp OTP to ${cleanPhone}...`);

    const payload = {
      "integrated_number": senderNumber,
      "content_type": "template",
      "payload": {
        "messaging_product": "whatsapp",
        "type": "template",
        "template": {
          "name": templateId, // e.g. mrcoach_clientotp
          "language": {
            "code": "en",
            "policy": "deterministic"
          },
          "namespace": namespace,
          "to_and_components": [
            {
              "to": [
                cleanPhone
              ],
              "components": {
                "body_1": {
                  "type": "text",
                  "value": otp
                },
                "button_1": {
                  "subtype": "url",
                  "type": "text",
                  "value": otp
                }
              }
            }
          ]
        }
      }
    };

    const response = await axios.post('https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/', payload, {
      headers: {
        'authkey': authKey,
        'Content-Type': 'application/json'
      }
    });

    console.log('MSG91 WhatsApp Response:', response.data);
    return response.data && response.data.status === 'success';
  } catch (error) {
    console.error('MSG91 API error sending WhatsApp:', error.response?.data || error.message);
    return false;
  }
};

module.exports = sendSms;
