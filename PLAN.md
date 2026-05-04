# CashPilot Web MVP 開發排程（2026-05-04 起）

## 摘要

以 `2026-05-04` 到 `2026-07-05` 的 9 週排程為基準，採單人全端、mobile-first Web MVP。  
目前工作目錄只有規格與參考 UI，尚無實際專案骨架，因此第 1 週必須同時完成 monorepo、CI、資料庫與設計 token 基礎。  
產品優先順序固定為：先把資料輸入與現金流計算做準，再做分期建議、購買決策與目標追蹤，最後做報表、提醒與穩定化。

## 介面與接口凍結

- 視覺方向採 `Precento Standalone.html` 的設計語言，但不直接複製手機外框。Web 版採 responsive dashboard 與多頁資訊架構。
- 設計 token 在第 1 週凍結：主色 `#4F6EF7`、安全 `#22C55E`、注意 `#F59E0B`、風險 `#F97316`、危險 `#EF4444`；卡片圓角以 `12 / 16 / 20` 為主。
- 字體策略在第 1 週凍結：大數字與標題用 `Space Grotesk`，內文用 `DM Sans` 搭配 `Noto Sans TC` fallback，技術/日期/數值輔助用 `DM Mono`。
- API 介面依規格固定為 8 組：`auth`、`accounts`、`transactions`、`bills`、`installments`、`cashflow`、`goals`、`decisions`。
- 跨前後端共享型別至少在第 2 週完成第一版：`Account`、`Transaction`、`Bill`、`RecurringRule`、`CashflowProjection`、`Goal`、`PurchaseDecisionResult`、`Recommendation`。
- MVP 只做 app 內提醒與 Dashboard 提醒；`PWA push`、`Email reminder` 留到 MVP 後。

## 週次排程

| 週次 | 日期 | 主目標 | 主要輸出 |
|---|---|---|---|
| Week 1 | 2026-05-04 ~ 2026-05-10 | 專案初始化 + 設計系統底座 | `pnpm workspace` monorepo、`apps/web`、`apps/api`、`packages/shared/db/rules`、PostgreSQL + Drizzle、CI、Mantine theme、字體/色彩/卡片/狀態 badge/數字元件 |
| Week 2 | 2026-05-11 ~ 2026-05-17 | 身分驗證與核心資料模型 | Auth、Users/Accounts/Categories schema、seed data、`/accounts` CRUD、帳戶頁與基礎表單、ownership guard |
| Week 3 | 2026-05-18 ~ 2026-05-24 | 交易、帳單、固定規則 | `transactions`、`bills`、`recurring_rules` CRUD、帳單付款狀態更新、交易頁/帳單頁、排序與篩選 |
| Week 4 | 2026-05-25 ~ 2026-05-31 | 現金流核心與 Dashboard v1 | 60/90/180 天 projection、保守/基準/樂觀情境、風險分級、`dailySafeSpend`、首頁總覽卡與 14 天到期提醒 |
| Week 5 | 2026-06-01 ~ 2026-06-07 | 分期試算與建議引擎 v1 | `/installments/simulate`、建立分期、分期後現金流重算、RULE-CASH/RULE-DEBT/RULE-GOAL、分期比較頁 |
| Week 6 | 2026-06-08 ~ 2026-06-14 | 目標與購買決策 | Goals CRUD、10K/30K/100K/北歐/FP-30X 預設目標、`/decisions/purchase`、旅行可行性與租琴房損益分析、建議卡 |
| Week 7 | 2026-06-15 ~ 2026-06-21 | 功能整合與報表首版 | `/cashflow`、`/goals`、`/decisions` 完整頁面、淨資產趨勢、現金流圖、支出分類、債務下降圖、app 內通知中心 |
| Week 8 | 2026-06-22 ~ 2026-06-28 | UI 收斂與 responsive | Desktop/Tablet/Mobile 版型調整、深淺色一致性、圖表樣式、空狀態/錯誤狀態、表單體驗、Dashboard polish |
| Week 9 | 2026-06-29 ~ 2026-07-05 | 測試、穩定化、發布準備 | 單元/API/E2E 補齊、備份與匯出、效能與安全檢查、修 bug、RC 驗收、部署腳本 |

## 關鍵里程碑與驗收

- `2026-05-31` Gate 1：可登入、可管理帳戶/交易/帳單，且能算出首頁現金流摘要。
- `2026-06-14` Gate 2：分期試算、風險等級、目標與購買決策可從真實 seed data 跑通。
- `2026-06-28` RC：所有 MVP 頁面可操作，報表與提醒上線，UI 已完成 responsive。
- `2026-07-05` Launch：通過 typecheck、lint、build、rules engine 測試、API 測試、E2E 主流程驗收。

## 測試計畫

- Rules engine：驗證現金流斷裂時推薦分期、過長期數不被偏好、高風險時建議存款為 0、FP-30X 與北歐旅行規則正確。
- API：未登入拒絕、跨使用者資料隔離、帳單/分期異動後 projection 與 recommendation 會重算。
- Frontend：Dashboard 數值正確、帳單依到期日排序、分期比較可切 `3/6/12/18` 期、目標完成月份與決策 verdict 正確顯示。
- E2E：登入 → 建帳戶 → 建交易/帳單 → 看現金流 → 做分期試算 → 建目標 → 跑購買決策。

## 假設與預設

- 起始日預設為 `2026-05-04`，且沒有既有程式碼可沿用。
- 以 1 位全端開發者為基準，不另外配置專職設計師或 QA。
- MVP 僅支援單一自用使用者場景，但資料模型保留未來多使用者擴充。
- Auth 採 email/password + cookie session；不在 MVP 導入 OAuth、Passkey、Open Banking、PWA push。
- 報表與提醒納入 MVP，但以 read-only 分析與 app 內通知為主，不做複雜排程通知平台。
