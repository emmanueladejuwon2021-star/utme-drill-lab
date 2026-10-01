import express from "express";
import cors from "cors";
import { migrate } from "./db.js";
import { seed } from "./seed.js";
import routes from "./routes.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "testdriller", time: new Date().toISOString() });
});
app.use("/api", routes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong. Try again." });
});

const port = Number(process.env.PORT || 4787);

export async function start(listen = true) {
  await migrate();
  await seed();
  if (!listen) return app;
  return app.listen(port, () => {
    console.log(`Test Driller API listening on ${port}`);
  });
}

const isMain = process.argv[1] && String(process.argv[1]).endsWith("index.js");
if (isMain) start();

export { app };
