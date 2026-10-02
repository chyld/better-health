import { createApp } from "./app";

const port = Number(process.env.PORT ?? 3000);
const app = createApp();

export default { port, hostname: "127.0.0.1", fetch: app.fetch };
