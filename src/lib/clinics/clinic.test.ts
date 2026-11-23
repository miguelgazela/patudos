import { describe, expect, it } from "vitest";

import { clinicDetailsSchema } from "./schema";
import { telHref, visitPlace, whatsappHref } from "./clinic";

describe("telHref", () => {
  it("fica só com dígitos e +", () => {
    expect(telHref("217 000 000")).toBe("tel:217000000");
    expect(telHref("+351 912-345-678")).toBe("tel:+351912345678");
  });
});

describe("whatsappHref", () => {
  it("acrescenta 351 a números portugueses e respeita indicativos", () => {
    expect(whatsappHref("912 345 678")).toBe("https://wa.me/351912345678");
    expect(whatsappHref("217 000 000")).toBe("https://wa.me/351217000000");
    expect(whatsappHref("+44 20 7946 0958")).toBe("https://wa.me/442079460958");
    expect(whatsappHref("00351 912345678")).toBe("https://wa.me/351912345678");
    expect(whatsappHref("123")).toBeNull();
  });
});

describe("visitPlace", () => {
  it("clínica e veterinário antigo, sem repetidos", () => {
    expect(visitPlace("VetLumiar", "Dra. Inês")).toBe("VetLumiar · Dra. Inês");
    expect(visitPlace("VetLumiar", "vetlumiar")).toBe("VetLumiar");
    expect(visitPlace(null, "Dr. Velho", "Clínica A")).toBe(
      "Clínica A · Dr. Velho",
    );
    expect(visitPlace(null, null, null)).toBe("");
  });
});

describe("clinicDetailsSchema", () => {
  it("só o nome é obrigatório", () => {
    const r = clinicDetailsSchema.safeParse({ name: " VetLumiar ", phone: "" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data).toEqual({ name: "VetLumiar", phone: null, address: null });
    }
    expect(clinicDetailsSchema.safeParse({ name: "  " }).success).toBe(false);
  });
});
