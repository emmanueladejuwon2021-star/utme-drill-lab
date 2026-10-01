import { app, start } from "../server/src/index.js";

let ready;
async function handler(req, res) {
  if (!ready) ready = start(false);
  await ready;
  return app(req, res);
}

export default handler;
