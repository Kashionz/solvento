# 個人財務管理 Web App 開發規格書

> 版本：Web 版 v1.0  
> 建議產品名稱：CashPilot / 財務導航  
> 文件日期：2026-05-04  
> 技術方向：React 19.2 + Fastify 5.8.5 + Mantine UI  
> 目標：打造一個類似 Percento 視覺風格，但更偏「現金流決策」的個人財務管理 Web App。

---

## 1. 產品定位

本產品不是單純記帳工具，而是「個人現金流決策 App」。

它需要協助使用者回答以下問題：

- 這個月會不會現金流斷裂？
- 哪些帳單應該全額繳？哪些帳單適合帳單分期？
- 今天最多可以安全花多少錢？
- 什麼時候可以存到 10 萬？
- 明年 10 月是否有能力北歐獨旅？
- 目前能不能買 Roland FP-30X？還是租琴房比較合理？

Percento 偏向資產與淨資產視覺化，本產品則要在資產視覺化之上加入「決策引擎」。

---

## 2. 核心原則

### 2.1 使用者真正需要看的不是帳上餘額

本產品最核心的數字是：

```txt
可自由支配金額
= 目前流動資金
+ 未來已知收入
- 未來固定支出
- 未來帳單與分期
- 預留生活費
- 目標存款
```

例如帳上有 69,888 元，不代表可以花 69,888 元。扣掉房租、卡費、分期、生活費後，可安全花費金額可能接近 0。

### 2.2 決策順序

系統建議必須遵守以下優先順序：

1. 不逾期。
2. 不進入信用卡循環利息。
3. 保留最低生活現金。
4. 控制分期月付壓力。
5. 建立緊急預備金。
6. 再開始大型消費、旅行與投資。

### 2.3 金額計算規則

所有金額在資料庫內一律用整數儲存。

```ts
// TWD 100.50 儲存為 10050
amountMinor: number
currency: 'TWD' | 'JPY' | 'USD' | 'EUR' | 'SEK' | 'DKK' | 'NOK'
```

台幣可顯示整數，但內部仍保留 minor unit，避免小數誤差。

---

## 3. 目標使用者

### 3.1 初期使用者

單一使用者，自用優先。

目前已知財務狀況範例：

```txt
每月薪水：51,070，通常每月 5 號入帳
租屋補貼：3,600，月中或月底不固定入帳
房租：15,000，每月 5 號
固定會員扣款：Patreon 1,000、FANBOX 200、IFMOBILE 290、不明會員 90
信用卡帳單：玉山、國泰、聯邦、凱基、星展
目標：先穩定現金流，再存到 100,000，未來規劃北歐獨旅與購買 Roland FP-30X
```

### 3.2 未來延伸

- 支援多使用者帳號。
- 支援多人家庭財務共管。
- 支援讀取 CSV / Open Banking 匯入。
- 支援 PWA 離線快取。

---

## 4. 功能範圍

## 4.1 MVP 必做功能

### A. 首頁 Dashboard

首頁需顯示：

- 淨資產。
- 流動資金。
- 投資。
- 負債。
- 本月風險狀態。
- 本月剩餘生活費。
- 今日安全花費上限。
- 未來 14 天即將到期付款。

首頁範例：

```txt
財務狀態：高風險
淨資產：-97,952
流動資金：18,818
投資：4,372
負債：121,141

未來 14 天應付款：42,908
本月預估月底生活費：8,224
今日安全花費上限：274
本月建議存款：0
本月建議投資：0
```

### B. 帳戶管理

帳戶類型：

- 現金。
- 銀行帳戶。
- 投資帳戶。
- 信用卡。
- 貸款。
- 目標基金帳戶。

必要欄位：

```ts
Account {
  id: string
  userId: string
  name: string
  type: 'cash' | 'bank' | 'investment' | 'credit_card' | 'loan' | 'goal_fund'
  currency: CurrencyCode
  balanceMinor: number
  creditLimitMinor?: number
  billingDay?: number
  dueDay?: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}
```

### C. 收支與交易管理

交易類型：

- 收入。
- 支出。
- 轉帳。
- 信用卡刷卡。
- 信用卡繳款。
- 分期付款。
- 投資買入。
- 投資賣出。

資料結構：

```ts
Transaction {
  id: string
  userId: string
  accountId: string
  date: string
  amountMinor: number
  direction: 'income' | 'expense' | 'transfer_in' | 'transfer_out'
  categoryId: string
  note?: string
  merchant?: string
  relatedBillId?: string
  relatedInstallmentPaymentId?: string
  isRecurring: boolean
  createdAt: string
  updatedAt: string
}
```

### D. 固定收入與固定支出

用於現金流預測。

初始資料範例：

```txt
薪水：51,070，每月 5 號
租屋補貼：3,600，不固定，預設為保守情境不計入，樂觀情境計入
房租：15,000，每月 5 號
Patreon：1,000，每月，聯邦信用卡
FANBOX：200，每月，聯邦信用卡
IFMOBILE：290，每月，聯邦信用卡
不明會員：90，每月，聯邦信用卡
```

資料結構：

```ts
RecurringRule {
  id: string
  userId: string
  name: string
  amountMinor: number
  direction: 'income' | 'expense'
  accountId?: string
  paymentAccountId?: string
  categoryId: string
  frequency: 'monthly' | 'weekly' | 'yearly' | 'custom'
  dayOfMonth?: number
  uncertainty: 'fixed' | 'variable_date' | 'variable_amount'
  includeInBaseScenario: boolean
  startDate: string
  endDate?: string
  isActive: boolean
}
```

### E. 帳單管理

帳單管理需支援：

