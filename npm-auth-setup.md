# GitHub PAT (`GH_PAT`) Registry Authentication Setup

This workspace enforces GitHub Personal Access Token (`GH_PAT`) authentication across `npm`, `yarn` (Yarn 4 Berry), Docker BuildKit builds, and GitHub Actions workflows for `@jt-workspace/*` packages via GitHub Packages (`https://npm.pkg.github.com`).

---

## How Enforcement Works

- **Root [`.npmrc`](.npmrc):** Configures `@jt-workspace:registry=https://npm.pkg.github.com`, `//npm.pkg.github.com/:_authToken=${GH_PAT}`, and `always-auth=true` with zero plaintext secrets committed.
- **Root [`.yarnrc.yml`](.yarnrc.yml):** Mirrors the `@jt-workspace` scope under `npmScopes.jt-workspace` (`npmAuthToken: "${GH_PAT:-}"`, `npmAlwaysAuth: true`) because Yarn 4 ignores `.npmrc` auth settings, and registers [`.yarn/plugins/check-gh-pat.cjs`](.yarn/plugins/check-gh-pat.cjs).
- **Guard Script ([`tools/scripts/check-gh-pat.js`](tools/scripts/check-gh-pat.js)):** Zero-dependency Node.js check wired to:
  - `"preinstall"` in [`package.json`](package.json) (blocks `npm install` / `npm ci` when `GH_PAT` is missing or blank).
  - The Yarn 4 `validateProject` plugin hook in [`.yarn/plugins/check-gh-pat.cjs`](.yarn/plugins/check-gh-pat.cjs) (blocks `yarn install` when `GH_PAT` is missing or blank).
- **Git Hygiene ([`.gitignore`](.gitignore)):** Tracks `.npmrc` and `.yarnrc.yml` while ignoring `.npmrc.local` and `.env.npm`.

---

## 1. Create a GitHub Personal Access Token (PAT)

1. Open **GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)** (or generate a fine-grained token with package read access if supported by your org).
2. Select scopes:
   - `read:packages` _(minimum required for installing packages and running local/Docker builds)_
   - `write:packages` _(add only if you publish `@jt-workspace/*` packages to GitHub Packages)_
3. **SAML SSO Organizations:** If your GitHub organization enforces SAML SSO, click **Configure SSO → Authorize** next to the token after creating it.

---

## 2. Configure `GH_PAT` Locally

### Windows (PowerShell — Persistent User Environment Variable)

```powershell
[System.Environment]::SetEnvironmentVariable("GH_PAT", "<your_token>", "User")
```

Restart your terminal/IDE so new shells pick up `GH_PAT`.

For the current PowerShell session only:

```powershell
$env:GH_PAT = "<your_token>"
```

### macOS / Linux (`~/.zshrc` or `~/.bashrc`)

```bash
export GH_PAT="<your_token>"
```

Reload your shell profile (`source ~/.zshrc` or `source ~/.bashrc`).

---

## 3. Docker Builds with BuildKit Secrets

`GH_PAT` is **never** passed via Docker `ARG` or `ENV`, so the token never appears in image layers or `docker history`.

### Using Workspace Script (Recommended)

`yarn docker:build` ([`tools/scripts/docker-runner.mjs`](tools/scripts/docker-runner.mjs)) validates `GH_PAT` and passes `--secret id=gh_pat,env=GH_PAT` automatically:

```sh
yarn docker:build ikagi-api
```

### Direct Docker CLI Build

```bash
DOCKER_BUILDKIT=1 docker build \
  --secret id=gh_pat,env=GH_PAT \
  -f apps/ikagi-api/Dockerfile \
  -t ikagi-api:local \
  .
```

---

## 4. GitHub Actions Configuration

Both [`.github/workflows/ci.yml`](.github/workflows/ci.yml) and [`.github/workflows/_reusable-api-gcp-deploy.yml`](.github/workflows/_reusable-api-gcp-deploy.yml) configure `permissions: packages: read` and inject:

```yaml
GH_PAT: ${{ secrets.GH_PAT || secrets.GITHUB_TOKEN }}
```

- For packages hosted within the same GitHub repository/organization, `GITHUB_TOKEN` works automatically with no extra secret setup.
- If you consume packages from another organization or private repository, add a repository/environment secret named `GH_PAT` in **Settings → Secrets and variables → Actions**.
