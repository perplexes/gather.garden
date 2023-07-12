// https://raw.githubusercontent.com/AssemblyAI/twilio-realtime-tutorial/master/transcribe.js
// import { Database } from '../types/supabase'
const express = require("express");
const { createClient } = require('@supabase/supabase-js');


// Using anon key
const supabase = createClient('https://uumbjbosyllctxqzzrja.supabase.co', process.env.SUPABASE_KEY, { auth: { persistSession: false } });

const WebSocket = require("ws");
const WaveFile = require("wavefile").WaveFile;

const app = express();
app.use(express.urlencoded({ extended: false }))
// app.use(express.json());
const server = require("http").createServer(app);
const wss = new WebSocket.Server({ server });
const postmark = require("postmark");

// Send an email:
const postmarkClient = new postmark.ServerClient(process.env.POSTMARK_API_KEY);

const { Configuration, OpenAIApi } = require("openai");

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

let assembly;

var last_receive = new Date();

async function summarize_and_send(email, transcription) {
  var gptRes = await openai.createChatCompletion({
    model: "gpt-4",
    messages: [{ role: "system", content: "Please summarize the ideas in this transcription using a warm, friendly, and encouraging but not cloying tone for them to build the idea." }, { role: "user", content: transcription }],
  })

  var content = gptRes.data.choices[0].message.content;
  console.log(content)
  // store in supabase
  var insertRes = await supabase.from("ideas")
    .insert({ transcription: transcription, llm_summary: content, phone: from })
    .select();

  console.log(insertRes);

  if (email) {
    postmarkClient.sendEmail({
      "From": "ideas@gather.garden",
      "To": email,
      "Subject": "Your latest idea",
      "TextBody": content,
    });

    supabase.from("ideas")
      .update({ email_sent_at: new Date() })
      .eq("id", insertRes.data[0].id);
  }
}

wss.on("connection", (ws) => {
  let transcription = '';
  let email = null;
  const texts = {};
  var bytes = 0;
  let chunks = [];
  console.info("New Connection Initiated");
  assembly.onmessage = (assemblyMsg) => {
    const res = JSON.parse(assemblyMsg.data);
    console.log()
    // console.log("message from assembly");
    // console.log(res);

    // Can receive messages out of order
    texts[res.audio_start] = res.text;
    const keys = Object.keys(texts);
    keys.sort((a, b) => a - b);
    for (const key of keys) {
      if (texts[key]) {
        console.log(`[${key}] ${texts[key]}`);
        transcription += ` ${texts[key]}`;
      }
    }
    if (bytes < Buffer.byteLength(transcription, "utf8")) {
      last_receive = new Date();
      bytes = Buffer.byteLength(transcription, "utf8");

      console.log(`${last_receive}: ${transcription}`)
    }
  };
  assembly.onerror = (error) => {
    console.error("Error from assembly")
    console.error(error)
  };

  ws.on("message", (message) => {
    if (!assembly)
      return console.error("AssemblyAI's WebSocket must be initialized.");

    const msg = JSON.parse(message);

    switch (msg.event) {
      case "connected":
        console.info("A new call has started.");
        break;

      case "start":
        console.info("Starting media stream and looking up user...");
        console.log(msg);
        from = msg.start.customParameters.From;
        to = msg.start.customParameters.To;
        supabase
          .from("accounts").select("email").eq("phone", from)
          .then((results) => {
            console.log(results);
            if (results.data.length > 0) {
              email = results.data[0].email;
              console.log(`Found email: ${email}`)
            } else {
              twilioClient.messages
                .create({
                  body: "Thanks for trying out Gather Garden. What's your email address so Ic an send your ideas?",
                  from: to,
                  to: from,
                });
            }
          });


        break;

      case "media":
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
        chunks.push(twilioAudioBuffer.slice(44));

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
        summarize_and_send(email, transcription);
        break;
    }
  });
});

app.get("/", (_, res) => res.send("Twilio Live Stream App"));

app.post("/", async (req, res) => {
  // TODO: Get phone number out of req and use it to match to email address to send to; we can also fire off an SMS message with the summary instead of email since we have their number!
  assembly = new WebSocket(
    "wss://api.assemblyai.com/v2/realtime/ws?sample_rate=8000",
    { headers: { authorization: process.env.APIKEY } }
  );
  res.set("Content-Type", "text/xml");
  var from = req.body.From;
  var to = req.body.To;
  res.send(
    `<Response>
       <Start>
         <Stream url='wss://${req.headers.host}'>
          <Parameter name="From" value="${from}" />
          <Parameter name="To" value="${to}" />
        </Stream>
       </Start>
       <Say>
         Start talking and I'll summarize all your ideas for you and send it to your email address.
       </Say>
       <Pause length='10' />
       <Redirect>https://${req.headers.host}/inprogress</Redirect>
     </Response>`
  );
});

app.post("/inprogress", async (req, res) => {
  res.set("Content-Type", "text/xml");
  var delta = (new Date()) - last_receive;
  var say = '';
  if (delta > 5000) {
    say = '<Say>Go on</Say>';
    last_receive = new Date();
  }

  res.send(
    `<Response>
       ${say}
       <Pause length='2' />
       <Redirect>https://${req.headers.host}/inprogress</Redirect>
     </Response>`
  );
});

app.post("/sms", async (req, res) => {
  res.set("Content-Type", "text/xml");
  console.log(req.body);
  var phone = req.body.From;
  var previousEmail = 'N/A';
  var email = req.body.Body;

  var results = await supabase.from('accounts').select('email').eq('phone', phone);
  console.log(results);
  if (results.data.length > 0) {
    console.log('found phone');
    previousEmail = results.data[0].email;
    var update = await supabase.from('accounts').update({ email: email }).eq('phone', phone);
    console.log(update);
  } else {
    console.log('not found phone');
    var insert = await supabase.from('accounts').insert({ phone: phone, email: email });
    console.log(insert);
  }

  res.send(
    `<Response>
      <Message><Body>I've now associated your number ${phone} to ${email}. Your previous email was ${previousEmail}</Body></Message>
    </Response>
`);
})
console.log("Listening...");
server.listen(3000);
