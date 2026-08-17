package com.example.gameoflife.web;

import java.util.List;

/**
 * Request body for POST /api/step.
 * {@code generations} defaults to 1 when omitted (see BoardController).
 */
public record StepRequest(List<CellDto> cells, Integer generations) {
}
