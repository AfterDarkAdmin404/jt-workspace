# GCP Deployment Guide (Per-App Yarn APIs)

The reusable deployment workflow at [`.github/workflows/_reusable-api-gcp-deploy.yml`](.github/workflows/_reusable-api-gcp-deploy.yml) centralizes Yarn 4 / Nx builds, dedicated per-app `Dockerfile` verification from the workspace root, and skippable GCP Artifact Registry + Cloud Run deployment.

Per-app caller workflows (starting with [`.github/workflows/ikagi-api-deploy.yml`](.github/workflows/ikagi-api-deploy.yml)) trigger only when changes affecting that API or its shared dependencies are merged into `staging` or `production`.

---

## Trigger & Branch Behavior (`ikagi-api-deploy`)

| Event                                                                                                                              | Outcome                                                                                  |
| :--------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------- |
| Push / merged PR to `staging` or `production` touching `apps/ikagi-api/**`, `libs/nest-lib/**`, or root workspace/workflow configs | Runs `build-and-verify` and `deploy-gcp` (targeted at `staging-gcp` or `production-gcp`) |
| Push / merged PR to `staging` or `production` touching only unrelated apps (e.g., `apps/ikagi-web/**`)                             | **Skipped** (path filter does not match)                                                 |
| Closed PR that was **not** merged                                                                                                  | **Ignored** (`on: push` only fires on commits actually merged to the target branch)      |

> **Important (Branch Protection):** Do **not** add `ikagi-api-deploy` (or any `<name>-api-deploy` workflow) as a Required Status Check in GitHub branch protection rules, because path-filtered workflows are intentionally skipped when unrelated apps change.

---

## GitHub Environments Setup

In GitHub **Settings → Environments**, create the following two environments:

1. `staging-gcp`
2. `production-gcp` _(recommended: enable **Required reviewers** before production deployments)_

Keep `GCP_DEPLOY_ENABLED` unset (or `'false'`) in both environments until GCP infrastructure is provisioned.

---

## Required Variables & Secrets (Per Environment)

Configure these under **Settings → Environments → `<env>`** (or at the repository level under **Settings → Secrets and variables → Actions**):

### Variables

| Name                    | Default / Fallback        | Description                                                                                                                              |
| :---------------------- | :------------------------ | :--------------------------------------------------------------------------------------------------------------------------------------- |
| `GCP_DEPLOY_ENABLED`    | _(unset / `'false'`)_     | Set to `'true'` to switch `deploy-gcp` from dry-run notice mode to live GCP authentication, Artifact Registry push, and Cloud Run deploy |
| `GCP_PROJECT_ID`        | `placeholder-gcp-project` | Target GCP project ID                                                                                                                    |
| `GCP_REGION`            | `asia-southeast1`         | Artifact Registry and Cloud Run region                                                                                                   |
| `GCP_AR_REPO`           | `api-docker-repo`         | Artifact Registry Docker repository name                                                                                                 |
| `GCP_CLOUD_RUN_SERVICE` | `<app_name>-<branch>`     | Optional override for the Cloud Run service name (defaults to `ikagi-api-staging` or `ikagi-api-production`)                             |

### Secrets (Required for Live Mode)

| Name                             | Description                                                                                                                                               |
| :------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | Full Workload Identity Federation provider resource name (`projects/<PROJECT_NUMBER>/locations/global/workloadIdentityPools/<POOL>/providers/<PROVIDER>`) |
| `GCP_SERVICE_ACCOUNT`            | Service account email with `roles/artifactregistry.writer`, `roles/run.admin`, and `roles/iam.serviceAccountUser`                                         |

---

## Reusable Workflow Inputs (`_reusable-api-gcp-deploy.yml`)

| Input                   | Type      | Required | Default           | Description                                                                                |
| :---------------------- | :-------- | :------- | :---------------- | :----------------------------------------------------------------------------------------- |
| `app_name`              | `string`  | Yes      | —                 | App folder name under `apps/` (e.g., `ikagi-api`) and Artifact Registry image name         |
| `dockerfile_path`       | `string`  | Yes      | —                 | Path to the dedicated Dockerfile relative to workspace root                                |
| `nx_project`            | `string`  | No       | `@org/<app_name>` | Nx project name passed to `yarn nx build`                                                  |
| `node_version`          | `string`  | No       | `'24'`            | Node.js version configured by `actions/setup-node@v4`                                      |
| `container_port`        | `number`  | No       | `3000`            | Port passed to `gcloud run deploy --port`                                                  |
| `allow_unauthenticated` | `boolean` | No       | `true`            | Passes `--allow-unauthenticated` when `true`, or `--no-allow-unauthenticated` when `false` |

---

## Onboarding a New `apps/<name>-api` Service (1-File Setup)

1. Ensure the new API has a dedicated `apps/<name>-api/Dockerfile` that builds from the workspace root (`.`) context.
2. Copy [`.github/workflows/ikagi-api-deploy.yml`](.github/workflows/ikagi-api-deploy.yml) to `.github/workflows/<name>-api-deploy.yml`.
3. Update `name`, `paths` (`apps/<name>-api/**` and workflow filename), `concurrency.group`, and `with:` inputs (`app_name`, `nx_project`, `dockerfile_path`).

---

## Activation & Verification Checklist

1. **Dry-run verification (before GCP provisioning):**
   - Merge a change touching `apps/ikagi-api/` into `staging` → confirm `build-and-verify` runs `yarn install --immutable`, `yarn nx build @jt-workspace/nest-lib`, `yarn nx build @org/ikagi-api`, and the Docker build from `.`, and `deploy-gcp` prints the dry-run notice targeting `staging-gcp` and exits `0`.
   - Merge a change touching only `apps/ikagi-web/` into `staging` → confirm `ikagi-api-deploy` does **not** trigger.
2. **Live GCP activation:**
   - Provision the GCP project, Artifact Registry Docker repository (`$GCP_AR_REPO`), and Workload Identity Federation pool/provider trusting this GitHub repository.
   - Populate the **Variables** and **Secrets** in `staging-gcp` (and `production-gcp`).
   - Configure runtime environment variables / Secret Manager bindings on the Cloud Run service (e.g., `DATABASE_URL`, `REDIS_HOST`, `JWT_SECRET`, OAuth credentials).
   - Set `GCP_DEPLOY_ENABLED=true` on the target environment.
