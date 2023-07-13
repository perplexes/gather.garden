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

async function summarize_and_send(phone: string, email: string | null, transcription: string) {
  console.log("summarize_and_send");
  console.log({ phone, email, transcription });
  // gptRes and insertRes could use more precise types if you have interfaces for their responses
  const { data: { choices } }: any = await openai.createChatCompletion({
    model: "gpt-4",
    messages: [{ role: "system", content: "Please summarize the idea or ideas in this transcription using a warm, friendly, and encouraging but not cloying tone for them to build the idea." }, { role: "user", content: transcription }],
  });

  const content: string = choices[0].message.content;
  console.log(content)
  const id = await insertIdea(transcription, content, phone);

  if (email && email.includes('@')) {
    let emailData = {
      "From": "ideas@gather.garden",
      "To": email,
      "Subject": "Your latest idea",
      "TextBody": `Summary: ${content}\n\n\nTranscription: ${transcription}`,
    };
    console.log("Sending to email: ");
    console.log(emailData);
    let pcResult = await postmarkClient.sendEmail(emailData);
    console.log(pcResult);
    let usaResult = await updateSentAt(id, new Date());
    console.log(usaResult);
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
        await assembly.waitToOpen();
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
        if (chunks.length >= 5) {
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

      case "stop":
        console.info("Call has ended");
        assembly.send(JSON.stringify({ terminate_session: true }));
        summarize_and_send(From, email, assembly.transcription);
        break;
    }
  });
}

export default handleConnection;