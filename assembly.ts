import WebSocket from 'ws';

class Assembly {
    websocket: WebSocket;
    texts: { [key: number]: string; };
    transcription: string;
    bytes: number;
    last_receive: Date;

    constructor() {
        this.websocket = new WebSocket(
            "wss://api.assemblyai.com/v2/realtime/ws?sample_rate=8000",
            { headers: { authorization: process.env.ASSEMBLY_API_KEY ?? '' } }
        );
        this.texts = {};
        this.transcription = "";
        this.bytes = 0;
        this.last_receive = new Date();

        this.websocket.onmessage = (assemblyMsg) => {
            const res = JSON.parse(assemblyMsg.data.toString());
            console.log()
            // console.log("message from assembly");
            // console.log(res);
        
            // Can receive messages out of order
            this.texts[parseInt(res.audio_start)] = res.text;
            const keys: number[] = Object.keys(this.texts).map((key) => parseInt(key));
            keys.sort((a, b) => a - b);
            for (const key of keys) {
                if (this.texts[key]) {
                    console.log(`[${key}] ${this.texts[key]}`);
                    this.transcription += ` ${this.texts[key]}`;
                }
            }
            if (this.bytes < Buffer.byteLength(this.transcription, "utf8")) {
                this.last_receive = new Date();
                this.bytes = Buffer.byteLength(this.transcription, "utf8");
        
                console.log(`${this.last_receive}: ${this.transcription}`)
            }
        };
        this.websocket.onerror = (error) => {
            console.error("Error from assembly")
            console.error(error)
        };
    }

    send(data: string) {
        this.websocket.send(data);
    }
}

export default Assembly;