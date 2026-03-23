module.exports = {
    apps: [
        {
            name: 'cat-server',
            script: './server/index.js',
            instances: 'max', // Gunakan semua core CPU yang tersedia (Cluster Mode)
            exec_mode: 'cluster',
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
