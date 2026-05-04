import { expect, test } from '@playwright/test'

test('亮色模式會套用到頁面殼層樣式', async ({ page }) => {
  await page.goto('/')

  await page.getByRole('button', { name: '登入 Demo' }).click()
  await expect(page.getByRole('heading', { name: '財務總覽' })).toBeVisible()

  await page.getByRole('button', { name: '設定' }).click()
  await expect(page.getByRole('heading', { name: '設定' })).toBeVisible()

  const themeSwitch = page.getByRole('switch', { name: '深色模式' })
  await expect(themeSwitch).toBeChecked()

  await themeSwitch.click()

  await expect.poll(() => page.locator('html').getAttribute('data-mantine-color-scheme')).toBe(
    'light',
  )

  await expect
    .poll(() =>
      page.evaluate(() => window.getComputedStyle(document.body).backgroundColor),
    )
    .toBe('rgb(244, 247, 251)')

  await expect
    .poll(() =>
      page.evaluate(() => {
        const header = document.querySelector('.cashpilot-header')
        return header ? window.getComputedStyle(header).backgroundColor : null
      }),
    )
    .toBe('rgba(255, 255, 255, 0.82)')
})