- 信用卡帳單。
- 房租。
- 學貸。
- 電話費。
- 會員費。
- 手動新增一次性付款。

資料結構：

```ts
Bill {
  id: string
  userId: string
  accountId?: string
  name: string
  billType: 'credit_card' | 'rent' | 'loan' | 'utility' | 'subscription' | 'other'
  statementMonth?: string
  totalAmountMinor: number
  paidAmountMinor: number
  dueDate: string
  status: 'unpaid' | 'partial' | 'paid' | 'installment'
  canInstallment: boolean
  nonInstallmentAmountMinor?: number
  installmentEligibleAmountMinor?: number
  createdAt: string
  updatedAt: string
}
```

### F. 帳單分期試算

需要支援使用者手動輸入銀行提供的分期資訊，不強制自行推導銀行利息公式，因為各銀行費率與入帳規則可能不同。

輸入欄位：

```ts
InstallmentQuoteInput {
  billId: string
  eligibleAmountMinor: number
  nonInstallmentAmountMinor: number
  aprBps: number
  periods: number
  firstPaymentMinor?: number
  totalInterestMinor?: number
  payments?: {
    period: number
    principalMinor: number
    interestMinor: number
    totalMinor: number
    dueDate?: string
  }[]
}
```

輸出欄位：

```ts
InstallmentSimulationResult {
  quoteId: string
  monthlyCashflowImpact: CashflowImpact[]
  totalPrincipalMinor: number
  totalInterestMinor: number
  totalPaymentMinor: number
  firstMonthCashSavedMinor: number
  debtClearMonth: string
  recommendation: 'recommended' | 'acceptable' | 'not_recommended'
  reasonCodes: string[]
}
```

分期推薦邏輯：

```txt
若不分期導致本月最低現金餘額 < 0：強烈建議分期。
若分期期數延長只多保留少量現金，但總期數大幅拉長：不建議最長期數。
若每月分期付款壓力超過收入 20%：警告。
若分期後仍無法保留生活費：提示仍需調整其他支出。
```

### G. 未來 60 / 90 / 180 天現金流預測

需要以時間軸顯示：

- 已知收入。
- 不確定收入。
- 固定支出。
- 信用卡帳單。
- 分期付款。
- 預留生活費。
- 目標存款。

情境分三種：

```txt
保守情境：不計入租屋補貼，不計入未確認收入。
基準情境：租屋補貼依歷史平均日期入帳。
樂觀情境：租屋補貼月中入帳，且無額外支出。
```

現金流節點：

```ts
CashflowEvent {
  id: string
  userId: string
  date: string
  name: string
  type: 'income' | 'expense' | 'bill' | 'installment' | 'saving' | 'buffer'
  amountMinor: number
  certainty: 'confirmed' | 'estimated' | 'optional'
  sourceId?: string
}
```

現金流結果：

```ts
CashflowProjection {
  scenario: 'conservative' | 'base' | 'optimistic'
  startDate: string
  endDate: string
  openingBalanceMinor: number
  closingBalanceMinor: number
  minimumBalanceMinor: number
  minimumBalanceDate: string
  safeToSpendMinor: number
  dailySafeSpendMinor: number
  riskLevel: 'safe' | 'watch' | 'warning' | 'critical'
  events: CashflowEvent[]
}
```

### H. 目標存款管理

預設目標：

1. 緊急預備金 10,000。
2. 緊急預備金 30,000。
3. 緊急預備金 100,000。
4. 北歐獨旅基金 120,000。
5. Roland FP-30X 基金 25,000。

資料結構：

```ts
Goal {
  id: string
  userId: string
  name: string
  targetAmountMinor: number
  currentAmountMinor: number
  deadline?: string
  priority: 'high' | 'medium' | 'low'
  goalType: 'emergency_fund' | 'travel' | 'purchase' | 'debt_payoff' | 'investment'
  monthlyContributionMinor?: number
  status: 'active' | 'paused' | 'completed' | 'cancelled'
}
```

### I. 購買決策模組

用於回答：

- 能不能買 Roland FP-30X？
- 能不能訂北歐機票？
- 能不能買 3C？
- 能不能增加訂閱支出？

決策輸入：

```ts
PurchaseDecisionInput {
  name: string
  priceMinor: number
  category: 'instrument' | 'travel' | 'electronics' | 'subscription' | 'other'
  purchaseDate?: string
  alternative?: {
    name: string
    unitCostMinor: number
    unit: 'hour' | 'day' | 'month'
  }
  expectedUsage?: {
    unitPerWeek?: number
    durationMonths?: number
  }
}
```

決策輸出：

```ts
PurchaseDecisionResult {
  verdict: 'allow' | 'wait' | 'reject'
  earliestRecommendedDate?: string
  requiredSavingsBeforePurchaseMinor: number
  remainingCashAfterPurchaseMinor: number
  paybackAnalysis?: {
    breakEvenUsageCount: number
    breakEvenMonths: number
  }
  reasons: string[]
  unlockConditions: string[]
}
```

Roland FP-30X 規則範例：

```txt
若存款 < 50,000：不建議購買。
若購買後現金 < 30,000：不建議購買。
若每週練琴 < 2 小時：建議租琴房。
若租琴房累積未滿 30 小時：先租琴房驗證需求。
若存款 >= 80,000 且沒有新增信用卡分期：可考慮全新全套。
```

### J. 財務建議引擎

第一版先用規則引擎，不直接依賴 AI API。

建議類型：

```ts
Recommendation {
  id: string
  userId: string
  severity: 'info' | 'warning' | 'critical'
  title: string
  message: string
  actionLabel?: string
  actionType?: 'pay_bill' | 'create_installment' | 'pause_subscription' | 'save_money' | 'avoid_purchase'
  relatedEntityId?: string
  createdAt: string
  dismissedAt?: string
}
```

