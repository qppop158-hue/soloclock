# 一人公司打卡 PWA

這是一個極簡雲端打卡系統，可在 iPhone Safari 使用，也可以加入主畫面像 App 一樣打開。

## 使用方式

1. 建立 Supabase 專案。
2. 到 Supabase SQL Editor 執行 `supabase-schema.sql`。
3. 部署此資料夾到 Vercel、Netlify 或任何靜態網站主機。
4. 用 iPhone Safari 打開網址。
5. 點右上角設定，填入：
   - Supabase URL
   - Supabase anon key
   - 私人打卡 key
6. Safari 分享選單中點「加入主畫面」。

## 安全說明

此版本不使用帳號密碼，適合一人公司。資料表已啟用 Row Level Security，前端不直接讀寫資料表，只透過資料庫函式用私人打卡 key 存取對應資料。

私人打卡 key 請設定成不容易猜到的長字串，例如 `my-company-clock-2026-...`。如果 key 外洩，可以換一個新 key，但舊 key 的紀錄會分開保存。

## 檔案

- `index.html`：主畫面
- `app.js`：打卡與月統計邏輯
- `styles.css`：手機優先樣式
- `manifest.webmanifest`：PWA 設定
- `sw.js`：離線快取殼層
- `supabase-schema.sql`：Supabase 資料表與函式
