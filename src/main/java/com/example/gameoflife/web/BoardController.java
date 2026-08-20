package com.example.gameoflife.web;

import com.example.gameoflife.model.Cell;
import com.example.gameoflife.model.LifeEngine;
import com.example.gameoflife.model.Pattern;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Stateless REST API for the Game of Life.
 *
 * <p>The server never remembers a board between requests - the client
 * always sends the current generation's live cells, and the server
 * hands back the next one. This keeps a single instance trivially
 * scalable (any replica can answer any request) and makes the whole
 * API easy to reason about and test: every endpoint is a pure function
 * of its input.
 */
@RestController
@RequestMapping("/api")
public class BoardController {

    @GetMapping("/patterns")
    public List<PatternSummary> listPatterns() {
        return List.of(Pattern.values()).stream()
                .map(p -> new PatternSummary(p.name(), p.description()))
                .toList();
    }

    @GetMapping("/patterns/{name}")
    public BoardResponse getPattern(
            @PathVariable String name,
            @RequestParam(defaultValue = "15") int originX,
            @RequestParam(defaultValue = "15") int originY) {
        Pattern pattern = resolvePattern(name);
        Set<Cell> cells = pattern.cellsCenteredAt(originX, originY);
        return toResponse(cells, 0);
    }

    @ExceptionHandler(IllegalArgumentException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public String handleUnknownPattern(IllegalArgumentException ex) {
        return ex.getMessage();
    }

    private static Pattern resolvePattern(String name) {
        try {
            return Pattern.valueOf(name.toUpperCase());
        } catch (IllegalArgumentException ex) {
            String known = List.of(Pattern.values()).stream().map(Pattern::name).collect(Collectors.joining(", "));
            throw new IllegalArgumentException("Unknown pattern '" + name + "'. Known patterns: " + known);
        }
    }

    @GetMapping("/random")
    public BoardResponse randomBoard(
            @RequestParam(defaultValue = "30") int width,
            @RequestParam(defaultValue = "30") int height,
            @RequestParam(defaultValue = "0.25") double density) {
        Set<Cell> cells = java.util.stream.IntStream.range(0, width * height)
                .mapToObj(i -> new Cell(i % width, i / width))
                .filter(c -> Math.random() < density)
                .collect(Collectors.toUnmodifiableSet());
        return toResponse(cells, 0);
    }

    private static final int MAX_GENERATIONS = 200;
    private static final int MAX_CELLS = 20_000;

    @PostMapping("/step")
    public BoardResponse step(@RequestBody StepRequest request) {
        if (request.cells().size() > MAX_CELLS) {
            throw new IllegalArgumentException(
                    "Too many live cells: received " + request.cells().size() + ", limit is " + MAX_CELLS + ".");
        }

        int generations = request.generations() == null ? 1 : Math.max(1, request.generations());
        if (generations > MAX_GENERATIONS) {
            throw new IllegalArgumentException(
                    "Too many generations: requested " + generations + ", limit is " + MAX_GENERATIONS + ".");
        }

        Set<Cell> current = request.cells().stream()
                .map(CellDto::toCell)
                .collect(Collectors.toUnmodifiableSet());

        Set<Cell> next = LifeEngine.advance(current, generations);

        return toResponse(next, generations);
    }

    private static BoardResponse toResponse(Set<Cell> cells, int generation) {
        List<CellDto> dtos = cells.stream().map(CellDto::from).toList();
        return new BoardResponse(dtos, generation);
    }
}
