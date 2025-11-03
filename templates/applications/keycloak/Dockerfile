# Keycloak Identity and Access Management with Custom Themes
# This Dockerfile extends Keycloak 24.0 with custom themes

FROM quay.io/keycloak/keycloak:24.0

# Set working directory
WORKDIR /opt/keycloak

# Copy custom themes from share directory
USER root
COPY themes/ /opt/keycloak/themes/

# Ensure proper permissions
RUN chown -R keycloak:keycloak /opt/keycloak/themes/

# Switch back to keycloak user
USER keycloak

# Keycloak runs on port 8080 internally, exposed as 8082
EXPOSE 8080

# Default Keycloak command (can be overridden in docker-compose.yaml)
CMD ["start-dev"]