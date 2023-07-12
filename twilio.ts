const twilioClient = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

const { VoiceResponse, MessagingResponse } = twilioClient.twiml;

async function sendMessage(to, message) {
  try {
    const message = await twilioClient.messages.create({
      to: to,
      from: process.env.TWILIO_PHONE_NUMBER,
      body: message
    });
    console.log(`Message sent to ${to}: ${message.sid}`);
  } catch (error) {
    console.error(`Error sending message to ${to}: ${error}`);
  }
}

function setEmailMessageResponse(from: string, email: string, previousEmail: string) {
  const messagingResponse = new MessagingResponse();
  messagingResponse.message(`I've now associated your number ${phone} to ${email}. Your previous email was ${previousEmail}`);
  return messagingResponse;
}

function welcomeVoiceResponse(from: string, to: string, streamUrl: string, redirectUrl: string) {
  let voiceResponse = new VoiceResponse();

  let stream = voiceResponse.start().stream();
  stream.parameter({ name: 'From', value: from });
  stream.parameter({ name: 'To', value: to });
  stream.url(streamUrl);

  voiceResponse.say('Start talking and I\'ll summarize all your ideas for you and send it to your email address.');
  voiceResponse.pause({ length: 10 });
  voiceResponse.redirect(redirectUrl);

  return voiceResponse.toString();
}

function inprogressVoiceResponse(sendGoOn: boolean, redirectUrl: string) {
  let voiceResponse = new VoiceResponse();
  if (sendGoOn) {
    voiceResponse.say('Go on.');
  }
  voiceResponse.pause({ length: 5 });
  voiceResponse.redirect(redirectUrl);

  return voiceResponse.toString();
}

export { sendMessage, welcomeVoiceResponse }