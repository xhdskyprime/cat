module.exports = {
    apps: [
        {
            name: 'cat-server',
            script: './server/index.js',
            // PENTING: Socket.IO butuh adapter (Redis/@socket.io/postgres-adapter)
            // untuk cluster mode. Tanpa adapter, gunakan 1 instance agar WebSocket
            // broadcast (live monitoring, force logout, dll) berfungsi dengan benar.
            instances: 1,
            exec_mode: 'fork',
            autorestart: true,
            watch: false,
            max_memory_restart: '1G',
            env: {
                NODE_ENV: 'development',
                PORT: 3000
            },
            env_production: {
                NODE_ENV: 'production',
                PORT: 3000
            },
            // Optimasi logging file di PM2
            error_file: './logs/err.log',
            out_file: './logs/out.log',
            log_date_format: 'YYYY-MM-DD HH:mm Z',
            merge_logs: true
        }
    ]
};
