import { expect, test } from '@playwright/test'

test('demo 使用者可以登入並瀏覽核心頁面', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: '現金流決策工作台' })).toBeVisible()
  await page.getByRole('button', { name: '登入 Demo' }).click()

  await expect(page.getByRole('heading', { name: '財務總覽' })).toBeVisible()
  await expect(page.getByText('本月現金流警示')).toBeVisible()

  await page.getByRole('button', { name: '分期' }).click()
  await expect(page.getByRole('heading', { name: '分期試算' })).toBeVisible()

  await page.getByRole('button', { name: '現金流' }).click()
  await expect(page.getByRole('heading', { name: '現金流' })).toBeVisible()
})
