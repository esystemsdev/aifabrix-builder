# Keycloak Identity and Access Management with Custom Themes
# This Dockerfile extends Keycloak 26.4 with custom themes

FROM quay.io/keycloak/keycloak:26.4

# Set working directory
WORKDIR /opt/keycloak

# Copy custom themes from share directory (only if themes/ folder exists)
USER root
# Use a shell script approach: copy themes if it exists, otherwise skip
# First, copy everything from build context to a staging area
COPY . /tmp/build-context/
# Then conditionally copy themes if the directory exists
RUN if [ -d "/tmp/build-context/themes" ] && [ "$(ls -A /tmp/build-context/themes)" ]; then \
      cp -r /tmp/build-context/themes/* /opt/keycloak/themes/ && \
      chown -R keycloak:keycloak /opt/keycloak/themes/ && \
      echo "Themes copied successfully"; \
    else \
      echo "No themes directory found, skipping theme copy"; \
    fi && \
    rm -rf /tmp/build-context

# Build Keycloak with health checks enabled
# This enables the /health, /health/live, /health/ready, and /health/started endpoints
RUN /opt/keycloak/bin/kc.sh build --health-enabled=true

# Switch back to keycloak user
USER keycloak

# Keycloak runs on port 8080 internally, exposed as 8082
EXPOSE 8080

# Default Keycloak command (can be overridden in docker-compose.yaml)
# Health checks are enabled via the build step above
CMD ["start-dev"]