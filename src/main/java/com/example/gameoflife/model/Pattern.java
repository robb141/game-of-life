package com.example.gameoflife.model;

import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

/**
 * A library of famous, hand-verified Game of Life starting configurations.
 * Each pattern is authored as ASCII art (much easier to eyeball for
 * correctness than a raw list of coordinates) and parsed once at class
 * load time into a {@link Cell} set anchored at the origin.
 */
public enum Pattern {

    GLIDER("The smallest pattern that travels diagonally forever.", """
            .X.
            ..X
            XXX
            """),

    BLINKER("The simplest oscillator: flips between horizontal and vertical every generation.", """
            XXX
            """),

    TOAD("A period-2 oscillator.", """
            .XXX
            XXX.
            """),

    BEACON("Two blocks that blink in and out of sync.", """
            XX..
            XX..
            ..XX
            ..XX
            """),

    PULSAR("A large, symmetric period-3 oscillator.", """
            ..XXX...XXX..
            .............
            X....X.X....X
            X....X.X....X
            X....X.X....X
            ..XXX...XXX..
            .............
            ..XXX...XXX..
            X....X.X....X
            X....X.X....X
            X....X.X....X
            .............
            ..XXX...XXX..
            """),

    GOSPER_GLIDER_GUN("Continuously emits gliders forever - proof that Life can grow without bound.", """
            .....................................
            .........................X...........
            .......................X.X...........
            .............XX......XX............XX
            ............X...X....XX............XX
            .XX........X.....X...XX..............
            .XX........X...X.XX....X.X...........
            ...........X.....X.......X...........
            ............X...X....................
            .............XX......................
            """);

    private final String description;
    private final Set<Cell> cells;

    Pattern(String description, String asciiArt) {
        this.description = description;
        this.cells = parse(asciiArt);
    }

    public String description() {
        return description;
    }

    /** Live cells for this pattern, anchored so the top-left of its bounding box is (0,0). */
    public Set<Cell> cells() {
        return cells;
    }

    /** Same cells, translated so the pattern is centered near (originX, originY). */
    public Set<Cell> cellsCenteredAt(int originX, int originY) {
        return cells.stream()
                .map(c -> new Cell(c.x() + originX, c.y() + originY))
                .collect(Collectors.toUnmodifiableSet());
    }

    private static Set<Cell> parse(String asciiArt) {
        String[] rows = asciiArt.stripTrailing().split("\n");
        return IntStream.range(0, rows.length)
                .boxed()
                .flatMap(y -> IntStream.range(0, rows[y].length())
                        .filter(x -> rows[y].charAt(x) == 'X')
                        .mapToObj(x -> new Cell(x, y)))
                .collect(Collectors.toUnmodifiableSet());
    }
}
