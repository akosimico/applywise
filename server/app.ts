import cors from "cors";
import express from "express";

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.get("/api/health", (_request, response) => {
    response.json({ message: "Applywise API is running" });
  });
  return app;
}

