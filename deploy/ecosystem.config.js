// Used by deploy.sh ONLY when no pm2 process runs this service yet (first deploy on a new server).
// Later deploys restart the existing process, so editing this file does not change a running process.
// App settings come from the .env file in the repo root (loaded by dotenv), not from here.
const path = require('path');

module.exports = {
    apps: [
        {
            name: 'workr-user',
            script: 'dist/server.js',
            cwd: path.resolve(__dirname, '..'),
            interpreter: 'node',
            env: { NODE_ENV: 'production' },
            time: true
        }
    ]
};
