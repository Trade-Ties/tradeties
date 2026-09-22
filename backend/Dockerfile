# Build context must be the REPO ROOT, not backend/ — the Maven build reads
# ../api/openapi.yaml (see backend/pom.xml's <openapi.spec>), one level above
# this file, so the image needs both api/ and backend/ available to COPY.
#
# Example (matches how most PaaS "Dockerfile path" + "build context" fields work):
#   docker build -f backend/Dockerfile -t tradeties-backend .

FROM eclipse-temurin:25-jdk AS build
WORKDIR /workspace

COPY api ./api
COPY backend ./backend
WORKDIR /workspace/backend

# Skips tests here — CI already runs them on every PR (see .github/workflows/ci.yml).
# Re-running the full suite (including the Testcontainers-backed ones) on every image
# build would need Docker-in-Docker and slow every deploy down for no new signal.
RUN ./mvnw -B -q package -DskipTests

FROM eclipse-temurin:25-jre AS run
WORKDIR /app
COPY --from=build /workspace/backend/target/*.jar app.jar

# Spring Boot's default (see application.yml — no server.port override). Point
# your platform's "container port" / health check at 8080, rather than making
# the app read a platform-supplied $PORT.
EXPOSE 8080

ENTRYPOINT ["java", "-jar", "app.jar"]
