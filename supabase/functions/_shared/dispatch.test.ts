// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import type { ClaimedReminder } from "./content.ts";
import {
  dispatchReminders,
  type DispatchDeps,
  type Subscription,
} from "./dispatch.ts";

const NOW = new Date("2026-12-21T10:00:00Z");

function item(over: Partial<ClaimedReminder> = {}): ClaimedReminder {
  return {
    occurrence_id: "occ-1",
    pet_id: "pet-1",
    pet_name: "Nina",
    title: "Desparasitação externa",
    scheduled_for: "2026-12-21T09:00:00Z",
    source_type: "health_event",
    push: true,
    email: true,
    last: null,
    dose: null,
    recipients: [
      { user_id: "u1", email: "u1@x.pt", name: "Pedro" },
      { user_id: "u2", email: "u2@x.pt", name: "Mãe" },
    ],
    ...over,
  };
}

const sub = (id: string, user: string): Subscription => ({
  id,
  user_id: user,
  endpoint: `https://push.test/${id}`,
  p256dh: "p",
  auth: "a",
});

type Fn = ReturnType<typeof vi.fn>;
type Deps = DispatchDeps & {
  sendPush: Fn;
  sendEmail: Fn;
  subscriptionsFor: Fn;
  deleteSubscription: Fn;
  touchSubscription: Fn;
  release: Fn;
};

function deps(over: Partial<DispatchDeps> = {}): Deps {
  const d = {
    appUrl: "https://app.test",
    now: () => NOW,
    subscriptionsFor: vi.fn(async () => [sub("s1", "u1"), sub("s2", "u2")]),
    sendPush: vi.fn(async () => ({ ok: true, status: 201, gone: false })),
    sendEmail: vi.fn(async () => {}),
    deleteSubscription: vi.fn(async () => {}),
    touchSubscription: vi.fn(async () => {}),
    release: vi.fn(async () => {}),
    ...over,
  };
  return d as unknown as Deps;
}

describe("dispatchReminders", () => {
  it("envia push a cada subscrição e email a cada membro", async () => {
    const d = deps();
    const stats = await dispatchReminders([item()], d);
    expect(d.subscriptionsFor).toHaveBeenCalledWith(["u1", "u2"]);
    expect(d.sendPush).toHaveBeenCalledTimes(2);
    expect(d.sendEmail).toHaveBeenCalledTimes(2);
    expect(d.sendEmail.mock.calls.map((c) => c[0])).toEqual([
      "u1@x.pt",
      "u2@x.pt",
    ]);
    expect(d.touchSubscription).toHaveBeenCalledTimes(2);
    expect(stats).toMatchObject({
      occurrences: 1,
      pushSent: 2,
      emailSent: 2,
      released: 0,
    });
    expect(d.release).not.toHaveBeenCalled();
  });

  it("só envia os canais reclamados", async () => {
    const d = deps();
    await dispatchReminders([item({ push: false })], d);
    expect(d.sendPush).not.toHaveBeenCalled();
    expect(d.sendEmail).toHaveBeenCalledTimes(2);
    const d2 = deps();
    await dispatchReminders([item({ email: false })], d2);
    expect(d2.sendEmail).not.toHaveBeenCalled();
    expect(d2.sendPush).toHaveBeenCalledTimes(2);
  });

  it("o payload do push leva o id da ocorrência", async () => {
    const d = deps();
    await dispatchReminders([item()], d);
    const payload = d.sendPush.mock.calls[0]![1];
    expect(payload).toMatchObject({
      title: "Nina · Desparasitação externa",
      url: "/?ocorrencia=occ-1",
    });
  });

  it("404/410 apaga a subscrição e não conta como falha", async () => {
    const d = deps({
      sendPush: vi.fn(async (s: Subscription) =>
        s.id === "s1"
          ? { ok: false, status: 410, gone: true }
          : { ok: true, status: 201, gone: false },
      ),
    });
    const stats = await dispatchReminders([item({ email: false })], d);
    expect(d.deleteSubscription).toHaveBeenCalledWith("s1");
    expect(stats).toMatchObject({
      pushRemoved: 1,
      pushSent: 1,
      pushFailed: 0,
      released: 0,
    });
  });

  it("falha total temporária do push devolve o claim", async () => {
    const d = deps({
      sendPush: vi.fn(async () => ({ ok: false, status: 503, gone: false })),
    });
    const stats = await dispatchReminders([item({ email: false })], d);
    expect(d.release).toHaveBeenCalledWith("occ-1", "push");
    expect(stats).toMatchObject({ pushFailed: 2, released: 1 });
  });

  it("excepção de rede conta como falha temporária", async () => {
    const d = deps({
      sendPush: vi.fn(async () => {
        throw new Error("rede");
      }),
    });
    await dispatchReminders([item({ email: false })], d);
    expect(d.release).toHaveBeenCalledWith("occ-1", "push");
  });

  it("todas as subscrições mortas: não devolve o claim", async () => {
    const d = deps({
      sendPush: vi.fn(async () => ({ ok: false, status: 404, gone: true })),
    });
    await dispatchReminders([item({ email: false })], d);
    expect(d.release).not.toHaveBeenCalled();
  });

  it("sem subscrições: nada a enviar nem a devolver", async () => {
    const d = deps({ subscriptionsFor: vi.fn(async () => []) });
    await dispatchReminders([item({ email: false })], d);
    expect(d.sendPush).not.toHaveBeenCalled();
    expect(d.release).not.toHaveBeenCalled();
  });

  it("email: se algum chegar, não devolve; se nenhum, devolve", async () => {
    const some = deps({
      sendEmail: vi.fn(async (to: string) => {
        if (to === "u1@x.pt") throw new Error("x");
      }),
    });
    const s1 = await dispatchReminders([item({ push: false })], some);
    expect(some.release).not.toHaveBeenCalled();
    expect(s1).toMatchObject({ emailSent: 1, emailFailed: 1 });

    const none = deps({
      sendEmail: vi.fn(async () => {
        throw new Error("x");
      }),
    });
    await dispatchReminders([item({ push: false })], none);
    expect(none.release).toHaveBeenCalledWith("occ-1", "email");
  });

  it("sem transporte de email devolve o claim (não perde o lembrete)", async () => {
    const d = deps({ sendEmail: null });
    await dispatchReminders([item({ push: false })], d);
    expect(d.release).toHaveBeenCalledWith("occ-1", "email");
  });

  it("anti-spam: medicação sem email reclamado não envia emails", async () => {
    const d = deps();
    await dispatchReminders(
      [item({ source_type: "medication", email: false })],
      d,
    );
    expect(d.sendEmail).not.toHaveBeenCalled();
    expect(d.sendPush).toHaveBeenCalledTimes(2);
  });

  it("o email vai só para quem tem notify (a lista de destinatários já vem filtrada) e escapa o conteúdo", async () => {
    const d = deps();
    await dispatchReminders(
      [
        item({
          push: false,
          pet_name: "<b>Nina</b>",
          recipients: [{ user_id: "u1", email: "u1@x.pt", name: null }],
        }),
      ],
      d,
    );
    expect(d.sendEmail).toHaveBeenCalledTimes(1);
    expect(d.sendEmail.mock.calls[0]![1].html).toContain(
      "&lt;b&gt;Nina&lt;/b&gt;",
    );
  });
});