規則範例：

```txt
RULE-CASH-001
若未來 14 天必付款 > 可用現金 - 預留生活費：風險 critical。

RULE-DEBT-001
若信用卡帳單超過月收入 50%：建議檢查分期方案。

RULE-SUB-001
若緊急預備金 < 30,000 且存在非必要訂閱：建議暫停訂閱。

RULE-GOAL-001
若本月有高風險帳單：目標存款建議設為 0。

RULE-PURCHASE-001
若購買後緊急預備金低於 30,000：不建議購買。

RULE-TRAVEL-001
若旅費基金未達 100% 或緊急預備金 < 100,000：不建議訂機票。
```

---

## 5. Web 技術棧

## 5.1 技術版本策略

本文件採用 2026-05-04 透過 npm registry 與官方文件查核的最新穩定版本。

原則：

- 使用 exact version pinning。
- 不使用 `^` 或 `~`，避免自動升級造成不可預期變更。
- 使用 Renovate 每週開 PR 檢查新版。
- 每個 dependency upgrade PR 必須通過 typecheck、test、build、e2e。
- 若使用者要求「最新版本」，實作當天仍必須重新執行 `pnpm dlx npm-check-updates` 或 `npm view <pkg> version` 核對。

## 5.2 Runtime 與 Package Manager

| 類別 | 技術 | 版本 |
|---|---|---:|
| Runtime | Node.js | 24.15.0 LTS |
| Package manager | pnpm | 10.33.2 |
| Language | TypeScript | 6.0.3 |
| Database | PostgreSQL | 18.x |

Node.js 24 LTS 作為後端與工具鏈 runtime。PostgreSQL 使用 18.x major branch，Docker image 建議先使用 `postgres:18`，正式上線時可鎖定 patch tag。

## 5.3 Frontend

| 類別 | 套件 | 版本 | 用途 |
|---|---|---:|---|
| UI Framework | React | 19.2.5 | 前端核心 |
| DOM Renderer | react-dom | 19.2.5 | React DOM |
| Build Tool | Vite | 8.0.10 | 前端開發與打包 |
| React Plugin | @vitejs/plugin-react | 6.0.1 | React fast refresh / JSX |
| UI Library | @mantine/core | 9.1.1 | UI 元件 |
| Hooks | @mantine/hooks | 9.1.1 | UI hooks |
| Forms | @mantine/form | 9.1.1 | 表單狀態 |
| Dates | @mantine/dates | 9.1.1 | 日期選擇 |
| Charts | @mantine/charts | 9.1.1 | 圖表 |
| Notifications | @mantine/notifications | 9.1.1 | 通知 |
| Modals | @mantine/modals | 9.1.1 | Modal 管理 |
| Icons | @tabler/icons-react | 3.41.1 | Icon |
| Router | react-router | 7.14.2 | 前端路由 |
| Server State | @tanstack/react-query | 5.100.9 | API cache / mutation |
| Data Table | @tanstack/react-table | 8.21.3 | 表格 |
| Form Advanced | @tanstack/react-form | 1.29.1 | 複雜表單可選 |
| Schema | zod | 4.4.2 | 前後端共用驗證 |
| Date Utility | dayjs | 1.11.20 | 日期處理 |
| Decimal | decimal.js | 10.6.0 | 利率與模擬計算 |

備註：Mantine 9.x 需要 React 19.2+，因此本案不使用 Mantine 8.x。

## 5.4 Backend

| 類別 | 套件 | 版本 | 用途 |
|---|---|---:|---|
| Server | fastify | 5.8.5 | API server |
| CORS | @fastify/cors | 11.2.0 | CORS |
| Security Header | @fastify/helmet | 13.0.2 | 安全標頭 |
| Rate Limit | @fastify/rate-limit | 10.3.0 | 防暴力請求 |
| Swagger | @fastify/swagger | 9.7.0 | OpenAPI |
| Swagger UI | @fastify/swagger-ui | 5.2.6 | API 文件 UI |
| JWT | @fastify/jwt | 10.0.0 | Session token |
| Cookie | @fastify/cookie | 11.0.2 | HttpOnly cookie |
| Sensible | @fastify/sensible | 6.0.4 | 常用錯誤處理 |
| Password Hash | @node-rs/argon2 | 2.0.2 | 密碼雜湊 |
| Logger | pino | 10.3.1 | 結構化 log |
| Pretty Log | pino-pretty | 13.1.3 | 開發 log |
| Env | dotenv | 17.4.2 | 環境變數 |
| TS Runner | tsx | 4.21.0 | 開發執行 TS |

## 5.5 Database / ORM

| 類別 | 套件 | 版本 | 用途 |
|---|---|---:|---|
| ORM | drizzle-orm | 0.45.2 | Type-safe SQL ORM |
| Migration | drizzle-kit | 0.31.10 | Migration / introspection |
| PostgreSQL Driver | pg | 8.20.0 | PostgreSQL client |
| PG Types | @types/pg | 8.20.0 | Type definitions |

選擇 Drizzle ORM 的理由：

- TypeScript 型別友善。
- 適合 Fastify REST API。
- Migration 檔案可控。
- 對財務資料查詢與報表 SQL 比 Prisma 更直接。

## 5.6 Testing / Quality

