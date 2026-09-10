# Code signing BigData for Windows

The installer is signed with **Azure Trusted Signing**: Microsoft validates the publisher identity once,
then issues short-lived certificates that CI uses to sign each build. No USB token, no certificate file to
guard, nothing that expires in the middle of a release. Cost at the time of writing is about $10/month on
the Basic tier (5,000 signatures a month — a release uses 3).

The build already supports it. Nothing is signed until the four repository variables and three secrets
below exist; while they are missing, CI builds exactly the unsigned installer it always did and prints an
"Unsigned build" warning.

---

## Part 1 — what Ken does in Azure (once)

These steps need the Azure portal and, for identity validation, documents about the business. They cannot
be automated, and the credentials must never be pasted into a chat or a file in this repo.

1. **Register the provider.** Azure portal → Subscriptions → your subscription → Resource providers →
   search `Microsoft.CodeSigning` → Register.

2. **Create a Trusted Signing account.** Portal → Create a resource → search "Trusted Signing" →
   Create. Trusted Signing is only offered in a handful of regions; pick whichever the portal offers
   nearest you (East US, West US 3, West Central US, North Europe and West Europe are the usual list).
   Note the account **name** and the **endpoint** it shows, which looks like
   `https://eus.codesigning.azure.net` and must match the region you chose.

3. **Give yourself the verifier role.** On the Trusted Signing account → Access control (IAM) → Add role
   assignment → **Trusted Signing Identity Verifier** → your own user. Identity validation is invisible
   without it.

4. **Start identity validation.** On the account → Identity validation → New. Choose:
   - **Organization** if the certificate should say the business name (this is what users see in the
     Windows "verified publisher" line, so it is the better choice). Microsoft checks the legal name and
     address against public records. The published rule is that the entity must have existed for **three
     years or more**; a younger business can still pass but needs extra documentation, so expect
     back-and-forth if Palm Beach Dyno's registration is newer than that.
   - **Individual** otherwise. It validates against government ID, and the certificate then carries your
     personal name.

   Whatever name is approved becomes the certificate's subject exactly, character for character. Approval
   typically takes a few business days.

5. **Create a certificate profile.** Once validation shows Completed: account → Certificate profiles →
   New → type **Public Trust** → pick the completed identity → give it a name. Note the **profile name**.

6. **Create the CI identity.** Entra ID → App registrations → New registration (name it something like
   `bigdata-release-signing`, single tenant, no redirect URI). From its Overview copy the
   **Application (client) ID** and **Directory (tenant) ID**. Then Certificates & secrets → New client
   secret → copy the **value** immediately (it is shown once). Secrets last at most 24 months, so put a
   reminder in the calendar to rotate it.

7. **Let that identity sign.** Trusted Signing account → Access control (IAM) → Add role assignment →
   **Trusted Signing Certificate Profile Signer** → assign to the app registration from step 6. Scope it
   to the account (or to the single certificate profile if you prefer).

## Part 2 — what goes into GitHub

In `KenBjonnes/alldatalogs-desktop` → Settings → Secrets and variables → Actions.

**Secrets** (tab "Secrets"). Paste these yourself; they are credentials.

| Secret | Value |
| --- | --- |
| `AZURE_TENANT_ID` | Directory (tenant) ID from step 6 |
| `AZURE_CLIENT_ID` | Application (client) ID from step 6 |
| `AZURE_CLIENT_SECRET` | The client secret value from step 6 |

**Variables** (tab "Variables"). Not secret — these can be sent over and set for you.

| Variable | Value | Example |
| --- | --- | --- |
| `TRUSTED_SIGNING_ENDPOINT` | The account endpoint from step 2 | `https://eus.codesigning.azure.net` |
| `TRUSTED_SIGNING_ACCOUNT` | Trusted Signing account name | `adl-signing` |
| `TRUSTED_SIGNING_PROFILE` | Certificate profile name from step 5 | `adl-public-trust` |
| `TRUSTED_SIGNING_PUBLISHER` | The approved name, **exactly** as the certificate carries it | `Palm Beach Dyno, Inc.` |

Or skip the GitHub UI for these four: `.\scripts\set-signing-vars.ps1 -Endpoint ... -Account ... -ProfileName
... -Publisher ...` sets all four in one shot via `gh variable set` (requires `gh auth login` once). It
deliberately never touches the three secrets above — those still get pasted into GitHub's Secrets tab by
hand, same as any credential.

`TRUSTED_SIGNING_PUBLISHER` is the one that bites. It has to equal the certificate's `CN`, including
punctuation and any suffix like `, Inc.`, because auto-update compares them. CI checks this on every
signed build and fails the release rather than shipping a mismatch.

## Part 3 — releasing

Nothing changes: `.\scripts\release.ps1 -Bump patch`. The release workflow then

1. builds with `azureSignOptions`, which makes electron-builder install the `TrustedSigning` PowerShell
   module and sign the app exe, the installer and the uninstaller, each timestamped by
   `http://timestamp.acs.microsoft.com`;
2. asserts the installer's signature is Valid, that its certificate CN matches
   `TRUSTED_SIGNING_PUBLISHER`, and that the same name reached `app-update.yml`;
3. publishes the release, whose notes now say who signed it instead of pointing at the SmartScreen note.

**After the first signed release**, download the installer and check Properties → Digital Signatures shows
the publisher, then update the README's SmartScreen paragraph.

## What this does and does not fix

- The UAC and "Windows protected your PC" screens change from an unknown publisher to your name. Trusted
  Signing certificates are organisation-validated, not EV, so SmartScreen still builds reputation from
  download volume: the warning can persist for a while on a brand-new certificate and then stops. Signing
  is what starts that clock.
- Existing unsigned installs update to the first signed build without complaint (electron-updater skips
  verification when the installed app's `app-update.yml` has no publisher name). Verification is live from
  the first signed version onwards, which is why the two CI assertions exist.
- **Never publish an unsigned build after a signed one.** Installed apps would reject it and stop updating.
  That is also why the workflow warns loudly instead of silently building unsigned.
- Certificates are short-lived by design and renewed per signature, so there is no yearly certificate
  scramble. The only expiring thing is the client secret from step 6.
