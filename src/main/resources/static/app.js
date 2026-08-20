// Conway's Game of Life - frontend
//
// The browser owns almost no game logic. It just renders whatever set of
// live cells it currently has, and asks the server (POST /api/step) to
// compute the next generation. This mirrors the backend design: the
// server is a pure function of "current cells -> next cells".

const VIEWPORT = 40;          // cells per side at default zoom
const CANVAS_SIZE = 600;
const CELL_SIZE = CANVAS_SIZE / VIEWPORT; // base (unzoomed) cell size in px

const MIN_SCALE = 0.25;
const MAX_SCALE = 6;

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
    zoomIn: document.getElementById("zoomIn"),
    zoomOut: document.getElementById("zoomOut"),
    zoomReset: document.getElementById("zoomReset"),
};

const state = {
    cells: new Set(),   // "x,y" strings, absolute board coordinates
    generation: 0,
    playing: false,
    timer: null,
};

// The viewport is a pan/zoom window onto the infinite board: offsetX/Y is
// the absolute board coordinate shown at the canvas's top-left corner,
// scale multiplies CELL_SIZE. Both default to the plain 40x40 window at
// the origin that this app originally always showed.
const view = {
    offsetX: 0,
    offsetY: 0,
    scale: 1,
};

function key(x, y) {
    return `${x},${y}`;
}

function effectiveCellSize() {
    return CELL_SIZE * view.scale;
}

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function render() {
    const size = effectiveCellSize();
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--cell").trim();
    for (const k of state.cells) {
        const [x, y] = k.split(",").map(Number);
        const sx = (x - view.offsetX) * size;
        const sy = (y - view.offsetY) * size;
        if (sx + size < 0 || sy + size < 0 || sx > CANVAS_SIZE || sy > CANVAS_SIZE) continue;
        ctx.fillRect(sx, sy, Math.max(size - 1, 0.5), Math.max(size - 1, 0.5));
    }
    els.generation.textContent = state.generation;
    els.liveCount.textContent = state.cells.size;
}

function setCells(cellDtos) {
    state.cells = new Set(cellDtos.map(c => key(c.x, c.y)));
}

// Board coordinate of the cell currently centered under the canvas, used
// to place freshly-loaded patterns/random boards inside whatever part of
// the board the user has panned/zoomed to, instead of always at (0,0).
function viewportCenter() {
    const visibleCells = CANVAS_SIZE / effectiveCellSize();
    return {
        x: view.offsetX + visibleCells / 2,
        y: view.offsetY + visibleCells / 2,
    };
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
    const center = viewportCenter();
    // -6 roughly centers the small built-in patterns (up to ~13 cells wide) on that point
    const originX = Math.round(center.x) - 6;
    const originY = Math.round(center.y) - 6;
    const res = await fetch(`/api/patterns/${name}?originX=${originX}&originY=${originY}`);
    const board = await res.json();
    setCells(board.cells);
    state.generation = 0;
    render();
}

async function loadRandom() {
    const res = await fetch(`/api/random?width=${VIEWPORT}&height=${VIEWPORT}&density=0.25`);
    const board = await res.json();
    // /api/random always returns a block anchored at (0,0); shift it onto
    // whatever part of the board the viewport is currently showing.
    const originX = Math.round(view.offsetX);
    const originY = Math.round(view.offsetY);
    state.cells = new Set(board.cells.map(c => key(c.x + originX, c.y + originY)));
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

function screenToCell(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const size = effectiveCellSize();
    return {
        x: Math.floor(view.offsetX + (clientX - rect.left) / size),
        y: Math.floor(view.offsetY + (clientY - rect.top) / size),
    };
}

function zoomAt(factor, pxX, pxY) {
    const oldSize = effectiveCellSize();
    const cellUnderCursorX = view.offsetX + pxX / oldSize;
    const cellUnderCursorY = view.offsetY + pxY / oldSize;

    view.scale = clamp(view.scale * factor, MIN_SCALE, MAX_SCALE);

    const newSize = effectiveCellSize();
    view.offsetX = cellUnderCursorX - pxX / newSize;
    view.offsetY = cellUnderCursorY - pxY / newSize;
    render();
}

// --- Drawing (left button) and panning (right button) ---
//
// A plain left click toggles one cell, matching the original behavior.
// Dragging with the left button held paints a stroke of live cells
// instead, so freehand drawing doesn't require clicking cell-by-cell.
// Dragging with the right button pans the viewport.

let paint = null; // { moved, cellX, cellY }
let panDrag = null; // { lastClientX, lastClientY }

canvas.addEventListener("contextmenu", (event) => event.preventDefault());

canvas.addEventListener("mousedown", (event) => {
    if (event.button === 2) {
        panDrag = { lastClientX: event.clientX, lastClientY: event.clientY };
        canvas.classList.add("panning");
        return;
    }
    if (event.button !== 0) return;
    const cell = screenToCell(event.clientX, event.clientY);
    paint = { moved: false, cellX: cell.x, cellY: cell.y };
});

window.addEventListener("mousemove", (event) => {
    if (panDrag) {
        const dx = event.clientX - panDrag.lastClientX;
        const dy = event.clientY - panDrag.lastClientY;
        panDrag.lastClientX = event.clientX;
        panDrag.lastClientY = event.clientY;
        const size = effectiveCellSize();
        view.offsetX -= dx / size;
        view.offsetY -= dy / size;
        render();
        return;
    }
    if (paint) {
        const cell = screenToCell(event.clientX, event.clientY);
        if (cell.x !== paint.cellX || cell.y !== paint.cellY) {
            paint.moved = true;
            paint.cellX = cell.x;
            paint.cellY = cell.y;
            state.cells.add(key(cell.x, cell.y));
            render();
        }
    }
});

window.addEventListener("mouseup", (event) => {
    if (panDrag && event.button === 2) {
        panDrag = null;
        canvas.classList.remove("panning");
        return;
    }
    if (paint && event.button === 0) {
        if (!paint.moved) {
            const k = key(paint.cellX, paint.cellY);
            if (state.cells.has(k)) {
                state.cells.delete(k);
            } else {
                state.cells.add(k);
            }
            render();
        }
        paint = null;
    }
});

canvas.addEventListener("wheel", (event) => {
    event.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const factor = event.deltaY < 0 ? 1.1 : 1 / 1.1;
    zoomAt(factor, event.clientX - rect.left, event.clientY - rect.top);
}, { passive: false });

els.zoomIn.addEventListener("click", () => zoomAt(1.25, CANVAS_SIZE / 2, CANVAS_SIZE / 2));
els.zoomOut.addEventListener("click", () => zoomAt(1 / 1.25, CANVAS_SIZE / 2, CANVAS_SIZE / 2));
els.zoomReset.addEventListener("click", () => {
    view.offsetX = 0;
    view.offsetY = 0;
    view.scale = 1;
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

// Keyboard shortcuts: space toggles play/pause, right-arrow single-steps.
// Ignored while a form control has focus so they don't fight the speed
// slider or pattern dropdown's own arrow-key/space handling.
window.addEventListener("keydown", (event) => {
    const tag = document.activeElement?.tagName;
    if (tag === "SELECT" || tag === "INPUT" || tag === "TEXTAREA") return;

    if (event.code === "Space") {
        event.preventDefault();
        state.playing ? pause() : play();
    } else if (event.code === "ArrowRight") {
        event.preventDefault();
        pause();
        step();
    }
});

(async function init() {
    await loadPatternList();
    await loadPattern();
})();
