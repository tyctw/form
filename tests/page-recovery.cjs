// Start Vite with a test Supabase URL, then:
// node tests/page-recovery.cjs <path to playwright>
// All external requests are intercepted. No live data is read or written.
const { chromium } = require(process.argv[2] || 'playwright');
const assert = require('node:assert/strict');
const base = process.env.APP_URL || 'http://127.0.0.1:4175/form/';
const validConfig = { id: 1, custom_questions: [], system_enabled: true };

async function main() {
  const browser = await chromium.launch({
    executablePath: process.env.BROWSER_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
  });
  const results = [];
  async function scenario(name, config, run) {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://**/*', route => route.request().url().includes('/rest/v1/survey_config')
      ? route.fulfill({ contentType: 'application/json', body: JSON.stringify([config]) })
      : route.abort());
    try {
      await run(page);
      assert.deepEqual(errors, [], `${name}: unexpected JavaScript errors`);
      results.push(name);
      console.log('PASS: ' + name);
    } finally { await page.close(); }
  }
  try {
    await scenario('browser back/forward and return-home links', validConfig, async page => {
      await page.goto(base + '#/guide');
      await page.getByRole('heading', { name: '使用說明', exact: true }).waitFor();
      for (let i = 0; i < 3; i++) {
        await page.getByRole('link', { name: '返回首頁', exact: true }).click();
        await page.waitForURL('**/#/');
        await page.getByRole('heading', { name: '會考序位調查問卷' }).waitFor();
        await page.locator('form').waitFor({ state: 'visible' });
        assert.ok((await page.locator('#root').innerText()).length > 100);
        await page.goBack();
        await page.getByRole('heading', { name: '使用說明', exact: true }).waitFor();
        await page.goForward();
        await page.waitForURL('**/#/');
        await page.getByRole('heading', { name: '會考序位調查問卷' }).waitFor();
        await page.locator('form').waitFor({ state: 'visible' });
        assert.ok((await page.locator('#root').innerText()).length > 100);
        await page.goBack();
      }
      await page.getByRole('link', { name: /隱私權政策/ }).click();
      await page.getByRole('heading', { name: '隱私權政策', exact: true }).waitFor();
      await page.reload();
      await page.getByRole('heading', { name: '隱私權政策', exact: true }).waitFor();
    });
    await scenario('unmatched routes provide a working home link', validConfig, async page => {
      await page.goto(base + '#/missing-page');
      await page.getByRole('heading', { name: '找不到這個頁面' }).waitFor();
      await page.getByRole('link', { name: '返回首頁' }).click();
      await page.waitForURL('**/#/');
      await page.getByRole('heading', { name: '會考序位調查問卷' }).waitFor();
      await page.locator('form').waitFor({ state: 'visible' });
        assert.ok((await page.locator('#root').innerText()).length > 100);
    });
    if (!process.env.PRODUCTION_SMOKE) {
      for (const [name, config] of [
        ['invalid question options', { ...validConfig, custom_questions: [{ id: 'q', type: 'radio', question: 'test', options: {} }] }],
        ['invalid announcement child', { ...validConfig, announcement_content: { body: {} } }],
        ['invalid question collection', { ...validConfig, custom_questions: {} }],
      ]) {
        await scenario(name, config, async page => {
          await page.goto(base + '#/');
          await page.getByRole('heading', { name: '暫時無法載入問卷' }).waitFor();
          assert.equal(await page.getByRole('button', { name: '重新載入' }).count(), 1);
        });
      }
      await scenario('render-error recovery and boundary reset on navigation', validConfig, async page => {
        await page.route('**/src/pages/Information.tsx*', route => route.fulfill({
          contentType: 'application/javascript',
          body: "export default function Information(){ throw new Error('fixture render failure'); }",
        }));
        await page.goto(base + '#/guide');
        await page.getByRole('heading', { name: '頁面暫時無法顯示' }).waitFor();
        await page.getByRole('link', { name: '返回首頁' }).click();
        await page.waitForURL('**/#/');
        await page.getByRole('heading', { name: '頁面暫時無法顯示' }).waitFor({ state: 'hidden' });
        await page.getByRole('heading', { name: '會考序位調查問卷' }).waitFor();
        await page.locator('form').waitFor({ state: 'visible' });
        assert.ok((await page.locator('#root').innerText()).length > 100);
      });
    }
    await scenario('blocked application bundle keeps a visible recovery action', validConfig, async page => {
      await page.route(process.env.PRODUCTION_SMOKE ? '**/assets/index-*.js' : '**/src/main.tsx*', route => route.abort());
      await page.goto(base + '#/');
      await page.locator('#startup-reload').waitFor({ state: 'visible' });
      assert.match(await page.locator('#startup-message').innerText(), /暫時無法載入/);
    });
    console.log(`Completed ${results.length} browser recovery scenarios.`);
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
