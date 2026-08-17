package com.example.gameoflife.web;

import java.util.List;

/** Response body carrying the live cells for a single generation. */
public record BoardResponse(List<CellDto> cells, int generation) {
}
