FROM node:22-alpine

ARG VITE_API_BASE_URL=/api/v1
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

RUN corepack enable

WORKDIR /app

COPY . .

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @cashpilot/web build

ENV NODE_ENV=production

EXPOSE 3000

CMD ["pnpm", "--filter", "@cashpilot/web", "preview", "--host", "0.0.0.0", "--port", "3000"]
