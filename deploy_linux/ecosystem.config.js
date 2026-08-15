// ecosystem.config.js
// Production PM2 Configuration for Board Scanner App on Linux / AWS Lightsail

module.exports = {
  apps: [
    {
      name: 'board-scanner-api',
      script: './dist/server.js',
      cwd: './backend',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 5000
      }
    },
    {
      name: 'board-scanner-demo',
      script: 'demo_server.js',
      cwd: './demo',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      }
    }
  ]
};
