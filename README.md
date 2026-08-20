# Conway's Game of Life

**Live app:** https://game-of-life-leulruwtrq-oe.a.run.app

A tiny Spring Boot app that plays [Conway's Game of Life](https://en.wikipedia.org/wiki/Conway%27s_Game_of_Life)
on an unbounded grid, with a canvas-based browser frontend. Built to be a
compact tour of modern Java (records, streams, `switch`-free enums with
behavior) plus a real, working CI/CD pipeline.

## Running it

```bash
mvn spring-boot:run
# or, if you don't have Maven/Java installed locally:
docker build -t game-of-life . && docker run -p 8080:8080 game-of-life
```

Then open http://localhost:8080.

## How it works

### The engine is a pure function

The entire simulation is one static method:

```java
Set<Cell> nextGeneration(Set<Cell> liveCells)
```

`Cell` is a `record(int x, int y)`, and the grid is *not* a 2D array -
it's just the set of coordinates that happen to be alive. That's what
lets the board be conceptually infinite (no bounds to hit) and the
engine itself to be a pure, side-effect-free function of its input. See
`model/LifeEngine.java`.

### The API is stateless

`BoardController` never stores a board on the server. The client sends
its current live cells to `POST /api/step`, and gets the next
generation back:

```
POST /api/step
{ "cells": [{"x":0,"y":0}, {"x":1,"y":0}, {"x":2,"y":0}], "generations": 1 }

200 OK
{ "cells": [{"x":1,"y":-1}, {"x":1,"y":0}, {"x":1,"y":1}], "generation": 1 }
```

No session, no database, no in-memory board keyed by ID. Every replica
of this service can answer any request, which is what makes it trivial
to scale horizontally (relevant once you're deploying it via a
container image, as this repo does).

Other endpoints:

- `GET /api/patterns` - list of built-in patterns (glider, pulsar,
  Gosper glider gun, ...) with descriptions
- `GET /api/patterns/{name}?originX=&originY=` - a pattern's live cells,
  translated to the given origin
- `GET /api/random?width=&height=&density=` - a random starting board

### Patterns are ASCII art, not coordinate lists

`model/Pattern.java` defines each classic pattern as a text block:

```java
GLIDER("...", """
        .X.
        ..X
        XXX
        """);
```

...and parses it into a `Set<Cell>` once at class-load time. This is
both easier to verify by eye and easier to add new patterns to than a
raw list of `(x, y)` pairs.

### The frontend is intentionally dumb

`static/app.js` is vanilla JS with no build step: it draws whatever
cells it currently has on a `<canvas>`, and on each animation tick
POSTs them to `/api/step` and redraws the response. All the actual Game
of Life logic lives in the Java backend - the browser is a thin
renderer.

## Health check

Spring Boot Actuator is wired in with only the health endpoint exposed
(`management.endpoints.web.exposure.include=health` in
`application.properties`), so the deployed service has a real
`/actuator/health` returning `{"status":"UP"}` - useful for uptime
checks or a future Cloud Run health probe, rather than relying on the
static `index.html` as a proxy for "is the app actually up."

## Project layout

```
src/main/java/com/example/gameoflife/
  GameOfLifeApplication.java   entry point
  model/
    Cell.java                  a live coordinate + its 8 neighbors
    LifeEngine.java            the rules, as a pure function
    Pattern.java                built-in starting patterns
  web/
    BoardController.java       the stateless REST API
    CellDto.java, StepRequest.java, BoardResponse.java, PatternSummary.java
src/main/resources/
  static/                      index.html / app.js / style.css (the UI)
  application.properties
src/test/java/...              JUnit 5 tests for the engine and the API
Dockerfile                     multi-stage build -> small JRE runtime image
.github/workflows/ci-cd.yml    test on every push/PR, publish image on main
```

## Tests

```bash
mvn test
```

`LifeEngineTest` checks the rules directly (still-lifes stay still,
oscillators return to their start state after their known period, the
glider translates diagonally, the glider gun's cell count grows over
time). `BoardControllerTest` drives the same behavior through the HTTP
API with `MockMvc`.

## CI/CD

`.github/workflows/ci-cd.yml` has four jobs:

1. **`test`** - runs on every push and pull request: sets up JDK 21,
   runs `mvn verify`, uploads the surefire test report as a build
   artifact. This is the gate: nothing publishes if this fails.
2. **`e2e`** - builds the real Docker image, runs it, and drives it with
   a Playwright browser test (`e2e/`) that loads the page and clicks
   Play. It's informational only: `publish` and `deploy` depend on
   `test`, not on `e2e`, so a flaky browser test can never block a real
   deploy.
3. **`publish`** - runs only on pushes to `main` or version tags
   (`v1.2.3`), never on pull requests (so a fork can't push images
   using your repo's credentials). It builds the `Dockerfile` with
   Buildx and pushes the image to the **GitHub Container Registry**
   (`ghcr.io/<owner>/<repo>`), tagged with:
   - `latest` (on `main`)
   - the short commit SHA (every build, for traceability)
   - the semver version (only when you push a `v*.*.*` tag)

   Authentication uses the automatically-provisioned `GITHUB_TOKEN` -
   **no secrets to configure**. The first successful run creates the
   package automatically; you may need to flip it from private to
   public in the package settings if you want anonymous `docker pull`.

To cut a versioned release: `git tag v1.0.0 && git push origin v1.0.0`.

4. **`deploy`** - runs only on pushes to `main` (never on tags or PRs):
   builds the same `Dockerfile`, pushes it to **Google Artifact
   Registry**, and deploys it to **Cloud Run** with
   `--allow-unauthenticated`, so the resulting URL is publicly
   reachable. Authenticates via Workload Identity Federation - GitHub
   mints a short-lived OIDC token for the run, which Google exchanges
   for credentials scoped to one service account. No long-lived JSON
   key is stored anywhere. See "Deploying to Cloud Run" below for the
   one-time GCP setup this requires.

### Deploying to Cloud Run

The `deploy` job needs three repository secrets and a one-time GCP
setup (a project, an Artifact Registry repo, a service account, and a
Workload Identity Federation provider trusting this specific repo).
Run once, from a machine with `gcloud` installed and logged in
(`gcloud auth login`), or from Cloud Shell in the GCP Console:

```bash
PROJECT_ID="your-gcp-project-id"     # existing project, billing enabled
REPO="owner/game-of-life"            # this GitHub repo, owner/name
REGION="us-central1"

gcloud config set project "$PROJECT_ID"
gcloud services enable run.googleapis.com artifactregistry.googleapis.com \
  iamcredentials.googleapis.com

# Where built images live
gcloud artifacts repositories create game-of-life \
  --repository-format=docker --location="$REGION"

# The identity GitHub Actions deploys as
gcloud iam service-accounts create gha-deployer \
  --display-name="GitHub Actions Deployer"
SA="gha-deployer@${PROJECT_ID}.iam.gserviceaccount.com"

for role in roles/artifactregistry.writer roles/run.admin roles/iam.serviceAccountUser; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${SA}" --role="$role"
done

# Trust GitHub's OIDC tokens, but only for this repo
gcloud iam workload-identity-pools create github-pool --location=global
gcloud iam workload-identity-pools providers create-oidc github-provider \
  --location=global --workload-identity-pool=github-pool \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
  --attribute-condition="assertion.repository=='${REPO}'"

PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format="value(projectNumber)")
gcloud iam service-accounts add-iam-policy-binding "$SA" \
  --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github-pool/attribute.repository/${REPO}"

echo "GCP_PROJECT_ID=${PROJECT_ID}"
echo "GCP_SERVICE_ACCOUNT=${SA}"
echo "GCP_WORKLOAD_IDENTITY_PROVIDER=projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github-pool/providers/github-provider"
```

Then set those three values as repository secrets (Settings -> Secrets
and variables -> Actions), or via the CLI:

```bash
gh secret set GCP_PROJECT_ID --body "your-gcp-project-id"
gh secret set GCP_SERVICE_ACCOUNT --body "gha-deployer@your-gcp-project-id.iam.gserviceaccount.com"
gh secret set GCP_WORKLOAD_IDENTITY_PROVIDER --body "projects/.../providers/github-provider"
```

Push to `main` and the `deploy` job will build, push, and deploy; the
service URL shows up as the environment URL on the run's summary page
(and via `gcloud run services describe game-of-life --region us-central1 --format='value(status.url)'`).

Cloud Run's free tier covers a low-traffic hobby app like this
(scales to zero when idle, so the first request after a quiet period
has a brief cold start).
