import express, { Request, Response } from "express";
import { WebSocketServer } from "ws";
import http from "http";
import { Server } from 'http';

import { findEmail, updateEmail } from "./persistence";
import { sendMessage, welcomeVoiceResponse, inprogressVoiceResponse, setEmailMessageResponse } from "./twilio";
import handleConnection from "./handleConnection";

const app = express();
app.use(express.urlencoded({ extended: false }));

const server: Server = http.createServer(app);
const wss = new WebSocketServer({ server });

wss.on("connection", handleConnection);

app.get("/", (_, res: Response) => res.send("Twilio Live Stream App"));

// Remember to define types for `req.body` if you have specific interface in mind
app.post("/", async (req: Request, res: Response) => {
    const email = await findEmail(req.body.From);
    if (!email) {
        sendMessage(req.body.From, "Thanks for trying out Gather Garden. What's your email address so I can send your ideas to it?");
    }

    const response = welcomeVoiceResponse(req.body.From, req.body.To, email, `wss://${req.headers.host}`, `https://${req.headers.host}/inprogress`);
    res.send(response);
});

// TODO: The right way to do this is to use supabase presence. Stream will set the longest pause, then > 5 secs will trigger a 'go on' message, which this process will check and pop/delete.
app.post("/inprogress", async (req: Request, res: Response) => {
    const response = inprogressVoiceResponse(false, `https://${req.headers.host}/inprogress`);
    res.send(response);
});

app.post("/sms", async (req: Request, res: Response) => {
    const oldEmail = await findEmail(req.body.From);
    const newEmail = req.body.Body;
    const phone = req.body.From;

    await updateEmail(phone, oldEmail, newEmail);
    const response = setEmailMessageResponse(req.body.From, newEmail, oldEmail);
    res.send(response);
});

export default server;