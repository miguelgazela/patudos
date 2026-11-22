import { defineConfig, devices } from "@playwright/test";

const port = 3100;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: `http://localhost:${port}`,
    trace: "on-first-retry",
  },
  projects: [{ name: "iPhone", use: { ...devices["iPhone 15"] } }],
  webServer: {
    command: `npm run build && npx next start -p ${port}`,
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    // Os convites saem para o Mailpit local (nunca para o Resend).
    env: {
      MAILPIT_URL: process.env.MAILPIT_URL ?? "http://127.0.0.1:55324",
      // Só a chave PÚBLICA VAPID (de desenvolvimento): o ecrã de notificações precisa dela no build.
      NEXT_PUBLIC_VAPID_PUBLIC_KEY:
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ??
        "BGgoeU-WvNwrkyUN-c3cJuvB5RrXQFHjYlfB9m1hYvaiiJQAgMvef0F8pMqY3pE4eCKaFcN0u0bOUgTfIZrPX9Q",
    },
  },
});
