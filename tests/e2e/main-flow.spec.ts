import { expect, test } from '@playwright/test'

test('demo 使用者可以完成 MVP 主流程', async ({ page }) => {
  await page.goto('/')

  await page.getByRole('button', { name: '登入 Demo' }).click()
  await expect(page.getByRole('heading', { name: '財務總覽', exact: true })).toBeVisible()

  await page.getByRole('button', { name: '帳戶' }).click()
  await expect(page.getByRole('heading', { name: '帳戶', exact: true })).toBeVisible()

  await page.getByRole('button', { name: '新增帳戶' }).click()
  const accountDialog = page.getByRole('dialog', { name: '新增帳戶' })
  await accountDialog.getByLabel('名稱').fill('E2E 儲蓄帳戶')
  await accountDialog.getByLabel('餘額（minor）').fill('1500000')
  await accountDialog.getByRole('button', { name: '建立帳戶' }).click()
  await expect(page.getByText('E2E 儲蓄帳戶')).toBeVisible()

  await page.getByRole('button', { name: '交易' }).click()
  await expect(page.getByRole('heading', { name: '交易', exact: true })).toBeVisible()

  await page.getByRole('button', { name: '新增交易' }).click()
  const transactionDialog = page.getByRole('dialog', { name: '新增交易' })
  await transactionDialog.getByLabel('帳戶').selectOption({ label: 'E2E 儲蓄帳戶' })
  await transactionDialog.getByLabel('分類').selectOption({ label: '生活支出' })
  await transactionDialog.getByLabel('金額（minor）').fill('320000')
  await transactionDialog.getByLabel('商家').fill('E2E 測試商店')
  await transactionDialog.getByLabel('備註').fill('建立第一筆測試交易')
  await transactionDialog.getByRole('button', { name: '建立交易' }).click()
  await expect(page.getByText('E2E 測試商店')).toBeVisible()

  await page.getByRole('button', { name: '帳單' }).click()
  await expect(page.getByRole('heading', { name: '帳單', exact: true })).toBeVisible()

  await page.getByRole('button', { name: '新增帳單' }).click()
  const billDialog = page.getByRole('dialog', { name: '新增帳單' })
  await billDialog.getByLabel('名稱').fill('E2E 測試帳單')
  await billDialog.getByLabel('帳單月份').fill('2026-05')
  await billDialog.getByLabel('到期日').fill('2026-05-12')
  await billDialog.getByLabel('總金額（minor）').fill('480000')
  await billDialog.getByRole('switch', { name: '可分期' }).check()
  await billDialog
    .getByRole('textbox', { name: '不可分期金額（minor）', exact: true })
    .fill('80000')
  await billDialog.getByRole('textbox', { name: '可分期金額（minor）', exact: true }).fill('400000')
  await billDialog.getByRole('button', { name: '建立帳單' }).click()
  await expect(page.getByText('E2E 測試帳單')).toBeVisible()

  await page.getByRole('button', { name: '現金流' }).click()
  await expect(page.getByRole('heading', { name: '現金流', exact: true })).toBeVisible()
  await expect(page.getByText('E2E 測試帳單')).toBeVisible()

  await page.getByRole('button', { name: '分期' }).click()
  await expect(page.getByRole('heading', { name: '分期試算' })).toBeVisible()
  await page.getByRole('button', { name: '試算' }).click()
  await expect(page.getByText('建議結果')).toBeVisible()
  await page.getByRole('button', { name: '建立分期' }).click()
  await expect(page.getByText('玉山信用卡 分期')).toBeVisible()

  await page.getByRole('button', { name: '目標' }).click()
  await expect(page.getByRole('heading', { name: '目標', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '新增目標' }).click()
  const goalDialog = page.getByRole('dialog', { name: '新增目標' })
  await goalDialog.getByLabel('名稱').fill('E2E 相機基金')
  await goalDialog.getByLabel('目標金額（minor）').fill('850000')
  await goalDialog.getByLabel('目前累積（minor）').fill('150000')
  await goalDialog.getByRole('button', { name: '建立目標' }).click()
  await expect(page.getByText('E2E 相機基金')).toBeVisible()

  await page.getByRole('button', { name: '決策' }).click()
  await expect(page.getByRole('heading', { name: '決策', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '執行購買決策' }).click()
  await expect(page.getByRole('heading', { name: /決策結果：/ })).toBeVisible()
  await expect(page.getByText('Roland FP-30X')).toBeVisible()
})
