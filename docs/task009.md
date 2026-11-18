# Task: Initialize GCP-Ready Release Deployment Workflow for `ikag-api` (Dry-Run / Assumed Infrastructure Mode)

## Context

- **Workspace Root:** `D:\Development\Projects\jt-workspace` (Nx monorepo containing shared library `libs/nest-lib` and applications `apps/ikag-api` and `apps/ikag-web`).

- **Target Application:** `apps/ikag-api` (`APP_NAME=ikag-api`), packaged using the shared multi-stage root `/Dockerfile` (`node:20-alpine`).

- **Infrastructure State:** No live GCP project, Artifact Registry repository, Cloud Run service, or Workload Identity Federation (WIF) pool is provisioned yet.
- **Execution Mode (`GCP_DEPLOY_ENABLED` toggle):** The workflow executes real CI verification (`nx build nest-lib`, `nx build ikag-api`, and `docker build --build-arg APP_NAME=ikag-api ...`) on every `ikag-api` release merge right now, while the GCP steps (Workload Identity auth, Artifact Registry image push, and Cloud Run deploy) run in **assumed/dry-run mode** (printing exact target commands and image tags) until `vars.GCP_DEPLOY_ENABLED == 'true'` is flipped.
- **GCP Target Architecture (Implicit Defaults — Easy to Swap Later):**
- **Container Registry:** Google Artifact Registry (`<GCP_REGION>-docker.pkg.dev/<GCP_PROJECT_ID>/<GCP_REPO_NAME>/ikag-api:<SHA_AND_LATEST>`)
- **Compute Target:** Google Cloud Run (`gcloud run deploy ikag-api`, port `3000`, managed serverless container)
- **Authentication:** Keyless OIDC via `google-github-actions/auth@v2` (Workload Identity Federation—no long-lived JSON service account keys)

---

## Objective 1: Create GCP-Tailored Release Workflow (`/.github/workflows/ikag-api-release.yml`)

Configure a dedicated workflow that fires exclusively when a release PR touching `apps/ikag-api/**` (or `libs/nest-lib/**`) is merged, validating the production Docker build today and standing ready for GCP Artifact Registry + Cloud Run rollout.

### Requirements:

1. **Configure Strict `ikag-api` Release Merge Triggers (`/.github/workflows/ikag-api-release.yml`):**

- Set top-level `name: ikag-api-release`.
- Trigger on `pull_request: types: [closed]` targeting `release` (and `'releases/**'`), filtered strictly to `apps/ikag-api/**`, `libs/nest-lib/**`, `/Dockerfile`, root manifests (`package.json`, lockfile, `nx.json`, `tsconfig.base.json`), and `.github/workflows/ikag-api-release.yml`:

```yaml
name: ikag-api-release

on:
  pull_request:
    types: [closed]
    branches:
      - release
      - 'releases/**'
    paths:
      - 'apps/ikag-api/**'
      - 'libs/nest-lib/**'
      - 'Dockerfile'
      - 'package.json'
      - 'package-lock.json'
      - 'tsconfig.base.json'
      - 'nx.json'
      - '.github/workflows/ikag-api-release.yml'

concurrency:
  group: ikag-api-release-${{ github.ref }}
  cancel-in-progress: false
```

- _(Note: If your release flow merges `release/*` branches into `main`, set `branches: [main]` and append `&& startsWith(github.head_ref, 'release/')` to the job `if:` condition)._

2. **Define Placeholder-Safe GCP Environment Variables at Workflow Top Level:**

- Provide sensible assumed defaults using fallback expressions so the workflow never fails on missing GitHub variables before GCP is created:

```yaml
env:
  APP_NAME: ikag-api
  GCP_PROJECT_ID: ${{ vars.GCP_PROJECT_ID || 'ikag-prod-placeholder' }}
  GCP_REGION: ${{ vars.GCP_REGION || 'asia-southeast1' }}
  GCP_AR_REPO: ${{ vars.GCP_AR_REPO || 'ikag-docker-repo' }}
  GCP_CLOUD_RUN_SERVICE: ${{ vars.GCP_CLOUD_RUN_SERVICE || 'ikag-api' }}
```

3. **Configure `build-and-verify` Job (Runs Live Today):**

- Guard with `if: github.event.pull_request.merged == true`.
- Execute `actions/checkout@v4` (`fetch-depth: 0`), `actions/setup-node@v4` (Node `20` with dependency cache), `npm ci`, `npx nx build nest-lib`, and `npx nx build ikag-api`.

- Compute canonical Artifact Registry image URI in step outputs:
  `IMAGE_URI="${GCP_REGION}-docker.pkg.dev/${GCP_PROJECT_ID}/${GCP_AR_REPO}/${APP_NAME}:${GITHUB_SHA}"`
- Build and tag the Docker image locally on the runner using the workspace `/Dockerfile` (`docker build --build-arg APP_NAME=ikag-api -t "$IMAGE_URI" -f Dockerfile .`) to guarantee container packaging succeeds on every release merge.

---

## Objective 2: Wire Assumed vs. Live GCP Deployment Job (`deploy-gcp`)

Add a downstream `deploy-gcp` job configured for GCP Artifact Registry and Cloud Run that executes a clear dry-run simulation while GCP infrastructure does not exist, and switches to live deployment via a single repository variable.

### Requirements:

