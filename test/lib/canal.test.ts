import { describe, it, expect } from "vitest";
import { esWhatsApp, nombreCanal, canalDeConvId } from "../../src/lib/canal";

describe("canal: WhatsApp e Instagram entran los dos por Zernio", () => {
  it("YCloud y los canales de WhatsApp directos son WhatsApp", () => {
    expect(esWhatsApp("ycloud", "34600000011")).toBe(true);
    expect(esWhatsApp("whatsapp", "x")).toBe(true);
  });

  it("Zernio con plataforma conocida: manda la plataforma", () => {
    expect(esWhatsApp("zernio", "34600000011", "whatsapp")).toBe(true);
    expect(esWhatsApp("zernio", "34600000011", "instagram")).toBe(false);
    expect(nombreCanal("zernio", "17841400000000001", "instagram")).toBe("Instagram");
    expect(nombreCanal("zernio", "123", "facebook")).toBe("Messenger");
  });

  it("Zernio sin plataforma: un teléfono (10 a 15 dígitos) es WhatsApp y un id interno de Instagram no", () => {
    expect(esWhatsApp("zernio", "34600000011")).toBe(true); // España
    expect(esWhatsApp("zernio", "573001234567")).toBe(true); // Colombia
    expect(esWhatsApp("zernio", "+34600000011")).toBe(true);
    expect(esWhatsApp("zernio", "17841400000000001")).toBe(false); // 17 dígitos: id de Instagram
    expect(esWhatsApp("zernio", "1840258736568891")).toBe(false); // 16 dígitos
    expect(esWhatsApp("zernio", "00000001")).toBe(false);
    expect(nombreCanal("zernio", "34600000011")).toBe("WhatsApp");
    expect(nombreCanal("zernio", "17841400000000001")).toBe("Instagram");
  });

  it("otros canales y ids de conversación", () => {
    expect(esWhatsApp("telegram", "34600000011")).toBe(false);
    expect(nombreCanal("telegram", "1")).toBe("Telegram");
    expect(canalDeConvId("zernio:34600000011")).toBe("WhatsApp");
    expect(canalDeConvId("zernio:17841400000000001")).toBe("Instagram");
    expect(canalDeConvId("ycloud:34600000011")).toBe("WhatsApp");
    expect(canalDeConvId("rarisimo:1")).toBe("Otro");
    expect(canalDeConvId("sin-dos-puntos")).toBe("Otro");
  });
});
