import { describe, expect, test } from "vitest";
import { parseCustomerImportCsv } from "@/domain/export/customer-import";

describe("parseCustomerImportCsv", () => {
  test("parses customers with name and phone", () => {
    const rows = parseCustomerImportCsv(
      "name,phone,address\nClinic A,0700123456,Kabul"
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.name).toBe("Clinic A");
    expect(rows[0]?.phone).toBe("0700123456");
  });

  test("requires name column", () => {
    expect(() => parseCustomerImportCsv("phone\n123")).toThrow(
      "data.import.customers.invalidCsv"
    );
  });
});
