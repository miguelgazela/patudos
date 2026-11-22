import { describe, expect, it } from "vitest";

import {
  isIOSDevice,
  pushState,
  urlBase64ToUint8Array,
  type PushEnv,
} from "./state";

const base: PushEnv = {
  isIOS: false,
  standalone: false,
  hasPushApi: true,
  permission: "default",
  subscribed: false,
};

describe("pushState", () => {
  it("iPhone no Safari: pede para instalar a app", () => {
    expect(pushState({ ...base, isIOS: true, hasPushApi: false })).toBe(
      "install",
    );
    expect(pushState({ ...base, isIOS: true })).toBe("install");
  });
  it("iPhone com a app instalada e permissão por pedir: pode ativar", () => {
    expect(pushState({ ...base, isIOS: true, standalone: true })).toBe("off");
  });
  it("sem API de push: não suportado", () => {
    expect(pushState({ ...base, hasPushApi: false })).toBe("unsupported");
    expect(
      pushState({ ...base, isIOS: true, standalone: true, hasPushApi: false }),
    ).toBe("unsupported");
  });
  it("permissão recusada", () => {
    expect(pushState({ ...base, permission: "denied" })).toBe("denied");
  });
  it("ativadas só com permissão E subscrição", () => {
    expect(
      pushState({ ...base, permission: "granted", subscribed: true }),
    ).toBe("on");
    expect(
      pushState({ ...base, permission: "granted", subscribed: false }),
    ).toBe("off");
  });
});

describe("isIOSDevice", () => {
  it("iPhone e iPad (incl. iPadOS que se apresenta como Mac)", () => {
    expect(
      isIOSDevice("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)", 5),
    ).toBe(true);
    expect(
      isIOSDevice("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 5),
    ).toBe(true);
    expect(
      isIOSDevice("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 0),
    ).toBe(false);
    expect(isIOSDevice("Mozilla/5.0 (Windows NT 10.0)", 0)).toBe(false);
  });
});

describe("urlBase64ToUint8Array", () => {
  it("descodifica base64url", () => {
    expect(Array.from(urlBase64ToUint8Array("AQID"))).toEqual([1, 2, 3]);
    expect(Array.from(urlBase64ToUint8Array("-_8"))).toEqual([251, 255]);
  });
});
