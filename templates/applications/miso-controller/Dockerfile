# AI Fabrix Miso Controller - Build from base image
# This repo has no application source; use the published image as baseline.
# Build: docker build -t aifabrix/miso-controller:local .
# Or use the image directly: docker run aifabrix/miso-controller:latest

FROM aifabrix/miso-controller:latest

# Expose port (documentation; base image may already set this)
EXPOSE 3000

# Health check (documentation; base image may already set this)
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# CMD inherited from base image; override only if needed
# CMD inherited: node -r tsconfig-paths/register dist/src/server.js