| 類別 | 套件 | 版本 | 用途 |
|---|---|---:|---|
| Unit Test | vitest | 4.1.5 | 單元測試 |
| React Test | @testing-library/react | 16.3.2 | 元件測試 |
| Jest DOM Matchers | @testing-library/jest-dom | 6.9.1 | DOM assertion |
| E2E | playwright | 1.59.1 | 端對端測試 |
| API Test | supertest | 7.2.2 | API 測試 |
| API Test Types | @types/supertest | 7.2.0 | Type definitions |
| Mock API | msw | 2.14.2 | 前端 mock API |
| Lint / Format | @biomejs/biome | 2.4.14 | 格式化與 lint |

建議使用 Biome 作為主要 lint / format 工具，降低 ESLint / Prettier / TypeScript plugin 版本相容負擔。

---

## 6. 專案架構

採用 pnpm workspace monorepo。

```txt
cashpilot-web/
  apps/
    web/                    # React + Vite + Mantine
    api/                    # Fastify API server
  packages/
    shared/                 # 共用型別、zod schema、金額工具、日期工具
    db/                     # Drizzle schema、migration、seed
    rules/                  # 財務決策規則引擎
  infra/
    docker/
    nginx/
  docs/
    product/
    api/
    decision-rules/
  package.json
  pnpm-workspace.yaml
  tsconfig.base.json
  biome.json
  docker-compose.yml
```

### 6.1 架構圖

```mermaid
flowchart LR
  Browser[Browser / PWA] --> Web[React 19.2 + Mantine 9]
  Web --> API[Fastify 5.8.5 REST API]
  API --> Rules[Decision Rules Engine]
  API --> DB[(PostgreSQL 18)]
  API --> OpenAPI[Swagger / OpenAPI]
  Rules --> DB
```

### 6.2 前端分層

```txt
apps/web/src/
  app/                      # App shell、provider、router
  pages/                    # Route pages
  features/
    dashboard/
    accounts/
    transactions/
    bills/
    installments/
    cashflow/
    goals/
    decisions/
    settings/
  components/               # 共用 UI 元件
  hooks/
  lib/
    api-client.ts
    format-money.ts
    date.ts
  styles/
```

### 6.3 後端分層

```txt
apps/api/src/
  server.ts
  app.ts
  config/
  plugins/
    cors.ts
    auth.ts
    swagger.ts
    rate-limit.ts
  modules/
    auth/
    accounts/
    transactions/
    bills/
    installments/
    cashflow/
    goals/
    decisions/
    recommendations/
  services/
  repositories/
  errors/
```

---

## 7. UI / UX 規格

## 7.1 視覺方向

參考 Percento 的特色：

- 深色背景。
- 大數字。
- 圓角卡片。
- 分類色塊。
- 儀表板視覺化。

但避免直接複製 UI。產品應有自己的資訊架構。

## 7.2 Mantine Theme

```ts
import { createTheme } from '@mantine/core'

export const theme = createTheme({
  primaryColor: 'blue',
  defaultRadius: 'lg',
  fontFamily:
    'Inter, Noto Sans TC, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
  headings: {
    fontWeight: '700',
  },
})
```

### 7.3 主要頁面

| 頁面 | Route | 說明 |
|---|---|---|
| 首頁 | `/` | 淨資產、本月風險、今日可花 |
| 帳戶 | `/accounts` | 銀行、現金、投資、信用卡、貸款 |
| 交易 | `/transactions` | 收支紀錄 |
| 帳單 | `/bills` | 信用卡與固定帳單 |
| 分期試算 | `/installments/simulator` | 分期方案比較 |
| 現金流 | `/cashflow` | 60/90/180 天預測 |
| 目標 | `/goals` | 10 萬、北歐、買琴 |
| 決策 | `/decisions` | 買不買、去不去、能不能花 |
| 報表 | `/reports` | 月支出、淨資產、負債趨勢 |
| 設定 | `/settings` | 使用者、貨幣、提醒、安全 |

### 7.4 Dashboard 卡片

#### 淨資產卡

```txt
淨資產
-97,952

流動資金 18,818
投資 4,372
負債 121,141
```

#### 現金流警示卡

```txt
5 月財務狀態：高風險

未來 14 天應付款：42,908
本月預估剩餘生活費：8,224
今日安全花費上限：274
本月建議存款：0
```

#### 建議卡

```txt
建議行動
1. 玉山 14,337 做 3 期分期。
2. 國泰 11,046 做 12 期分期。
3. 本月不要新增投資。
4. FP-30X 暫不購買，先租琴房。
```

---

## 8. API 規格

API Base URL：`/api/v1`

## 8.1 Auth

```http
POST /auth/register
POST /auth/login
POST /auth/logout
GET  /auth/me
```

### POST /auth/login

Request:

```json
{
  "email": "user@example.com",
  "password": "password"
}
```

Response:

```json
{
  "user": {
    "id": "usr_01",
    "email": "user@example.com",
    "displayName": "YEH CHUNCHENG"
  }
}
```

Session token 存於 HttpOnly Secure SameSite=Lax cookie。

## 8.2 Accounts

```http
GET    /accounts
POST   /accounts
GET    /accounts/:id
PATCH  /accounts/:id
DELETE /accounts/:id
```

## 8.3 Transactions

```http
GET    /transactions?from=2026-05-01&to=2026-05-31
POST   /transactions
PATCH  /transactions/:id
DELETE /transactions/:id
```

## 8.4 Bills

```http
GET    /bills?status=unpaid
POST   /bills
GET    /bills/:id
PATCH  /bills/:id
POST   /bills/:id/payments
POST   /bills/:id/mark-paid
```

## 8.5 Installments

```http
POST /installments/simulate
POST /installments
GET  /installments
GET  /installments/:id
POST /installments/:id/cancel
```

### POST /installments/simulate

Request:

