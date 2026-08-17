package com.example.gameoflife.web;

import com.example.gameoflife.model.Cell;

/** JSON-friendly mirror of {@link Cell}. */
public record CellDto(int x, int y) {

    public static CellDto from(Cell cell) {
        return new CellDto(cell.x(), cell.y());
    }

    public Cell toCell() {
        return new Cell(x, y);
    }
}
