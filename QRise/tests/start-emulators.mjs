import { execFileSync, spawn } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";

const require = createRequire(import.meta.url);
const globalModules = process.platform === "win32"
  ? execFileSync(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", "npm root -g"], {
      encoding: "utf8",
    }).trim()
  : execFileSync("npm", ["root", "-g"], { encoding: "utf8" }).trim();
const firebasePackagePath = resolve(globalModules, "firebase-tools", "package.json");
const firebasePackage = require(firebasePackagePath);
const firebaseBin = typeof firebasePackage.bin === "string"
  ? firebasePackage.bin
  : firebasePackage.bin.firebase;

if (!firebaseBin) {
  throw new Error(`Firebase CLI entry point not found in ${firebasePackagePath}`);
}

const firebaseCliPath = join(dirname(firebasePackagePath), firebaseBin);
const firebase = spawn(process.execPath, [
  firebaseCliPath,
  "emulators:exec",
  "--only",
  "auth,database",
  "--project",
  "demo-qrise",
  "npm run dev -- --host 127.0.0.1 --strictPort",
], { stdio: "inherit" });

firebase.on("error", (error) => {
  console.error("Failed to start Firebase emulators:", error);
  process.exitCode = 1;
});

firebase.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
