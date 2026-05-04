# API Database Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓 `apps/api` 在不改變既有 REST 介面的前提下，實際透過 Drizzle 連到 PostgreSQL / PGlite，取代目前只存在於記憶體中的資料快照。

**Architecture:** 保留現有 `store` API 形狀，將它升級成「載入完整 snapshot、每次 mutation 後整體回寫資料庫」的持久化 store。無 `DATABASE_URL` 時走 PGlite 方便本機與測試，設定 `DATABASE_URL` 時走 PostgreSQL。

**Tech Stack:** Fastify 5、Drizzle ORM、PostgreSQL 18、PGlite、Vitest、Playwright

---

### Task 1: 建立資料庫 snapshot backend

**Files:**
- Create: `packages/db/src/bootstrap.ts`
- Modify: `packages/db/src/client.ts`
- Modify: `packages/db/src/index.ts`
- Test: `apps/api/src/app.test.ts`

- [ ] 新增可建立 PostgreSQL / PGlite 連線的 helper。
- [ ] 新增 schema bootstrap，確保沒有 migration 檔時也能建立 MVP 需要的 table。
- [ ] 提供 `loadSnapshot` / `saveSnapshot` 所需的底層 DB 物件與 close hook。
- [ ] 用 API 測試驗證啟動後仍可登入、註冊、查詢與匯出。

### Task 2: 讓 store 改成 DB-backed snapshot store

**Files:**
- Modify: `apps/api/src/store.ts`
- Modify: `apps/api/src/app.ts`
- Test: `apps/api/src/app.test.ts`

- [ ] 保留既有 store method 介面，但在 `create()` 時優先載入 DB snapshot。
- [ ] 若 DB 為空，寫入 demo seed 後再啟動 API。
- [ ] 所有 mutation method 在更新記憶體 snapshot 後同步回寫 DB。
- [ ] Fastify `onClose` 時正確關閉資料庫連線。

### Task 3: 驗證本地與部署路徑

**Files:**
- Modify: `docker-compose.yml`
- Modify: `scripts/deploy-compose.sh`
- Test: `package.json`

- [ ] 驗證 `pnpm test`、`pnpm typecheck`、`pnpm build` 仍通過。
- [ ] 驗證 `pnpm test:e2e` 仍通過。
- [ ] 驗證 `docker compose config` 可解析部署設定。
