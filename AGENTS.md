# CashPilot 專案開發指標

## 回應與協作

- 預設使用繁體中文（台灣）溝通、註解與開發說明。
- 每次開始開發前，先讀 `PLAN.md` 與 `financial_app_spec_web_react_fastify_mantine.md`，再確認目前週次目標與驗收條件。
- 若需求與規格衝突，優先順序為：使用者當前指示 > `PLAN.md` 當前週次目標 > `financial_app_spec_web_react_fastify_mantine.md` > 既有畫面細節。

## 產品定位

- 這不是單純記帳工具，而是「現金流決策 App」。
- 所有功能判斷都要回到四個核心問題：
  1. 這個月會不會現金流斷裂？
  2. 哪些付款該優先處理？
  3. 今天最多可以安全花多少？
  4. 現在能不能做新的消費、分期、旅行或目標存款？
- 決策順序固定：
  1. 不逾期。
  2. 不進入循環利息。
  3. 保留最低生活現金。
  4. 控制每月分期壓力。
  5. 建立緊急預備金。
  6. 再考慮消費、旅行、投資。

## 專案參考文件

- 排程與週次目標：`/Users/kashionz/Desktop/solvento/PLAN.md`
- 產品與 API 規格：`/Users/kashionz/Desktop/solvento/financial_app_spec_web_react_fastify_mantine.md`
- 視覺語言參考：`/Users/kashionz/Desktop/solvento/Precento Standalone.html`

## Monorepo 結構

- `apps/web`：React 19 + Vite + Mantine 前端。
- `apps/api`：Fastify API。
- `packages/shared`：共用型別、Zod schema、金額與日期工具。
- `packages/rules`：現金流、分期、建議、決策規則引擎。
- `packages/db`：Drizzle schema / seed / migration。

## 金額、日期與情境規則

- 金額一律使用 `amountMinor` / `balanceMinor` 等整數欄位保存，不要在資料層使用浮點金額。
- 顯示層才做格式化，資料層與規則層保持 minor unit。
- 現金流情境固定為三種：
  - `conservative`：不計入不確定收入，對不確定支出採較保守估算。
  - `base`：依 `includeInBaseScenario` 與既有規則做基準估算。
  - `optimistic`：允許較早或較樂觀的收入落點，並降低可變支出壓力。
- 修改 `bills`、`installments`、`recurringRules`、`goals` 時，要同步思考 projection、recommendations、dashboard summary 是否需要重算。

## 共享型別與 API 原則

- 前後端共用資料結構時，優先更新 `packages/shared`，再調整 `apps/api` 與 `apps/web`。
- 新增或修改 API 時，至少同步檢查：
  - shared 型別
  - shared schema
  - API route
  - 前端 API client
  - 對應測試
- 若功能屬於決策、風險、現金流，邏輯應盡量放在 `packages/rules`，避免散落在頁面元件內。

## UI / UX 指標

- 視覺方向沿用 `Precento Standalone.html` 的資訊密度與卡片語言，但不要直接複製手機外框。
- Web 版應維持 responsive dashboard 與資訊頁結構，優先照顧 desktop / tablet / mobile。
- 設計 token 以 `PLAN.md` 為準：
  - 主色 `#4F6EF7`
  - 安全 `#22C55E`
  - 注意 `#F59E0B`
  - 風險 `#F97316`
  - 危險 `#EF4444`
- 首頁 Dashboard 至少要讓使用者快速看到：
  - 淨資產
  - 流動資金
  - 投資
  - 負債
  - 本月風險狀態
  - 本月剩餘生活費
  - 今日安全花費
  - 未來 14 天到期付款
  - 建議行動 / 提醒

## 當前開發焦點

- 若使用者沒有另外指定週次，預設先以 `PLAN.md` 目前目標推進。
- 目前優先焦點為 Week 4：
  - 60 / 90 / 180 天現金流 projection
  - 保守 / 基準 / 樂觀情境
  - 風險分級
  - `dailySafeSpend`
  - Dashboard v1
  - 未來 14 天到期提醒

## 開發流程

- 優先採 TDD：
  1. 先補或新增失敗測試。
  2. 再補最小實作讓測試轉綠。
  3. 最後整理命名、UI 與重構。
- 做功能變更時，優先跑受影響範圍測試，再跑全域驗證。
- 常用命令：
  - `pnpm test`
  - `pnpm typecheck`
  - `pnpm lint`
  - `pnpm --filter @cashpilot/web test`
  - `pnpm --filter @cashpilot/api test`

## 完成前檢查

- 確認 shared 型別、API、前端畫面沒有脫節。
- 確認高風險情境下，Dashboard 的數字與建議仍合理。
- 確認新增規則或欄位後，至少有一個單元或整合測試覆蓋。
- 送出前至少執行：
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
