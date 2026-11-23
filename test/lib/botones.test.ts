import { describe, it, expect } from "vitest";
import { botonesApagados, AJUSTE_BOTONES } from "../../src/lib/botones";

const envCon = (valor: string | null) =>
  ({
    DB: { prepare: () => ({ bind: () => ({ first: async () => (valor === null ? null : { value: valor }), all: async () => ({ results: [] }), run: async () => ({}) }) }) },
  }) as any;

describe("botones apagables (ajuste bot_botones)", () => {
  it("el ajuste tiene nombre neutro", () => {
    expect(AJUSTE_BOTONES).toBe("bot_botones");
  });
  it("solo «apagado» los quita; sin ajuste siguen", async () => {
    expect(await botonesApagados(envCon("apagado"))).toBe(true);
    expect(await botonesApagados(envCon(" Apagado "))).toBe(true);
    expect(await botonesApagados(envCon(""))).toBe(false);
    expect(await botonesApagados(envCon(null))).toBe(false);
  });
  it("si la base falla, los botones siguen (nunca rompe un envío)", async () => {
    expect(await botonesApagados({ DB: { prepare: () => { throw new Error("x"); } } } as any)).toBe(false);
  });
});
