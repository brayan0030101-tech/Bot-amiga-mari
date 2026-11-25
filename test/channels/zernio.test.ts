import { describe, it, expect } from "vitest";
import {
  parseZernioEvents,
  normalizeZernioEvents,
  verifyZernioSignature,
} from "../../src/channels/zernio";

// Payload `message.received` REAL, capturado por Santi (2026-08-07). Campos intactos.
const REAL = {
  id: "07fabf6a-6b9e-43dc-9825-66149010259d",
  event: "message.received",
  message: {
    id: "6a764e50d0fe733d1a1ebfaa",
    conversationId: "6a764dc9d0fe733d1a1ea624",
    platform: "instagram",
    direction: "incoming",
    text: "Hola",
    attachments: [],
    sender: {
      id: "1840258736568891",
      name: "santiago.mnzz",
      username: "santiago.mnzz",
      contactId: "6a764e507e64ca7164096b96",
    },
  },
  account: { id: "6a764dbfd0fe733d1a1ea2c7", accountId: "6a764dbfd0fe733d1a1ea2c7", platform: "instagram" },
  timestamp: "2026-08-07T21:29:52.419Z",
};

describe("zernio · parseZernioEvents", () => {
  it("mapea un message.received real (texto, sender.id, dedup por event id)", () => {
    const [msg] = parseZernioEvents(REAL as any);
    expect(msg.channel).toBe("zernio");
    expect(msg.channelUserId).toBe("1840258736568891"); // sender.id, estable por persona
    expect(msg.displayName).toBe("santiago.mnzz");
    expect(msg.text).toBe("Hola");
    expect(msg.providerMessageId).toBe("07fabf6a-6b9e-43dc-9825-66149010259d"); // event id
    expect(msg.imageUrl).toBeUndefined();
  });

  it("ignora los salientes (echo) y los eventos que no son message.received", () => {
    expect(parseZernioEvents({ ...REAL, event: "message.sent" } as any)).toEqual([]);
    expect(
      parseZernioEvents({ ...REAL, message: { ...REAL.message, direction: "outgoing" } } as any),
    ).toEqual([]);
    expect(parseZernioEvents({ event: "conversation.started" } as any)).toEqual([]);
  });

  it("saca imagen de attachments (mapea por tipo)", () => {
    const withImg = {
      ...REAL,
      message: { ...REAL.message, text: undefined, attachments: [{ type: "image", url: "https://x/y.jpg" }] },
    };
    const [msg] = parseZernioEvents(withImg as any);
    expect(msg.imageUrl).toBe("https://x/y.jpg");
  });
});

describe("zernio · normalizeZernioEvents", () => {
  it("tolera evento suelto, array y {events:[]}", () => {
    expect(normalizeZernioEvents(REAL)).toHaveLength(1);
    expect(normalizeZernioEvents([REAL, REAL])).toHaveLength(2);
    expect(normalizeZernioEvents({ events: [REAL] })).toHaveLength(1);
  });
});

describe("zernio · verifyZernioSignature", () => {
  const secret = "whsec_test";
  const body = JSON.stringify(REAL);

  async function sign(s: string, b: string): Promise<string> {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(s),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(b));
    return [...new Uint8Array(sig)].map((x) => x.toString(16).padStart(2, "0")).join("");
  }

  it("acepta una firma válida", async () => {
    expect(await verifyZernioSignature(body, await sign(secret, body), secret)).toBe(true);
  });
  it("rechaza firma inválida / body alterado", async () => {
    expect(await verifyZernioSignature(body, await sign(secret, body), "otro")).toBe(false);
    expect(await verifyZernioSignature(body + "x", await sign(secret, body), secret)).toBe(false);
  });
  it("fail-closed: sin secret o sin firma → false", async () => {
    expect(await verifyZernioSignature(body, await sign(secret, body), undefined)).toBe(false);
    expect(await verifyZernioSignature(body, null, secret)).toBe(false);
  });
});

describe("zernio · regla de Colombia y botones", () => {
  const wa = (senderId: string, extra: Record<string, unknown> = {}) => ({
    ...REAL,
    message: { ...REAL.message, platform: "whatsapp", sender: { ...REAL.message.sender, id: senderId }, ...extra },
  });

  it("ignora lo que llega de un número de Colombia por WhatsApp", () => {
    expect(parseZernioEvents(wa("573001234567") as any)).toEqual([]);
  });

  it("sí procesa a un cliente de España por WhatsApp", () => {
    const [msg] = parseZernioEvents(wa("34600000011") as any);
    expect(msg.channelUserId).toBe("34600000011");
  });

  it("el toque de un botón sin texto llega como el título (sin el prefijo btn:)", () => {
    const [msg] = parseZernioEvents(wa("34600000011", { text: "", metadata: { interactiveId: "btn:Mañana 10:00" } }) as any);
    expect(msg.text).toBe("Mañana 10:00");
  });
});

describe("zernio · sendReply", () => {
  it("nunca envía a un número de Colombia (ni llama a Zernio)", async () => {
    const { zernioAdapter } = await import("../../src/channels/zernio");
    const calls: string[] = [];
    const orig = globalThis.fetch;
    globalThis.fetch = (async (u: string) => {
      calls.push(String(u));
      return new Response("{}", { status: 200 });
    }) as typeof fetch;
    const env = {
      ZERNIO_API_KEY: "k",
      DB: { prepare: () => ({ bind: () => ({ first: async () => ({ conversation_id: "c1", account_id: "a1", platform: "whatsapp" }), run: async () => ({}), all: async () => ({ results: [] }) }) }) },
    } as any;
    try {
      await zernioAdapter.sendReply({ channel: "zernio", channelUserId: "573001234567", chunks: ["hola"] } as any, env);
      expect(calls).toEqual([]);
      await zernioAdapter.sendReply({ channel: "zernio", channelUserId: "34600000011", chunks: ["mira:https://x.co/a"] } as any, env);
      expect(calls.length).toBe(1);
    } finally {
      globalThis.fetch = orig;
    }
  });
});

describe("zernio · número de Colombia escrito desde el panel", () => {
  it("en modo estricto (una persona desde el panel) avisa que NO salió", async () => {
    const { zernioAdapter } = await import("../../src/channels/zernio");
    const env = {
      ZERNIO_API_KEY: "k",
      DB: { prepare: () => ({ bind: () => ({ first: async () => ({ conversation_id: "c1", account_id: "a1", platform: "whatsapp" }), run: async () => ({}), all: async () => ({ results: [] }) }) }) },
    } as any;
    await expect(
      zernioAdapter.sendReply({ channel: "zernio", channelUserId: "573001234567", chunks: ["hola"] } as any, env, { strict: true }),
    ).rejects.toThrow(/Colombia/);
  });
});
