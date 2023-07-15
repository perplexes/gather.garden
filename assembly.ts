import WebSocket from 'ws';

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class Assembly {
  websocket: WebSocket;
  texts: { [key: number]: string; };
  transcription: string;
  keys_received: number;
  last_receive: Date;

  constructor() {
    this.websocket = new WebSocket(
      "wss://api.assemblyai.com/v2/realtime/ws?sample_rate=8000",
      { headers: { authorization: process.env.ASSEMBLY_API_KEY ?? '' } }
    );
    this.texts = {};
    this.transcription = "";
    this.keys_received = 0;
    this.last_receive = new Date();

    this.websocket.onmessage = (assemblyMsg) => {
      const res = JSON.parse(assemblyMsg.data.toString());

      // Can receive messages out of order
      this.texts[parseInt(res.audio_start)] = res.text;
      const keys: number[] = Object.keys(this.texts).map((key) => parseInt(key));
      keys.sort((a, b) => a - b);
      if (this.keys_received < keys.length) {
        this.last_receive = new Date();
        this.keys_received = keys.length;

        console.log(this.texts);
        keys.map((key) => { this.texts[key] }).join(' ');
        let values = [];
        for (const key of keys) {
          if (this.texts[key]) {
            values.push(this.texts[key]);
          }
        }
        this.transcription = values.join(' ');

        console.log(`${this.last_receive}: ${this.transcription}`)
      }
    };
    this.websocket.onerror = (error) => {
      console.error("Error from assembly")
      console.error(error)
    };
  }

  async waitToOpen() {
    while (this.websocket.readyState !== WebSocket.OPEN) {
      await sleep(1000);
    }
  }

  async waitToSettle() {
    await sleep(10000);
  }

  async terminate() {
    await this.waitToSettle();
    this.websocket.send(JSON.stringify({ terminate_session: true }));
  }

  isOpen() {
    return this.websocket.readyState === WebSocket.OPEN;
  }

  send(data: string) {
    this.websocket.send(data);
  }
}

export default Assembly;