```json
{
  "billId": "bill_yushan_2026_03",
  "eligibleAmountMinor": 1433700,
  "nonInstallmentAmountMinor": 2986900,
  "aprBps": 1100,
  "periods": 3,
  "payments": [
    { "period": 1, "principalMinor": 477900, "interestMinor": 13100, "totalMinor": 491000 },
    { "period": 2, "principalMinor": 477900, "interestMinor": 8800, "totalMinor": 486700 },
    { "period": 3, "principalMinor": 477900, "interestMinor": 4400, "totalMinor": 482300 }
  ]
}
```

Response:

```json
{
  "recommendation": "recommended",
  "totalInterestMinor": 26300,
  "firstMonthCashSavedMinor": 943700,
  "riskLevelAfterInstallment": "watch",
  "reasons": [
    "分期後可避免 5 月現金流斷裂",
    "總利息 263 元，在目前現金流壓力下可接受"
  ]
}
```

## 8.6 Cashflow

```http
GET  /cashflow/projection?rangeDays=90&scenario=base
POST /cashflow/scenarios
POST /cashflow/recalculate
```

## 8.7 Goals

```http
GET    /goals
POST   /goals
PATCH  /goals/:id
POST   /goals/:id/contributions
POST   /goals/:id/pause
POST   /goals/:id/complete
```

## 8.8 Decisions

```http
POST /decisions/purchase
POST /decisions/travel
POST /decisions/custom
GET  /decisions/history
```

### POST /decisions/purchase

Request:

```json
{
  "name": "Roland FP-30X",
  "priceMinor": 2500000,
  "category": "instrument",
  "alternative": {
    "name": "租琴房",
    "unitCostMinor": 16000,
    "unit": "hour"
  },
  "expectedUsage": {
    "unitPerWeek": 2,
    "durationMonths": 12
  }
}
```

Response:

```json
{
  "verdict": "wait",
  "earliestRecommendedDate": "2026-09-01",
  "requiredSavingsBeforePurchaseMinor": 5000000,
  "paybackAnalysis": {
    "breakEvenUsageCount": 156,
    "breakEvenMonths": 18
  },
  "reasons": [
    "目前緊急預備金不足",
    "仍有信用卡分期壓力",
    "每週練琴 1 到 2 小時時，租琴房較安全"
  ],
  "unlockConditions": [
    "存款達 50,000",
    "連續 8 週每週練琴至少 2 小時",
    "沒有新增信用卡分期",
    "購買後仍保留 30,000 現金"
  ]
}
```

---

## 9. Database Schema 草案

## 9.1 users

