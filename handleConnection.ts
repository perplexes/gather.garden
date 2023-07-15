import { RawData, WebSocket } from 'ws';
import { ServerClient as PostmarkClient } from 'postmark';
const postmarkClient = new PostmarkClient(process.env.POSTMARK_API_KEY ?? '');

import { Configuration, OpenAIApi } from 'openai';
import { WaveFile } from 'wavefile';

import { insertIdea, updateSentAt } from './persistence';
import Assembly from './assembly'

const configuration: Configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY!,
});
const openai: OpenAIApi = new OpenAIApi(configuration);

async function sendIdea(email: string, transcription: string, llm_subject: string, llm_summary: string, id: number) {
  let emailData = {
    "From": "ideas@gather.garden",
    "To": email,
    "Subject": llm_subject,
    "TextBody": `Summary: ${llm_summary}\n\n\nTranscription: ${transcription}`,
  };
  console.log("Sending to email: ");
  console.log(emailData);
  let pcResult = await postmarkClient.sendEmail(emailData);
  console.log(pcResult);
  let usaResult = await updateSentAt(id, new Date());
  console.log(usaResult);
}
async function summarize_and_send(phone: string, email: string | null, transcription: string) {
  console.log("summarize_and_send");
  console.log({ phone, email, transcription });
  // gptRes and insertRes could use more precise types if you have interfaces for their responses
  const { data: { choices } }: any = await openai.createChatCompletion({
    model: "gpt-4",
    messages: [{ role: "system", content: "Please summarize the idea or ideas in this transcription using a warm, friendly, and encouraging but not cloying tone for them to build the idea." }, { role: "user", content: transcription }],
  });

  const llm_summary: string = choices[0].message.content;
  console.log(llm_summary)

  const { data: { subjectChoices } }: any = await openai.createChatCompletion({
    model: "gpt-4",
    messages: [{ role: "system", content: "Please create a terse email subject line of the following idea or ideas in the below transcription using a warm, friendly, and encouraging but not cloying tone for them to build the idea." }, { role: "user", content: transcription }],
  });

  const llm_subject: string = subjectChoices[0].message.content;
  console.log(llm_subject)

  const id = await insertIdea(transcription, llm_subject, llm_summary, phone);

  if (email && email.includes('@')) {
    sendIdea(email, transcription, llm_subject, llm_summary, id);
  }
}

async function handleConnection(ws: WebSocket): Promise<void> {
  let assembly = new Assembly();
  let From: string;
  let email: string;

  let chunks: Buffer[] = [];
  console.info("New Connection Initiated");

  ws.on("message", async (message: Buffer) => {
    const msg = JSON.parse(message.toString());

    switch (msg.event) {
      case "connected":
        console.log("A new call has started.");
        break;

      case "start":
        console.log("Starting media stream, parsing metadata...");
        ({ From, email } = msg.start.customParameters);
        break;

      case "media":
        // Try buffering instead
        // await assembly.waitToOpen();
        const twilioData = msg.media.payload;

        // Here are the current options explored using the WaveFile lib:

        // We build the wav file from scratch since it comes in as raw data
        let wav = new WaveFile();

        // Twilio uses MuLaw so we have to encode for that
        wav.fromScratch(1, 8000, "8m", Buffer.from(twilioData, "base64"));

        // This library has a handy method to decode MuLaw straight to 16-bit PCM
        wav.fromMuLaw();

        // Here we get the raw audio data in base64
        const twilio64Encoded = wav.toDataURI().split("base64,")[1];

        // Create our audio buffer
        const twilioAudioBuffer = Buffer.from(twilio64Encoded, "base64");

        // We send data starting at byte 44 to remove wav headers so our model sees only audio data
        const tabNoHeader = twilioAudioBuffer.subarray(44);
        chunks.push(tabNoHeader);

        // We have to chunk data b/c twilio sends audio durations of ~20ms and AAI needs a min of 100ms
        if (assembly.isOpen() && chunks.length >= 5) {
          // Here we want to concat our buffer to create one single buffer
          const audioBuffer = Buffer.concat(chunks);

          // Re-encode to base64
          const encodedAudio = audioBuffer.toString("base64");

          // console.log(assembly.readyState);
          // Finally send to assembly and clear chunks
          assembly.send(JSON.stringify({ audio_data: encodedAudio }));
          chunks = [];
        }

        break;

      // Need to delay until transcription is settled BUT CANNOT BLOCK!
      // Blocking this thread means that the transcription will not be processed in time.
      // TODO: Real solution is pub/sub. Publish the audio streaming data as it comes in. A separate worker thread will consume the data and process it. At this point we send a tombstone. When worker thread sees tombstone, setup a timeout that will continue stream processing until transcription is settled. Then send summary.
      case "stop":
        console.info("Call has ended");
        // setTimeout(async () => {
        summarize_and_send(From, email, assembly.transcription);
        // }, 10000);

        break;
    }
  });
}

export { handleConnection, sendIdea };