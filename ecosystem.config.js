module.exports = {
  apps: [{
    name: "wikijs",
    cwd: "/home/wiki/wikijs",
    script: "server",
    interpreter: "node",
    args: "",
    instances: 1,
    exec_mode: "fork",
    autorestart: true,
    watch: false,
    env: {
      NODE_ENV: "development"
    },
    env_production: {
      NODE_ENV: "production"
    },
    max_memory_restart: "512M",
    error_file: "/var/log/pm2/wikijs.err.log",
    out_file: "/var/log/pm2/wikijs.out.log",
    merge_logs: true,
    time: true
  }]
}
