# Conway's Game of Life

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

`.github/workflows/ci-cd.yml` has two jobs:

1. **`test`** - runs on every push and pull request: sets up JDK 21,
   runs `mvn verify`, uploads the surefire test report as a build
   artifact. This is the gate: nothing publishes if this fails.
2. **`publish`** - runs only on pushes to `main` or version tags
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

### Taking it further

This publishes an image but doesn't push it anywhere that serves
traffic. To actually deploy on every merge, add a step (or job) after
`publish` that deploys the freshly-pushed image - e.g. `flyctl deploy`,
an SSH + `docker pull && docker compose up -d` on a VM, or a `kubectl
set image` against a cluster. That step needs real deployment
credentials, so it belongs behind a repository/environment secret and
ideally a manual approval gate (a GitHub Environment with required
reviewers) rather than running unattended on every push.