```sql
CREATE TABLE users (
  id text PRIMARY KEY,
  email text NOT NULL UNIQUE,
  display_name text NOT NULL,
  password_hash text NOT NULL,
  timezone text NOT NULL DEFAULT 'Asia/Taipei',
  base_currency text NOT NULL DEFAULT 'TWD',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

## 9.2 accounts

```sql
CREATE TABLE accounts (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL,
  currency text NOT NULL DEFAULT 'TWD',
  balance_minor bigint NOT NULL DEFAULT 0,
  credit_limit_minor bigint,
  billing_day integer,
  due_day integer,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

## 9.3 categories

```sql
CREATE TABLE categories (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL,
  parent_id text REFERENCES categories(id),
  icon text,
  color text,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

## 9.4 transactions

```sql
CREATE TABLE transactions (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id text NOT NULL REFERENCES accounts(id),
  date date NOT NULL,
  amount_minor bigint NOT NULL,
  direction text NOT NULL,
  category_id text REFERENCES categories(id),
  note text,
  merchant text,
  related_bill_id text,
  related_installment_payment_id text,
  is_recurring boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

## 9.5 bills

```sql
CREATE TABLE bills (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id text REFERENCES accounts(id),
  name text NOT NULL,
  bill_type text NOT NULL,
  statement_month text,
  total_amount_minor bigint NOT NULL,
  paid_amount_minor bigint NOT NULL DEFAULT 0,
  due_date date NOT NULL,
  status text NOT NULL DEFAULT 'unpaid',
  can_installment boolean NOT NULL DEFAULT false,
  non_installment_amount_minor bigint,
  installment_eligible_amount_minor bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

## 9.6 installment_plans

```sql
CREATE TABLE installment_plans (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bill_id text NOT NULL REFERENCES bills(id),
  principal_minor bigint NOT NULL,
  apr_bps integer NOT NULL,
  periods integer NOT NULL,
  total_interest_minor bigint NOT NULL,
  total_payment_minor bigint NOT NULL,
  start_date date NOT NULL,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);
```

## 9.7 installment_payments

```sql
CREATE TABLE installment_payments (
  id text PRIMARY KEY,
  installment_plan_id text NOT NULL REFERENCES installment_plans(id) ON DELETE CASCADE,
  period integer NOT NULL,
  due_date date NOT NULL,
  principal_minor bigint NOT NULL,
  interest_minor bigint NOT NULL,
  total_minor bigint NOT NULL,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

## 9.8 recurring_rules

```sql
CREATE TABLE recurring_rules (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  amount_minor bigint NOT NULL,
  direction text NOT NULL,
  account_id text REFERENCES accounts(id),
  payment_account_id text REFERENCES accounts(id),
  category_id text REFERENCES categories(id),
  frequency text NOT NULL,
  day_of_month integer,
  uncertainty text NOT NULL DEFAULT 'fixed',
  include_in_base_scenario boolean NOT NULL DEFAULT true,
  start_date date NOT NULL,
  end_date date,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

## 9.9 goals

```sql
CREATE TABLE goals (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  target_amount_minor bigint NOT NULL,
  current_amount_minor bigint NOT NULL DEFAULT 0,
  deadline date,
  priority text NOT NULL,
  goal_type text NOT NULL,
  monthly_contribution_minor bigint,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

## 9.10 recommendations

```sql
CREATE TABLE recommendations (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  severity text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  action_label text,
  action_type text,
  related_entity_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  dismissed_at timestamptz
);
```

---

## 10. 財務計算規格

## 10.1 淨資產

```txt
netWorth = totalAssets - totalLiabilities
```

資產：

- 現金。
- 銀行存款。
- 投資帳戶。
- 目標基金。

負債：

- 信用卡未繳帳單。
- 帳單分期未償本金與利息。
- 學貸。
- 其他貸款。

## 10.2 本月生活費上限

```txt
monthLivingBudget
= openingCash
+ confirmedIncome
- fixedExpenses
- confirmedBills
- installmentPayments
- plannedSavings
- minimumCashBuffer
```

```txt
dailySafeSpend = max(0, monthLivingBudget / remainingDaysInMonth)
```

## 10.3 風險分級

| 等級 | 條件 |
|---|---|
| safe | 未來 30 天最低現金餘額 >= 30,000 |
| watch | 未來 30 天最低現金餘額 10,000～29,999 |
| warning | 未來 30 天最低現金餘額 1～9,999 |
| critical | 未來 30 天最低現金餘額 <= 0，或有逾期風險 |

## 10.4 分期比較

比較維度：

- 本月少付多少。
- 總利息。
- 每月現金流壓力。
- 債務結束月份。
- 是否會造成下個月現金流斷裂。

推薦排序：

```txt
先排除會導致本月現金流斷裂的方案。
再排除期數過長但現金流改善有限的方案。
在可行方案中，選總利息較低且月付壓力可承受者。
```

## 10.5 租琴房 vs 買琴損益平衡

```txt
breakEvenHours = pianoPrice / rentalCostPerHour
breakEvenMonths = breakEvenHours / expectedPracticeHoursPerMonth
```

範例：

```txt
FP-30X 全套價格：25,000
租琴房：160 / 小時
損益平衡時數：156.25 小時
若每週 2 小時，每月約 8 小時，約 19.5 個月回本
```

## 10.6 北歐旅行可行性

```txt
tripAllowed = emergencyFund >= 100000
  && travelFund >= estimatedTripCost
  && noNewCreditCardDebt
  && postTripCashBuffer >= 30000
```

若不符合，顯示「可規劃，但不建議訂票」。

---

## 11. 預設 Seed Data

MVP 可先以目前財務狀態建立 seed data，方便開發與測試。

```ts
export const seedProfile = {
  income: [
    { name: '薪水', amount: 51070, dayOfMonth: 5, certainty: 'confirmed' },
    { name: '租屋補貼', amount: 3600, certainty: 'variable_date' },
  ],
  fixedExpenses: [
    { name: '房租', amount: 15000, dayOfMonth: 5 },
    { name: 'Patreon', amount: 1000, account: '聯邦信用卡' },
    { name: 'FANBOX', amount: 200, account: '聯邦信用卡' },
    { name: 'IFMOBILE', amount: 290, account: '聯邦信用卡' },
    { name: '不明會員費', amount: 90, account: '聯邦信用卡' },
  ],
  bills: [
    { name: '玉山 3 月帳單', amount: 44206, dueDate: '2026-05-06' },
    { name: '玉山 4 月帳單', amount: 35039, dueDate: '2026-06-06' },
    { name: '國泰 4 月帳單', amount: 12296, dueDate: '2026-05-11' },
    { name: '聯邦 5 月帳單', amount: 1470, dueDate: '2026-05-27' },
    { name: '凱基 4 月帳單', amount: 7285, dueDate: '2026-05-06' },
    { name: '星展 4 月帳單', amount: 844, dueDate: '2026-05-06' },
  ],
  goals: [
    { name: '緊急預備金 10 萬', amount: 100000, priority: 'high' },
    { name: '北歐獨旅基金', amount: 120000, priority: 'medium' },
    { name: 'Roland FP-30X', amount: 25000, priority: 'low' },
  ],
}
```

---

## 12. 安全與隱私

### 12.1 身分驗證

MVP 可採：

- Email + password。
- Argon2 密碼雜湊。
- HttpOnly Secure SameSite cookie。
- 短效 access token + 長效 refresh token。

未來可加：

- Passkey / WebAuthn。
- Google OAuth。
- Apple Sign in。

### 12.2 API 安全

必做：

- `@fastify/helmet`。
- `@fastify/rate-limit`。
- CORS allowlist。
- Cookie-based session。
- Request body size limit。
- Zod schema validation。
- SQL parameterization through Drizzle。
- 所有資源需檢查 `userId` ownership。

### 12.3 財務資料保護

- 資料庫備份需加密。
- Production log 不得輸出完整帳號、信用卡號、密碼、token。
- 金額與帳單資訊屬敏感資料，預設不整合第三方分析工具。
- 若日後加入 AI API，必須明確標記哪些資料會送出。

---

## 13. 通知與提醒

MVP Web 版：

- App 內通知。
- Dashboard 提醒。

Phase 2：

- PWA push notification。
- Email reminder。

提醒規則：

```txt
帳單到期前 7 天提醒。
帳單到期前 3 天提醒。
帳單到期前 1 天提醒。
未來 14 天最低現金餘額低於 10,000 時提醒。
新增大型購買決策時，自動檢查風險。
```

---

## 14. 報表規格

### 14.1 淨資產趨勢

- 折線圖。
- 顯示資產、負債、淨資產。
- 可切換 1M / 3M / 6M / 1Y。

### 14.2 現金流預測圖

- X 軸：日期。
- Y 軸：預估現金餘額。
- 標記最低點。
- 標記薪水、房租、帳單到期日。

### 14.3 支出分類

- Donut chart 或 bar chart。
- 分類：房租、飲食、交通、娛樂、會員、信用卡還款、投資。

### 14.4 債務下降圖

- 顯示信用卡帳單、分期、學貸剩餘。
- 顯示預估清償月份。

---

## 15. 開發命令

### 15.1 初始化

```bash
pnpm install
pnpm db:up
pnpm db:migrate
pnpm dev
```

### 15.2 常用命令

```bash
pnpm dev              # 同時啟動 web 與 api
pnpm dev:web          # 啟動 Vite
pnpm dev:api          # 啟動 Fastify
pnpm build            # 全專案 build
pnpm typecheck        # TypeScript typecheck
pnpm test             # unit test
pnpm test:e2e         # Playwright E2E
pnpm lint             # Biome lint
pnpm format           # Biome format
pnpm db:generate      # Drizzle migration generate
pnpm db:migrate       # Drizzle migrate
pnpm db:studio        # Drizzle Studio
```

---

## 16. package.json 草案

### 16.1 Root package.json

```json
{
  "name": "cashpilot-web",
  "private": true,
  "packageManager": "pnpm@10.33.2",
  "engines": {
    "node": "24.15.x",
    "pnpm": "10.33.x"
  },
  "scripts": {
    "dev": "pnpm -r --parallel dev",
    "build": "pnpm -r build",
    "typecheck": "pnpm -r typecheck",
    "test": "pnpm -r test",
    "test:e2e": "pnpm --filter web test:e2e",
    "lint": "biome check .",
    "format": "biome format --write .",
    "deps:check": "pnpm outdated",
    "deps:update": "pnpm dlx npm-check-updates --interactive"
  },
  "devDependencies": {
    "@biomejs/biome": "2.4.14",
    "typescript": "6.0.3",
    "tsx": "4.21.0",
    "vitest": "4.1.5"
  }
}
```

### 16.2 apps/web package.json

```json
{
  "name": "web",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit",
    "test": "vitest",
    "test:e2e": "playwright test"
  },
  "dependencies": {
    "@mantine/charts": "9.1.1",
    "@mantine/core": "9.1.1",
    "@mantine/dates": "9.1.1",
    "@mantine/form": "9.1.1",
    "@mantine/hooks": "9.1.1",
    "@mantine/modals": "9.1.1",
    "@mantine/notifications": "9.1.1",
    "@tabler/icons-react": "3.41.1",
    "@tanstack/react-form": "1.29.1",
    "@tanstack/react-query": "5.100.9",
    "@tanstack/react-table": "8.21.3",
    "dayjs": "1.11.20",
    "decimal.js": "10.6.0",
    "react": "19.2.5",
    "react-dom": "19.2.5",
    "react-router": "7.14.2",
    "zod": "4.4.2"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "6.9.1",
    "@testing-library/react": "16.3.2",
    "@types/react": "19.2.14",
    "@types/react-dom": "19.2.3",
    "@vitejs/plugin-react": "6.0.1",
    "msw": "2.14.2",
    "playwright": "1.59.1",
    "typescript": "6.0.3",
    "vite": "8.0.10",
    "vitest": "4.1.5"
  }
}
```

### 16.3 apps/api package.json

```json
{
  "name": "api",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc -b",
    "start": "node dist/server.js",
    "typecheck": "tsc --noEmit",
    "test": "vitest"
  },
  "dependencies": {
    "@fastify/cookie": "11.0.2",
    "@fastify/cors": "11.2.0",
    "@fastify/helmet": "13.0.2",
    "@fastify/jwt": "10.0.0",
    "@fastify/rate-limit": "10.3.0",
    "@fastify/sensible": "6.0.4",
    "@fastify/swagger": "9.7.0",
    "@fastify/swagger-ui": "5.2.6",
    "@node-rs/argon2": "2.0.2",
    "dotenv": "17.4.2",
    "fastify": "5.8.5",
    "pino": "10.3.1",
    "pino-pretty": "13.1.3",
    "zod": "4.4.2"
  },
  "devDependencies": {
    "@types/supertest": "7.2.0",
    "supertest": "7.2.2",
    "tsx": "4.21.0",
    "typescript": "6.0.3",
    "vitest": "4.1.5"
  }
}
```

### 16.4 packages/db package.json

```json
{
  "name": "db",
  "private": true,
  "type": "module",
  "scripts": {
    "generate": "drizzle-kit generate",
    "migrate": "drizzle-kit migrate",
    "studio": "drizzle-kit studio"
  },
  "dependencies": {
    "drizzle-orm": "0.45.2",
    "pg": "8.20.0"
  },
  "devDependencies": {
    "@types/pg": "8.20.0",
    "drizzle-kit": "0.31.10",
    "typescript": "6.0.3"
  }
}
```

---

## 17. Docker Compose 草案

```yaml
services:
  postgres:
    image: postgres:18
    container_name: cashpilot-postgres
    environment:
      POSTGRES_USER: cashpilot
      POSTGRES_PASSWORD: cashpilot_dev_password
      POSTGRES_DB: cashpilot
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  api:
    build:
      context: .
      dockerfile: infra/docker/api.Dockerfile
    environment:
      DATABASE_URL: postgres://cashpilot:cashpilot_dev_password@postgres:5432/cashpilot
      NODE_ENV: development
    ports:
      - "3001:3001"
    depends_on:
      - postgres

  web:
    build:
      context: .
      dockerfile: infra/docker/web.Dockerfile
    ports:
      - "5173:5173"
    depends_on:
      - api

volumes:
  postgres_data:
```

---

## 18. CI / CD

GitHub Actions 必跑：

```txt
1. pnpm install --frozen-lockfile
2. pnpm typecheck
3. pnpm lint
4. pnpm test
5. pnpm build
6. pnpm test:e2e
```

### 18.1 版本更新策略

使用 Renovate：

```json
{
  "extends": ["config:recommended"],
  "packageRules": [
    {
      "matchManagers": ["npm"],
      "rangeStrategy": "pin"
    },
    {
      "matchPackageNames": ["react", "react-dom", "@mantine/**"],
      "groupName": "react-and-mantine"
    },
    {
      "matchPackageNames": ["fastify", "@fastify/**"],
      "groupName": "fastify-stack"
    }
  ]
}
```

目的：確保依賴能持續保持最新，但每次更新都必須經過測試。

---

## 19. 測試規格

### 19.1 Rules Engine 測試

必測情境：

1. 不分期導致現金流為負，應推薦分期。
2. 18 期只比 12 期多保留少量現金，應偏好 12 期。
3. 本月高風險時，建議存款為 0。
4. 購買 FP-30X 後現金低於 30,000，應拒絕購買。
5. 北歐旅行基金不足，應顯示「可規劃但不建議訂票」。

### 19.2 API 測試

- 未登入不可讀取帳戶。
- 使用者不可讀取其他人的財務資料。
- 新增帳單後現金流需重新計算。
- 建立分期後原帳單狀態改為 installment。
- 標記分期付款已繳後，負債與現金流同步更新。

### 19.3 Frontend 測試

- Dashboard 可正確顯示淨資產。
- 帳單列表依到期日排序。
- 分期試算頁可比較 3 / 6 / 12 / 18 期。
- 目標頁可顯示預估完成月份。
- 決策頁可顯示「等待 / 可買 / 不建議」。

---

## 20. MVP 里程碑

### Phase 0：專案初始化，1 週

- 建立 pnpm monorepo。
- 建立 React + Vite + Mantine。
- 建立 Fastify API。
- 建立 PostgreSQL + Drizzle。
- 建立 CI。

### Phase 1：核心資料，2 週

- 帳戶 CRUD。
- 交易 CRUD。
- 帳單 CRUD。
- 固定收入 / 支出 CRUD。
- Seed data。

### Phase 2：現金流與分期，2 週

- 60 / 90 天現金流投影。
- 分期試算。
- 分期建立。
- 風險狀態。

### Phase 3：目標與決策，2 週

- 10 萬存款目標。
- 北歐旅行基金。
- FP-30X 購買決策。
- 租琴房損益分析。

### Phase 4：UI polishing，1 週

- Dashboard 優化。
- 深色主題。
- 圖表與報表。
- 手機版 responsive layout。

### Phase 5：測試與穩定化，1 週

- 單元測試。
- API 測試。
- E2E 測試。
- 資料備份與匯出。

MVP 合計：約 7～9 週。

---

## 21. 驗收標準

### 21.1 產品驗收

- 使用者可以輸入收入、固定支出、信用卡帳單與分期。
- 系統可以算出未來 60 天最低現金餘額。
- 系統可以顯示本月生活費上限。
- 系統可以比較玉山與國泰分期方案。
- 系統可以判斷 Roland FP-30X 是否適合購買。
- 系統可以預測何時存到 100,000。
- 系統可以判斷北歐旅行是否可行。

### 21.2 技術驗收

- React 使用 19.2.x 最新 patch。
- Fastify 使用 5.8.5。
- Mantine 使用 9.x 最新 patch。
- TypeScript strict mode 開啟。
- 所有 monetary calculation 不使用浮點數直接儲存。
- API 全部有 Zod validation。
- 所有 DB migration 可重跑。
- CI 通過 typecheck、test、lint、build。
- Production build 無 TypeScript error。

---

## 22. 非 MVP 功能

以下功能不放在第一版：

- 銀行 API 自動同步。
- 發票自動匯入。
- AI 對話式財務助理。
- 多使用者家庭帳戶。
- 投資組合即時報價。
- 匯率即時同步。
- 多幣別旅行預算自動換算。

但資料模型需保留擴充空間。

---

## 23. 注意事項

### 23.1 這不是投資建議系統

系統可以提供現金流與支出建議，但不應提供高風險投資建議。

### 23.2 分期建議需顯示成本

任何分期建議都必須清楚顯示：

- 期數。
- 每期付款。
- 總利息。
- 總支付。
- 債務結束月份。

### 23.3 不確定收入需保守處理

租屋補貼等不固定收入，預設不列入保守情境。

### 23.4 版本需在實作當天重新核對

本規格列出的套件版本是 2026-05-04 的版本快照。正式開發時仍需重新執行：

```bash
npm view react version
npm view react-dom version
npm view fastify version
npm view @mantine/core version
npm view vite version
npm view typescript version
pnpm outdated
```

若新版有 breaking changes，應以相容性與安全性為優先，而不是盲目升級。

---

## 24. 最終建議

Web 版最適合採用：

```txt
React 19.2 最新 patch
Fastify 5.8.5
Mantine UI 9.x 最新 patch
TypeScript 6
Vite 8
PostgreSQL 18
Drizzle ORM
pnpm workspace monorepo
```

第一版不要做成大型金融平台，而是先做出一個能解決目前真實財務問題的工具：

```txt
輸入帳單與收入
=> 看未來現金流
=> 比較分期
=> 顯示今日可花
=> 判斷能不能買東西
=> 追蹤 10 萬與北歐旅行目標
```

只要 MVP 能穩定回答「我這個月會不會爆」與「這筆錢能不能花」，就已經達到產品核心價值。
