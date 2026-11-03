// PM2 process definition. Started by deploy/remote-release.sh from inside each release folder.
module.exports = {
  apps: [
    {
      name: "truffles-api",
      script: "dist/server.js",
      cwd: __dirname,
      // MUST stay 1: orders, reservations, sessions and rate limits live in this process's memory.
      // Move to a database before raising this.
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "400M",
      env: {
        NODE_ENV: "production",
        PORT: "5001",
        HOST: "127.0.0.1",
      },
    },
  ],
};
