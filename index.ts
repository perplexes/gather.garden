// https://raw.githubusercontent.com/AssemblyAI/twilio-realtime-tutorial/master/transcribe.ts
import { AddressInfo } from 'net'
import server from "./express";

console.log("Listening...");
server.listen(3000, () => {
  console.log(`Server is listening on port ${(server.address() as AddressInfo).port}`);
});
