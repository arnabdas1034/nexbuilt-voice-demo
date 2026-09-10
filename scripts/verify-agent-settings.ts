/**
 * Connects to the Voice Agent socket, sends exactly the Settings our config
 * produces, and reports whether Deepgram accepted them.
 *
 * This validates the voice, the prompt and the function definitions without
 * needing a microphone. Run with:  npm run verify:agent
 */
import WebSocket from "ws";
import { buildAgentConfig } from "../lib/agentConfig.ts";

const AGENT_URL = "wss://agent.deepgram.com/v1/agent/converse";

async function token(): Promise<string> {
  const res = await fetch("https://api.deepgram.com/v1/auth/grant", {
    method: "POST",
    headers: {
      Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ttl_seconds: 60 }),
  });
  if (!res.ok) throw new Error(`auth/grant failed: ${res.status} ${await res.text()}`);
  return (await res.json()).access_token;
}

/** Mirror of the Settings message the SDK builds from the session config. */
function settingsFrom(config: ReturnType<typeof buildAgentConfig>) {
  const audio = config.audio ?? {};
  return {
    type: "Settings",
    tags: config.tags,
    audio: {
      input: { encoding: audio.input?.encoding, sample_rate: audio.input?.sampleRate },
      output: { encoding: audio.output?.encoding, sample_rate: audio.output?.sampleRate },
    },
    agent: config.agent,
  };
}

const accessToken = await token();
const settings = settingsFrom(buildAgentConfig());

const ws = new WebSocket(AGENT_URL, { headers: { Authorization: `Bearer ${accessToken}` } });

const done = new Promise<number>((resolve) => {
  const finish = (code: number, msg: string) => {
    console.log(msg);
    try {
      ws.close();
    } catch {}
    resolve(code);
  };

  const timer = setTimeout(() => finish(1, "FAIL  no response within 15s"), 15_000);

  ws.on("open", () => {
    console.log("socket open, sending Settings…");
    ws.send(JSON.stringify(settings));
  });

  ws.on("message", (raw: Buffer, isBinary: boolean) => {
    // Audio frames arrive as binary; we only care about JSON control messages.
    if (isBinary) return;
    let msg: Record<string, any>;
    try {
      msg = JSON.parse(raw.toString("utf8"));
    } catch {
      return;
    }

    if (msg.type === "SettingsApplied") {
      clearTimeout(timer);
      finish(0, "PASS  SettingsApplied — voice, prompt and functions all accepted");
    }
    if (msg.type === "Error" || msg.type === "Warning") {
      clearTimeout(timer);
      finish(1, `FAIL  ${msg.type}: ${JSON.stringify(msg)}`);
    }
  });

  ws.on("error", (err: Error) => {
    clearTimeout(timer);
    finish(1, `FAIL  socket error: ${err.message}`);
  });
});

process.exit(await done);
