import { describe, it, expect } from "vitest";
import request from "supertest";
import express from "express";
import healthRouter from "../routes/health";

describe("health endpoint", () => {
  it("responds with { status: 'ok' }", async () => {
    const app = express();
    app.use("/", healthRouter);

    const res = await request(app).get("/").expect(200);

    expect(res.body).toEqual({ status: "ok" });
  });
});
