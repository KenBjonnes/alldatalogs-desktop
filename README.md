# BigData for Windows

The [AllDataLogs](https://alldatalogs.com) datalog viewer ("BigData") as a Windows desktop app: double-click a
`.hpl` / `.dl` / `.msl` / `.ld` and it opens, everything runs offline, updates arrive automatically. It is part of
**AllDataLogs Pro**: sign in with your alldatalogs.com account.

## Install

1. Download `BigData-Setup-<version>.exe` from the latest [release](https://github.com/KenBjonnes/alldatalogs-desktop/releases).
2. Run it. Windows SmartScreen may say "Windows protected your PC" because the installer is not yet code-signed:
   click **More info → Run anyway**.
3. Sign in with your AllDataLogs email and password. BigData needs the internet once to activate; after that it
   keeps working offline for up to 30 days between check-ins.

**Opening logs by double-click:** BigData registers as a handler for `.hpl`, `.dl`, `.msl`, `.mlg` and `.ld`. Windows will not
replace an existing default (VCM Scanner, MoTeC i2, Holley EFI); right-click a log → **Open with → BigData** and
tick *Always*. `.csv` is deliberately not associated (that stays with Excel); drag it onto the window instead.

Formats: CSV, HP Tuners `.hpl`, SCT, Haltech and FuelTech CSV exports, Holley `.dl`, MegaSquirt `.msl`, MoTeC `.ld` — up to 250 MB.

## How it is built

The viewer engine is the exact code alldatalogs.com serves; nothing is forked. `payload/` is a generated, committed
mirror of the site's `public/` folder (engine, decoder, vendor libs, parse worker, sample log) with a sha256
manifest, and `scripts/build-payload.mjs --check` fails when it drifts from its sources.

```
main/        Electron main: bigdata:// scheme, file opens, prompt window, licence, Supabase, updater
preload/     the small window.bigdata API the sandboxed renderer gets
renderer/    one page: sign-in / Pro gate / home + the engine host; src/glue.ts is the host logic
payload/     GENERATED — never hand-edit; run scripts/build-payload.mjs
scripts/     build-payload, smoke (Playwright drives the real app), keygen, make-icon, release.ps1
test/        node:test unit tests (licence state machine, token verify, entitlement rule, payload check)
```

### Develop

```
npm install
node scripts/build-payload.mjs        # needs the RELEASE viewer folder + the Alldatalogs repo (see the script header)
set BIGDATA_DEV_PRO=1 && npm start    # Pro forced on, no backend needed (ignored in packaged builds)
npm test                               # unit tests
npm run smoke                          # launches the app with a log and checks 18 things
npm run smoke:license                  # real sign-in with the test account, isolated user-data folder
npm run dist && npm run smoke:packaged # drives dist/win-unpacked/BigData.exe like a customer would
```

Open a log from the command line while developing: `npx electron . "C:\path\to\log.hpl"`. Set
`BIGDATA_USER_DATA=<folder>` to keep session/licence/recents away from your real install.

The repo is byte-exact (`.gitattributes` `* -text`): the payload and the built licensing modules are hashed, so no
line-ending conversion is allowed on any checkout.

### Licence

Sign-in and the licence live in the main process. After sign-in the app asks the `issue-entitlement-token` edge
function for a signed statement of the account's Pro status (ES256; the app holds only the public keys in
`main/entitlement-keys.js`). The token's lifetime is the offline grace: 30 days for an active membership, shorter
when a subscription is winding down. The app refreshes it on launch, every 6 hours, on resume and when the network
comes back. Only a verified "not Pro" answer removes Pro; network trouble never does. A token that expires while
offline leaves the viewer open with Pro features locked until the app can check in. Details:
`docs/LICENSING.md` in the Alldatalogs repo.

Files under `%APPDATA%\BigData\`: `session.bin` (sign-in, encrypted with Windows DPAPI), `license.json` (the token
and clock high-water mark), `install-id`, `recent.json`, plus Chromium's storage for saved layouts.

### Release

```
.\scripts\release.ps1 -Bump patch        # refresh payload → tests → bump → commit → tag → push
```

GitHub Actions builds the installer and publishes it as a release (`release.yml`); the release is the auto-update
feed. The tag must match `package.json`'s version. Installed apps check for updates on launch and every 4 hours and
install on quit.

### Code signing

Unsigned for now (hence the SmartScreen note). To sign: get a certificate (Azure Trusted Signing or an OV
code-signing cert), add `win.signtoolOptions` / `win.azureSignOptions` to `electron-builder.yml` and the secrets to
the repo. Once a signed build has shipped, every later build must also be signed or the updater will refuse it.

### Key rotation

`node scripts/keygen.mjs <kid>` writes a new private key outside the repo and prints the public half. Add the public
key to `main/entitlement-keys.js` (keep the old one), ship, then set `ENTITLEMENT_SIGNING_KEY` /
`ENTITLEMENT_SIGNING_KID` on Supabase to the new pair. Remove the old kid one token-lifetime later.
