---
name: docker-compose-setup
description: Standard pattern for docker-compose configuration. Used by DevOps Engineer.
---

# Docker Compose Setup

## docker-compose.yml

> **Important:** the `<backend_src>` and `<frontend_src>` placeholders below MUST be substituted with the actual paths from `state.src_paths` (e.g. `./src/backend`, `./src/frontend`). Do NOT use the literal strings `./dotnet` or `./react` — those paths do not exist in v0.2.0+ workspaces.

```yaml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: ${POSTGRES_DB:-appdb}
      POSTGRES_USER: ${POSTGRES_USER:-appuser}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-apppassword}
    ports:
      - "5432:5432"
    volumes:
      - db_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-appuser}"]
      interval: 5s
      timeout: 5s
      retries: 5

  backend:
    build:
      context: ./<backend_src>      # substitute actual path, e.g. ./src/backend
      dockerfile: Dockerfile
    ports:
      - "<backend_port>:<backend_port>"   # use the port from tech-spec deployment topology
    environment:
      - ConnectionStrings__Default=Host=db;Database=${POSTGRES_DB:-appdb};Username=${POSTGRES_USER:-appuser};Password=${POSTGRES_PASSWORD:-apppassword}
      - ASPNETCORE_URLS=http://+:<backend_port>
    depends_on:
      db:
        condition: service_healthy
    healthcheck:
      test: ["CMD-SHELL", "wget -q -O - http://localhost:<backend_port>/health || exit 1"]
      interval: 5s
      timeout: 5s
      retries: 10
      start_period: 10s

  frontend:
    build:
      context: ./<frontend_src>     # substitute actual path, e.g. ./src/frontend
      dockerfile: Dockerfile
    ports:
      - "<frontend_port>:80"
    depends_on:
      backend:
        condition: service_healthy

volumes:
  db_data:
```

## .NET Dockerfile

> **Build context is `<backend_src>` (source only).** The test project lives under
> `<backend_test>` (e.g. `tests/backend`), which is **outside** this build context — so the
> Dockerfile must NOT restore the `.sln` (it references the out-of-context test project).
> Restore and publish the **Api project** directly; it pulls in its transitive source
> references (Domain → Application → Infrastructure), all of which are in context.

```dockerfile
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /app
# Copy each source project's csproj for restore-layer caching (no test project here)
COPY <AppName>.Domain/*.csproj ./<AppName>.Domain/
COPY <AppName>.Application/*.csproj ./<AppName>.Application/
COPY <AppName>.Infrastructure/*.csproj ./<AppName>.Infrastructure/
COPY <AppName>.Api/*.csproj ./<AppName>.Api/
RUN dotnet restore <AppName>.Api/<AppName>.Api.csproj
COPY . .
RUN dotnet publish <AppName>.Api/<AppName>.Api.csproj -c Release -o /out

FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app
COPY --from=build /out .
ENTRYPOINT ["dotnet", "<AppName>.Api.dll"]
```

## React Dockerfile

> **API URL strategy:** the React app calls the backend through nginx's `/api/` proxy. We do NOT bake `localhost:<BACKEND_PORT>` into the bundle (that would break the moment someone serves the frontend on a non-localhost host). Set `VITE_API_URL=""` (empty/relative) so all `fetch()` calls go to `/api/...` on the same origin, and nginx proxies them to the backend container.

```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json .
RUN npm ci
COPY . .
ARG VITE_API_URL=""
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

## nginx.conf (SPA + API proxy)

Substitute `<BACKEND_PORT>` with the port from `tech-spec.md` deployment topology.

```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://backend:<BACKEND_PORT>;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## .env.example

> **The DevOps Engineer must include EVERY env var referenced in the generated `docker-compose.yml`** — not just the database vars below. If the tech-spec's deployment topology adds `JWT_SECRET`, `CORS_ORIGIN`, `OPENAI_API_KEY`, etc., those go here too. Missing vars cause `docker compose up` to fail with cryptic "variable is not set" warnings.

Minimum baseline:
```
POSTGRES_DB=appdb
POSTGRES_USER=appuser
POSTGRES_PASSWORD=changeme_in_production
```

Add any additional vars listed in `tech-spec.md` Deployment topology section.

## Verification steps

Use the actual ports from `tech-spec.md` deployment topology — do NOT assume 5000/3000.

1. `docker compose build` — all images build
2. `docker compose up -d && sleep 10`
3. `curl -s -o /dev/null -w "%{http_code}" http://localhost:<BACKEND_PORT>/health` → 200
4. `curl -s http://localhost:<FRONTEND_PORT>` → 200 AND response body contains `<script src="...">` (proves the bundle is referenced, not just nginx fallback)
5. `docker compose down`
