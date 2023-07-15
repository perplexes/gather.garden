import twilio from 'twilio';
const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

const { VoiceResponse, MessagingResponse } = twilio.twiml;

async function sendMessage(to: string, messageString: string) {
  try {
    const message = await twilioClient.messages.create({
      to: to,
      from: process.env.TWILIO_PHONE_NUMBER,
      body: messageString,
    });
    console.log(`Message sent to ${to}: ${message.sid}`);
  } catch (error) {
    console.error(`Error sending message to ${to}: ${error}`);
  }
}

function setEmailMessageResponse(from: string, email: string, previousEmail: string): string {
  const messagingResponse = new MessagingResponse();
  if (email.includes('@')) {
    messagingResponse.message(`I've now associated your number ${from} to ${email}. Your previous email was ${previousEmail}`);
  } else {
    messagingResponse.message("Please enter a valid email address.");
  }
  return messagingResponse.toString();
}

function welcomeVoiceResponse(from: string, to: string, email: string, streamUrl: string, redirectUrl: string): string {
  let voiceResponse = new VoiceResponse();

  let stream = voiceResponse.start().stream({ url: streamUrl });
  stream.parameter({ name: 'From', value: from });
  stream.parameter({ name: 'To', value: to });
  stream.parameter({ name: 'email', value: email });

  voiceResponse.say('Start talking and I\'ll summarize all your ideas for you and send it to your email address.');
  // voiceResponse.say('Go');
  voiceResponse.pause({ length: 10 });
  voiceResponse.redirect(redirectUrl);

  return voiceResponse.toString();
}

function inprogressVoiceResponse(sendGoOn: boolean, redirectUrl: string): string {
  let voiceResponse = new VoiceResponse();
  if (sendGoOn) {
    voiceResponse.say('Go on.');
  }
  voiceResponse.pause({ length: 5 });
  voiceResponse.redirect(redirectUrl);

  return voiceResponse.toString();
}

export { sendMessage, welcomeVoiceResponse, inprogressVoiceResponse, setEmailMessageResponse }