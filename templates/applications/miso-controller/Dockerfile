# AI Fabrix Miso Controller - Build from base image
FROM aifabrix/miso-controller:latest

# Set default data paths (can be overridden by environment variables)
ENV LOG_PATH=/mnt/data/logs
ENV DATA_PATH=/mnt/data/data
ENV BACKUP_PATH=/mnt/data/backup
ENV CONFIG_PATH=/mnt/data/config

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

