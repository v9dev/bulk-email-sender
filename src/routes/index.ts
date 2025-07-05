import { Hono } from "hono";
import { serveStatic } from "hono/bun";

const app = new Hono();

// Serve static files
app.use("/public/*", serveStatic({ root: "./" }));
app.use("/css/*", serveStatic({ root: "./public" }));
app.use("/js/*", serveStatic({ root: "./public" }));

// Home route - serve the main HTML file
app.get("/", serveStatic({ path: "./public/index.html" }));

export default app;
