// https://raw.githubusercontent.com/AssemblyAI/twilio-realtime-tutorial/master/transcribe.ts
import express, { Request, Response } from "express";
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import twilio from 'twilio';
import WebSocket, { Server as WebSocketServer } from "ws";
import { WaveFile } from "wavefile";
import http from "http";
import postmark, { ServerClient as PostmarkClient } from "postmark";
import { Configuration, OpenAIApi } from "openai";
import { Server } from 'http';
import { AddressInfo } from 'net';

import { findEmail } from "./persistence";
import { sendMessage, welcomeVoiceResponse } from "./twilio";

const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);

const app: express.Application = express();
app.use(express.urlencoded({ extended: false }));

const server: Server = http.createServer(app);
const wss: WebSocketServer = new WebSocket.Server({ server });

// Send an email:
const postmarkClient: PostmarkClient = new postmark.ServerClient(process.env.POSTMARK_API_KEY!);

const configuration: Configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY!,
});
const openai: OpenAIApi = new OpenAIApi(configuration);

let assembly: WebSocket | undefined;

let last_receive: Date = new Date();

async function summarize_and_send(email: string | null, transcription: string) {
  // gptRes and insertRes could use more precise types if you have interfaces for their responses
  const gptRes: any = await openai.createChatCompletion({
    model: "gpt-4",
    messages: [{ role: "system", content: "Please summarize the ideas in this transcription using a warm, friendly, and encouraging but not cloying tone for them to build the idea." }, { role: "user", content: transcription }],
  });

  const content: string = gptRes.data.choices[0].message.content;
  console.log(content)
  // store in supabase
  const insertRes: any = await supabase.from("ideas")
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

wss.on("connection", (ws: WebSocket) => {
  //...
  // omitted for brevity, the full code would continue here
  //...
});

app.get("/", (_, res: Response) => res.send("Twilio Live Stream App"));

// Remember to define types for `req.body` if you have specific interface in mind
app.post("/", async (req: Request, res: Response) => {
  const email = await findEmail(req.body.From);
  const response = welcomeVoiceResponse(req.body.From, req.body.To, `wss://${req.headers.host}`, `https://${req.headers.host}/inprogress`);
  res.send(response);
});

// TODO: The right way to do this is to use supabase presence. Stream will set the longest pause, then > 5 secs will trigger a 'go on' message, which this process will check and pop/delete.
app.post("/inprogress", async (req: Request, res: Response) => {
  const response = inprogressVoiceResponse(false, `https://${req.headers.host}/inprogress`);
  res.send(response);
});

app.post("/sms", async (req: Request, res: Response) => {
  const email = await findEmail(req.body.From);
  const response = 
  if (email) {
    
});

console.log("Listening...");
server.listen(3000, () => {
  console.log(`Server is listening on port ${(server.address() as AddressInfo).port}`);
});
