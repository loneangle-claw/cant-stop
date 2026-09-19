# 欲罷不能 Can't Stop · Neon Edition

經典擲骰桌遊《Can't Stop》網頁版，單一 HTML 檔、零建置、可直接開。

**線上版**：https://loneangle-claw.github.io/cant-stop/

## 玩法

擲 4 顆骰子兩兩分組成兩個和（2–12），對應賽道的暫時棋子各前進 1 步；每回合最多 3 顆暫時棋子。
可以一直擲，也可隨時收手把進度存成自己的棋子；擲出的分組全都走不了就是爆掉，本回合進度歸零。
收手時棋子在頂端即封頂該賽道，先封頂 3 條者獲勝。

## 功能

- **單人對抗 AI**：五階難度（極度膽小／穩健新手／理性標準／激進專家／機率大師），AI 每步有延遲動畫可觀看決策過程
- **雙人本地對戰**：Pass & Play，回合交替時全螢幕提示
- **即時爆掉機率**：窮舉 1296 種擲骰結果計算，顯示在控制列
- **分組互動**：組合卡片 hover 預覽賽道落點，點擊執行；僅剩 1 顆棋子時可擇一
- **三種畫面風格**：原版桌遊（紅色停車牌八角棋盤＋實體遊戲的錐形棋子，預設）／霓虹科技／磚塊冒險（致敬瑪利歐地底關：藍磚、問號磚、金幣）；大廳選或遊戲中按調色盤鈕切換，存 LocalStorage。皮膚全在 `index.html` 開頭三個 `[data-theme]` token 區塊
- **棋子樣式**：霓虹與磚塊冒險各有 5 種代表物（核心／閃電／火箭／入侵者／行星；蘑菇／星星／花／龜殼／水管），兩位玩家各自挑；全部是 inline SVG（`PIECES` 常數），吃玩家色
- 圖示一律線條 SVG（`IC` 常數），不用 emoji。⚠️ 圖示內的 class 別取 `.f1`–`.f6`，那是骰子六個面的 3D 轉向
- **新手教學**：大廳「🎓 新手教學」，固定骰點實際玩一回合（擲骰→分組→再擲→收手），四片擋板圍出洞口、只有洞內可點
- **一屏放得下**：遊戲頁固定 `100dvh`，棋盤格子大小用容器查詢單位 `cqw/cqh` 由剩餘空間推算，手機不必捲動、不會被頂列蓋到
- **戰績看板**：LocalStorage 永久保存場數、勝場、最高連勝、爆掉次數
- **背景音樂**：3 種風格串流（Kevin MacLeod, CC BY 4.0），載入失敗自動改用內建 Web Audio 合成器

## 開發

```bash
python -m http.server 8931   # 然後開 http://localhost:8931/index.html
```

全部程式碼在 `index.html`：規則核心 `Rules`（純邏輯不碰 DOM）、AI `AI`、UI 渲染分離，兩種模式共用同一套規則。

## 部署

- **GitHub Pages**（目前上線中）：push 到 `main` 即自動更新，網址如上。
- **Cloudflare Workers**（備用，設定已備好）：Cloudflare 後台 → Workers & Pages → Create → Import a repository → 選這個 repo，之後 push 一樣自動部署到 `https://cant-stop.fbiericlin.workers.dev/`。
  `wrangler.jsonc` 走純靜態資產（沒有後端 API，所以沒有 worker script），只上傳 `index.html`，其餘由 `.assetsignore` 排除。
  本機驗證設定：`npx wrangler deploy --dry-run`。
