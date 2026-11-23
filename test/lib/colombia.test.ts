import { describe, it, expect } from "vitest";
import { esNumeroColombiano, esColombianoEnZernio } from "../../src/lib/colombia";

describe("regla fija: nunca números de Colombia", () => {
  it("detecta teléfonos +57 con o sin formato", () => {
    expect(esNumeroColombiano("573138804992")).toBe(true);
    expect(esNumeroColombiano("+57 313 880 4992")).toBe(true);
    expect(esNumeroColombiano("57313880499")).toBe(true); // 9 dígitos tras el 57
  });

  it("detecta usuarios de WhatsApp sin teléfono de Colombia (CO.…)", () => {
    expect(esNumeroColombiano("CO.1116478540839589")).toBe(true);
    expect(esNumeroColombiano("ES.4471768933133707")).toBe(false);
  });

  it("no confunde otros países ni ids vacíos", () => {
    expect(esNumeroColombiano("34642781656")).toBe(false);
    expect(esNumeroColombiano("39335484932")).toBe(false);
    expect(esNumeroColombiano("")).toBe(false);
    expect(esNumeroColombiano(undefined)).toBe(false);
  });

  it("por Zernio solo aplica a WhatsApp (en Instagram el id es interno de Meta)", () => {
    expect(esColombianoEnZernio("573138804992", "whatsapp")).toBe(true);
    expect(esColombianoEnZernio("573138804992", "instagram")).toBe(false);
    expect(esColombianoEnZernio("573138804992", null)).toBe(true);
    expect(esColombianoEnZernio("17841400000000001", null)).toBe(false);
  });
});
