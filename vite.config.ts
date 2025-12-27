import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // 設定 base 為 './' 可確保資源路徑是相對的，
  // 這樣無論您的 Repo 名稱是什麼，部署到 GitHub Pages (https://user.github.io/repo/) 都能正常運作。
  base: './',
})