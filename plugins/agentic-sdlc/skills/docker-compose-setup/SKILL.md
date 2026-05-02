---
name: docker-compose-setup
description: Standard pattern for docker-compose configuration. Used by DevOps Engineer.
---

# Docker Compose Setup

## docker-compose.yml
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
      context: ./dotnet
      dockerfile: Dockerfile
    ports:
      - "5000:5000"
    environment:
      - ConnectionStrings__Default=Host=db;Database=${POSTGRES_DB:-appdb};Username=${POSTGRES_USER:-appuser};Password=${POSTGRES_PASSWORD:-apppassword}
      - ASPNETCORE_URLS=http://+:5000
    depends_on:
      db:
        condition: service_healthy

  frontend:
    build:
      context: ./react
      dockerfile: Dockerfile
    ports:
      - "3000:80"
    depends_on:
      - backend

volumes:
  db_data:
```

## .NET Dockerfile
```dockerfile
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /app
COPY *.sln .
COPY <AppName>.Api/*.csproj ./<AppName>.Api/
COPY <AppName>.Tests/*.csproj ./<AppName>.Tests/
RUN dotnet restore
COPY . .
RUN dotnet publish <AppName>.Api -c Release -o /out

FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app
COPY --from=build /out .
ENTRYPOINT ["dotnet", "<AppName>.Api.dll"]
```

## React Dockerfile
```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json .
RUN npm ci
COPY . .
ARG VITE_API_URL=http://localhost:5000
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

## nginx.conf (SPA + API proxy)
```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://backend:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## .env.example
```
POSTGRES_DB=appdb
POSTGRES_USER=appuser
POSTGRES_PASSWORD=changeme_in_production
```

## Verification steps
1. `docker compose build` — all images build
2. `docker compose up -d && sleep 10`
3. `curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/health` → 200
4. `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000` → 200
5. `docker compose down`
