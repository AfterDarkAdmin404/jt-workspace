# GCP Release Deployment Guide (`ikagi-api`)

The release workflow at [`.github/workflows/ikagi-api-release.yml`](../.github/workflows/ikagi-api-release.yml) validates the `@jt-workspace/nest-lib` + `@org/ikagi-api` build and [`apps/ikagi-api/Dockerfile`](../apps/ikagi-api/Dockerfile) on every merged release PR, while keeping GCP Artifact Registry push and Cloud Run deployment behind `GCP_DEPLOY_ENABLED`.

---

## Trigger Behavior

| Event                                                                                      | Outcome                                                  |
| :----------------------------------------------------------------------------------------- | :------------------------------------------------------- |
| Merged PR to `release` or `releases/**` touching `apps/ikagi-api/**` or `libs/nest-lib/**` | Runs `build-and-verify` and `deploy-gcp`                 |
| Merged PR to `release` or `releases/**` touching only `apps/ikagi-web/**`                  | **Skipped** (path filter does not match)                 |
| Closed PR that was **not** merged                                                          | **Skipped** (`github.event.pull_request.merged == true`) |

> **Important (Branch Protection):** Do **not** add `ikagi-api-release` as a required status check in GitHub branch protection rules, because path filtering intentionally skips it on `ikagi-web`-only merges.

---

## Required GitHub Variables & Secrets

Configure these in **Settings → Secrets and variables → Actions** (or inside the `production-gcp` GitHub Environment):

### Variables

| Name                    | Default / Placeholder    | Description                                                                                   |
| :---------------------- | :----------------------- | :-------------------------------------------------------------------------------------------- |
| `GCP_DEPLOY_ENABLED`    | _(unset / `'false'`)_    | Set to `'true'` to switch from dry-run mode to live Artifact Registry push + Cloud Run deploy |
| `GCP_PROJECT_ID`        | `ikagi-prod-placeholder` | Target GCP project ID                                                                         |
| `GCP_REGION`            | `asia-southeast1`        | Artifact Registry and Cloud Run region                                                        |
| `GCP_AR_REPO`           | `ikagi-docker-repo`      | Artifact Registry Docker repository name                                                      |
| `GCP_CLOUD_RUN_SERVICE` | `ikagi-api`              | Target Cloud Run service name                                                                 |

### Secrets (for Live Mode)

| Name                             | Description                                                                                                                      |
| :------------------------------- | :------------------------------------------------------------------------------------------------------------------------------- |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | Full WIF provider resource name (`projects/<PROJECT_NUMBER>/locations/global/workloadIdentityPools/<POOL>/providers/<PROVIDER>`) |
| `GCP_SERVICE_ACCOUNT`            | Service account email with `roles/artifactregistry.writer`, `roles/run.admin`, and `roles/iam.serviceAccountUser`                |

---

## Activation Checklist

1. Provision a GCP project, Artifact Registry Docker repository (`$GCP_AR_REPO`), and Workload Identity Federation pool/provider trusting this GitHub repository.
2. Create the `production-gcp` environment in GitHub repository settings (optionally with required reviewers).
3. Populate the **Variables** and **Secrets** listed above.
4. Configure Cloud Run runtime environment variables / Secret Manager bindings (`DATABASE_URL`, `REDIS_HOST`, `JWT_SECRET`, OAuth credentials) in the `gcloud run deploy` step.
5. Set repository/environment variable `GCP_DEPLOY_ENABLED=true`.