1. **Configure `deploy-gcp` Job Metadata & Permissions:**

- Set `needs: build-and-verify` and `if: github.event.pull_request.merged == true`.
- Set `permissions: { contents: read, id-token: write }` (required for GCP Workload Identity Federation OIDC token exchange).
- Reference `environment: production-gcp` (allows attaching GCP secrets and approval gates later without changing YAML).

2. **Add Dry-Run / Assumed GCP Step (`if: vars.GCP_DEPLOY_ENABLED != 'true'`):**

- When `GCP_DEPLOY_ENABLED` is unset or `'false'`, log the resolved `IMAGE_URI`, target region (`GCP_REGION`), Cloud Run service (`GCP_CLOUD_RUN_SERVICE`), and exact `docker push` / `gcloud run deploy` commands that _would_ run, exiting `0` cleanly so release merges succeed with green status checks before GCP exists.

3. **Add Live GCP Deployment Steps (`if: vars.GCP_DEPLOY_ENABLED == 'true'`):**

- **Authenticate via Workload Identity Federation:** `google-github-actions/auth@v2` using `workload_identity_provider: ${{ secrets.GCP_WORKLOAD_IDENTITY_PROVIDER }}` and `service_account: ${{ secrets.GCP_SERVICE_ACCOUNT }}`.
- **Configure Google Cloud CLI & Docker Auth:** `google-github-actions/setup-gcloud@v2` followed by `gcloud auth configure-docker ${{ env.GCP_REGION }}-docker.pkg.dev --quiet`.
- **Push Image to Artifact Registry:** Re-build or load the verified image and push both `:${{ github.sha }}` and `:latest` tags to `${{ env.GCP_REGION }}-docker.pkg.dev/${{ env.GCP_PROJECT_ID }}/${{ env.GCP_AR_REPO }}/ikag-api`.
- **Deploy to Cloud Run:**

```bash
gcloud run deploy "${{ env.GCP_CLOUD_RUN_SERVICE }}" \
  --image "${{ env.GCP_REGION }}-docker.pkg.dev/${{ env.GCP_PROJECT_ID }}/${{ env.GCP_AR_REPO }}/ikag-api:${{ github.sha }}" \
  --region "${{ env.GCP_REGION }}" \
  --platform managed \
  --port 3000 \
  --allow-unauthenticated

```

- **Edge-Case Handling (Runtime Secrets & Cold Start):** Add a comment/placeholder in the `gcloud run deploy` command for `--set-secrets` / `--update-env-vars` (e.g., `DATABASE_URL`, `REDIS_HOST`, `JWT_SECRET`) and note that Cloud Run injects `$PORT` (default `8080` unless `--port 3000` is specified—passing `--port 3000` aligns with `apps/ikag-api` and `/Dockerfile` without requiring code changes).

---

## Objective 3: Prepare GCP Onboarding Checklist & Verify Workflow Execution

Document the exact GitHub Variables/Secrets required when GCP is eventually provisioned and validate workflow behavior immediately.

### Requirements:

1. **Document GCP Activation Inputs (`/docs/ci-cd-gcp.md` or `/README.md`):**

- List the GitHub Actions **Variables** (`GCP_DEPLOY_ENABLED`, `GCP_PROJECT_ID`, `GCP_REGION`, `GCP_AR_REPO`, `GCP_CLOUD_RUN_SERVICE`) and **Secrets** (`GCP_WORKLOAD_IDENTITY_PROVIDER`, `GCP_SERVICE_ACCOUNT`) needed when activating live deployments.
- Note that `ikag-api-release` must **not** be added as a required branch protection check because path filtering skips it on `ikag-web`-only merges.

2. **Verify Local & PR Merge Behavior:**

- Validate `/.github/workflows/ikag-api-release.yml` syntax (e.g., `actionlint` or GitHub Actions tab).
- Merge a test release PR modifying `apps/ikag-api/` -> verify `build-and-verify` builds `nest-lib`, `ikag-api`, and the Docker image, and `deploy-gcp` outputs the assumed GCP Artifact Registry / Cloud Run deployment plan cleanly.

- Merge a test release PR modifying only `apps/ikag-web/` -> verify `ikag-api-release` does **not** trigger.

---

## Expected Deliverables

1. **GCP Release Workflow (`/.github/workflows/ikag-api-release.yml`):**

- Complete workflow triggered exclusively on merged release PRs touching `apps/ikag-api/**` or `libs/nest-lib/**`, running live Nx + Docker verification and a toggleable GCP Artifact Registry + Cloud Run deployment pipeline (`GCP_DEPLOY_ENABLED`).

2. **GCP Onboarding Documentation (`/docs/ci-cd-gcp.md` or `/README.md`):**

- Reference table of GitHub Variables (`GCP_PROJECT_ID`, `GCP_REGION`, `GCP_AR_REPO`, `GCP_CLOUD_RUN_SERVICE`, `GCP_DEPLOY_ENABLED`) and WIF Secrets (`GCP_WORKLOAD_IDENTITY_PROVIDER`, `GCP_SERVICE_ACCOUNT`) to populate once GCP is provisioned.

3. **Verification Results:**

- Passing run on `apps/ikag-api` release merge showing successful Docker image build (`APP_NAME=ikag-api`) and assumed GCP deployment dry-run output.

- Confirmed skip on `apps/ikag-web`-only release merges and unmerged closed PRs.
