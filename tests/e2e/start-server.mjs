import { createApp } from '../../server/app.js';

await createApp().start();
setInterval(() => {}, 1 << 30);
