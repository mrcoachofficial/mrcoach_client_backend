const axios = require('axios');

const testWhatsApp = async () => {
  const authKey = '503054AmCCgDdaMIh269e108b6P1';
  const senderNumber = '917448421134';
  const recipientNumber = '919360364179';
  const otp = '895623';

  console.log('Sending test WhatsApp OTP to', recipientNumber, 'via MSG91 Outbound API...');

  const payload = {
    "integrated_number": senderNumber,
    "content_type": "template",
    "payload": {
      "messaging_product": "whatsapp",
      "type": "template",
      "template": {
        "name": "mrcoach_clientotp",
        "language": {
          "code": "en",
          "policy": "deterministic"
        },
        "namespace": "c6b2f8ab_03db_4801_b39d_9ca18b52f445",
        "to_and_components": [
          {
            "to": [
              recipientNumber
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

  try {
    const response = await axios.post('https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/', payload, {
      headers: {
        'authkey': authKey,
        'Content-Type': 'application/json'
      }
    });

    console.log('MSG91 WhatsApp Response:', response.data);
  } catch (error) {
    console.error('MSG91 WhatsApp Error:', error.response ? error.response.data : error.message);
  }
};

testWhatsApp();
