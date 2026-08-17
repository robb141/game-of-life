package com.example.gameoflife;

import com.example.gameoflife.model.Cell;
import com.example.gameoflife.model.LifeEngine;
import com.example.gameoflife.model.Pattern;
import org.junit.jupiter.api.Test;

import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

class LifeEngineTest {

    @Test
    void emptyBoardStaysEmpty() {
        assertThat(LifeEngine.nextGeneration(Set.of())).isEmpty();
    }

    @Test
    void isolatedCellDies() {
        Set<Cell> cells = Set.of(new Cell(0, 0));
        assertThat(LifeEngine.nextGeneration(cells)).isEmpty();
    }

    @Test
    void deadCellWithThreeNeighborsIsBorn() {
        Set<Cell> cells = Set.of(new Cell(0, 0), new Cell(1, 0), new Cell(0, 1));
        Set<Cell> next = LifeEngine.nextGeneration(cells);
        assertThat(next).contains(new Cell(1, 1));
    }

    @Test
    void blinkerOscillatesWithPeriodTwo() {
        Set<Cell> horizontal = Pattern.BLINKER.cells();
        Set<Cell> vertical = LifeEngine.nextGeneration(horizontal);

        assertThat(vertical).isNotEqualTo(horizontal);
        assertThat(LifeEngine.nextGeneration(vertical)).isEqualTo(horizontal);
        assertThat(LifeEngine.advance(horizontal, 2)).isEqualTo(horizontal);
    }

    @Test
    void toadOscillatesWithPeriodTwo() {
        Set<Cell> toad = Pattern.TOAD.cells();
        assertThat(LifeEngine.advance(toad, 2)).isEqualTo(toad);
    }

    @Test
    void beaconOscillatesWithPeriodTwo() {
        Set<Cell> beacon = Pattern.BEACON.cells();
        assertThat(LifeEngine.advance(beacon, 2)).isEqualTo(beacon);
    }

    @Test
    void pulsarOscillatesWithPeriodThree() {
        Set<Cell> pulsar = Pattern.PULSAR.cells();
        assertThat(pulsar).hasSize(48);
        assertThat(LifeEngine.advance(pulsar, 3)).isEqualTo(pulsar);
    }

    @Test
    void gliderTranslatesDiagonallyAfterFourGenerations() {
        Set<Cell> glider = Pattern.GLIDER.cells();
        Set<Cell> moved = LifeEngine.advance(glider, 4);

        assertThat(moved).hasSize(5);
        assertThat(normalize(moved)).isEqualTo(normalize(glider));

        int dx = moved.stream().mapToInt(Cell::x).min().orElseThrow()
                - glider.stream().mapToInt(Cell::x).min().orElseThrow();
        int dy = moved.stream().mapToInt(Cell::y).min().orElseThrow()
                - glider.stream().mapToInt(Cell::y).min().orElseThrow();
        assertThat(dx).isEqualTo(1);
        assertThat(dy).isEqualTo(1);
    }

    @Test
    void gosperGliderGunGrowsOverTime() {
        Set<Cell> gun = Pattern.GOSPER_GLIDER_GUN.cells();
        assertThat(gun).hasSize(36);

        Set<Cell> after60 = LifeEngine.advance(gun, 60);
        assertThat(after60.size()).isGreaterThan(gun.size());
    }

    /** Normalizes a cell set so its bounding box starts at (0,0), for shape comparisons. */
    private static Set<Cell> normalize(Set<Cell> cells) {
        int minX = cells.stream().mapToInt(Cell::x).min().orElseThrow();
        int minY = cells.stream().mapToInt(Cell::y).min().orElseThrow();
        return cells.stream()
                .map(c -> new Cell(c.x() - minX, c.y() - minY))
                .collect(java.util.stream.Collectors.toUnmodifiableSet());
    }
}
