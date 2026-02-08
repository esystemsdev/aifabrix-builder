# AI Fabrix Dataplane - Build from base image
# This repo has no application source; use the published image as baseline.
# Build: docker build -t aifabrix/dataplane:local .
# Or use the image directly: docker run aifabrix/dataplane:latest

FROM aifabrix/dataplane:latest

# Expose port (documentation; base image may already set this)
EXPOSE 3001

# Health check (documentation; base image may already set this)
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

# CMD inherited from base image; override only if needed
# CMD inherited: uvicorn app.main:app --host 0.0.0.0 --port 3001
