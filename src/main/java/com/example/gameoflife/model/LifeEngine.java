package com.example.gameoflife.model;

import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Pure, stateless implementation of Conway's Game of Life rules.
 *
 * <p>The grid is unbounded: we never allocate a 2D array, we just track
 * the coordinates of live cells in a {@link Set}. This keeps the engine a
 * simple, side-effect-free function: {@code Set<Cell> -> Set<Cell>},
 * which is what makes the REST API stateless (see BoardController).
 */
public final class LifeEngine {

    private LifeEngine() {
    }

    /**
     * Computes the next generation from the current set of live cells.
     *
     * Rules:
     * <ul>
     *   <li>A live cell with 2 or 3 live neighbors survives.</li>
     *   <li>A dead cell with exactly 3 live neighbors becomes alive.</li>
     *   <li>Every other cell dies or stays dead.</li>
     * </ul>
     */
    public static Set<Cell> nextGeneration(Set<Cell> liveCells) {
        Map<Cell, Integer> neighborCounts = new HashMap<>();

        for (Cell live : liveCells) {
            for (Cell neighbor : live.neighbors()) {
                neighborCounts.merge(neighbor, 1, Integer::sum);
            }
        }

        return neighborCounts.entrySet().stream()
                .filter(entry -> isAlive(entry.getKey(), entry.getValue(), liveCells))
                .map(Map.Entry::getKey)
                .collect(Collectors.toUnmodifiableSet());
    }

    /** Advances {@code liveCells} by {@code generations} steps. */
    public static Set<Cell> advance(Set<Cell> liveCells, int generations) {
        Set<Cell> current = liveCells;
        for (int i = 0; i < generations; i++) {
            current = nextGeneration(current);
        }
        return current;
    }

    private static boolean isAlive(Cell cell, int liveNeighborCount, Set<Cell> currentlyLive) {
        boolean alreadyAlive = currentlyLive.contains(cell);
        return liveNeighborCount == 3 || (alreadyAlive && liveNeighborCount == 2);
    }
}
