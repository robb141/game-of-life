package com.example.gameoflife.model;

/**
 * A single coordinate on the (conceptually infinite) Game of Life grid.
 * Records give us equals()/hashCode() for free, which is what lets us
 * keep the "live cells" as a plain {@link java.util.Set}.
 */
public record Cell(int x, int y) {

    /** The 8 Moore-neighborhood coordinates surrounding this cell. */
    public java.util.List<Cell> neighbors() {
        return java.util.List.of(
                new Cell(x - 1, y - 1), new Cell(x, y - 1), new Cell(x + 1, y - 1),
                new Cell(x - 1, y),                          new Cell(x + 1, y),
                new Cell(x - 1, y + 1), new Cell(x, y + 1), new Cell(x + 1, y + 1)
        );
    }
}
