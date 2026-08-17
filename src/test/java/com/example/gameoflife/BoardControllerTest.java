package com.example.gameoflife;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class BoardControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void listsAllPatterns() throws Exception {
        mockMvc.perform(get("/api/patterns"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.name=='GLIDER')]").exists())
                .andExpect(jsonPath("$[?(@.name=='GOSPER_GLIDER_GUN')]").exists());
    }

    @Test
    void returnsGliderPatternCells() throws Exception {
        mockMvc.perform(get("/api/patterns/GLIDER"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.cells.length()").value(5));
    }

    @Test
    void unknownPatternReturnsBadRequest() throws Exception {
        mockMvc.perform(get("/api/patterns/NOT_A_PATTERN"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void randomBoardRespectsDimensions() throws Exception {
        mockMvc.perform(get("/api/random?width=5&height=5&density=1.0"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.cells.length()").value(25));
    }

    @Test
    void stepAdvancesABlinker() throws Exception {
        String requestBody = """
                {"cells": [{"x":0,"y":0},{"x":1,"y":0},{"x":2,"y":0}], "generations": 1}
                """;

        mockMvc.perform(post("/api/step")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.cells.length()").value(3))
                .andExpect(jsonPath("$.generation").value(1));
    }
}
