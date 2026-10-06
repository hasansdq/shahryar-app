#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
// اجرای سرور production شهریار — مستقل از bun (فقط node)
// ═══════════════════════════════════════════════════════════════
// ترتیب جستجوی بسته:
//  ۱) .next-prod/standalone/server.js  (خروجی build جدا از dev)
//  ۲) .next/standalone/server.js        (اگر با distDir پیش‌فرض build شده)
//
// متغیرها:
//  PORT  (پیش‌فرض 3000) | HOSTNAME (پیش‌فرض 0.0.0.0)
// ═══════════════════════════════════════════════════════════════

import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

const candidates = [
  join(root, ".next-prod", "standalone", "server.js"),
  join(root, ".next", "standalone", "server.js"),
];

const serverJs = candidates.find((p) => existsSync(p));
if (!serverJs) {
  console.error("✗ بسته production پیدا نشد — ابتدا `npm run build` اجرا کنید");
  process.exit(1);
}

const env = {
  ...process.env,
  NODE_ENV: "production",
  PORT: process.env.PORT || "3000",
  HOSTNAME: process.env.HOSTNAME || "0.0.0.0",
};

console.log(`▲ اجرای شهریار (production) از ${serverJs}`);
console.log(`  پورت: ${env.PORT} | Node ${process.version}`);

const child = spawn(process.execPath, [serverJs], {
  env,
  stdio: "inherit",
  cwd: dirname(serverJs),
});

child.on("exit", (code) => process.exit(code ?? 1));
for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    child.kill(sig);
  });
}
