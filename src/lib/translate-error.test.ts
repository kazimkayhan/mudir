import { describe, expect, test } from "vitest";
import { translate } from "@/i18n";
import { translateError } from "@/lib/translate-error";

describe("translateError", () => {
  test("maps validation keys", () => {
    const t = (key: Parameters<typeof translate>[1]) => translate("en", key);
    expect(translateError(t, "validation.nameRequired")).toBe(
      "Name is required"
    );
    expect(translateError(t, "common.db.tauriOnly")).toContain("desktop app");
  });

  test("returns raw message when not a key", () => {
    const t = (key: Parameters<typeof translate>[1]) => translate("en", key);
    expect(translateError(t, "Something broke")).toBe("Something broke");
  });
});
