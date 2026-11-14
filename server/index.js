// Uploaded photos and account records should never be world-readable on the host.
process.umask(0o077);

const { createApp } = await import('./app.js');

const { start } = createApp();

await start();
