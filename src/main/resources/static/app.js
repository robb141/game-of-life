// Conway's Game of Life - frontend
//
// The browser owns almost no game logic. It just renders whatever set of
// live cells it currently has, and asks the server (POST /api/step) to
// compute the next generation. This mirrors the backend design: the
// server is a pure function of "current cells -> next cells".

const VIEWPORT = 40;          // cells per side
const CANVAS_SIZE = 600;
const CELL_SIZE = CANVAS_SIZE / VIEWPORT;

const canvas = document.getElementById("grid");
const ctx = canvas.getContext("2d");

const els = {
    playPause: document.getElementById("playPause"),
    step: document.getElementById("step"),
    clear: document.getElementById("clear"),
    random: document.getElementById("random"),
    pattern: document.getElementById("pattern"),
    loadPattern: document.getElementById("loadPattern"),
    speed: document.getElementById("speed"),
    speedLabel: document.getElementById("speedLabel"),
    generation: document.getElementById("generation"),
    liveCount: document.getElementById("liveCount"),
};

const state = {
    cells: new Set(),   // "x,y" strings, viewport-local coordinates
    generation: 0,
    playing: false,
    timer: null,
};

function key(x, y) {
    return `${x},${y}`;
}

function render() {
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--cell").trim();
    for (const k of state.cells) {
        const [x, y] = k.split(",").map(Number);
        ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE - 1, CELL_SIZE - 1);
    }
    els.generation.textContent = state.generation;
    els.liveCount.textContent = state.cells.size;
}

function setCells(cellDtos) {
    state.cells = new Set(cellDtos.map(c => key(c.x, c.y)));
}

async function loadPatternList() {
    const res = await fetch("/api/patterns");
    const patterns = await res.json();
    els.pattern.innerHTML = "";
    for (const p of patterns) {
        const option = document.createElement("option");
        option.value = p.name;
        option.textContent = p.name.replaceAll("_", " ");
        option.title = p.description;
        els.pattern.appendChild(option);
    }
    els.pattern.title = patterns[0]?.description ?? "";
    els.pattern.addEventListener("change", () => {
        const selected = patterns.find(p => p.name === els.pattern.value);
        els.pattern.title = selected?.description ?? "";
    });
}

async function loadPattern() {
    const name = els.pattern.value;
    const origin = Math.floor(VIEWPORT / 2) - 6; // roughly center most patterns
    const res = await fetch(`/api/patterns/${name}?originX=${origin}&originY=${origin}`);
    const board = await res.json();
    setCells(board.cells);
    state.generation = 0;
    render();
}

async function loadRandom() {
    const res = await fetch(`/api/random?width=${VIEWPORT}&height=${VIEWPORT}&density=0.25`);
    const board = await res.json();
    setCells(board.cells);
    state.generation = 0;
    render();
}

// Above this many requests/sec, batch multiple generations into each
// POST /api/step instead of firing one request per generation - keeps
// network volume bounded at high speed settings while still advancing
// the board at the user's selected overall rate. Backend caps
// `generations` per request at 200; this stays far under that.
const MAX_TICK_HZ = 10;
const MAX_BATCH_GENERATIONS = 25;

async function step(generations = 1) {
    const body = {
        cells: [...state.cells].map(k => {
            const [x, y] = k.split(",").map(Number);
            return { x, y };
        }),
        generations,
    };
    const res = await fetch("/api/step", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    const board = await res.json();
    setCells(board.cells);
    state.generation += generations;
    render();
}

function clearBoard() {
    pause();
    state.cells = new Set();
    state.generation = 0;
    render();
}

function play() {
    if (state.playing) return;
    state.playing = true;
    els.playPause.textContent = "⏸ Pause";

    const speed = Number(els.speed.value); // desired generations/sec
    const generationsPerTick = Math.min(
        MAX_BATCH_GENERATIONS,
        Math.max(1, Math.ceil(speed / MAX_TICK_HZ))
    );
    const intervalMs = (1000 * generationsPerTick) / speed;

    state.timer = setInterval(() => step(generationsPerTick), intervalMs);
}

function pause() {
    state.playing = false;
    els.playPause.textContent = "▶ Play";
    clearInterval(state.timer);
    state.timer = null;
}

canvas.addEventListener("click", (event) => {
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((event.clientX - rect.left) / CELL_SIZE);
    const y = Math.floor((event.clientY - rect.top) / CELL_SIZE);
    const k = key(x, y);
    if (state.cells.has(k)) {
        state.cells.delete(k);
    } else {
        state.cells.add(k);
    }
    render();
});

els.playPause.addEventListener("click", () => (state.playing ? pause() : play()));
els.step.addEventListener("click", () => { pause(); step(); });
els.clear.addEventListener("click", clearBoard);
els.random.addEventListener("click", () => { pause(); loadRandom(); });
els.loadPattern.addEventListener("click", () => { pause(); loadPattern(); });
els.speed.addEventListener("input", () => {
    els.speedLabel.textContent = `${els.speed.value} gen/s`;
    if (state.playing) {
        pause();
        play();
    }
});

(async function init() {
    await loadPatternList();
    await loadPattern();
})();
