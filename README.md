# 欲罷不能 Can't Stop · Neon Edition

經典擲骰桌遊《Can't Stop》網頁版，單一 HTML 檔、零建置、可直接開。

**線上版**：https://loneangle-claw.github.io/cant-stop/

## 玩法

擲 4 顆骰子兩兩分組成兩個和（2–12），對應賽道的暫時棋子各前進 1 步；每回合最多 3 顆暫時棋子。
可以一直擲，也可隨時收手把進度存成自己的棋子；擲出的分組全都走不了就是爆掉，本回合進度歸零。
收手時棋子在頂端即封頂該賽道，先封頂 3 條者獲勝。

## 功能

- **單人對抗 AI**：五階難度（極度膽小／穩健新手／理性標準／激進專家／機率大師），AI 每步有延遲動畫可觀看決策過程
- **同機雙人**：Pass & Play，同一台裝置輪流操作，回合交替時全螢幕提示
- **線上對戰（房號）**：一人建立房間拿到 4 位數房號／邀請連結（`?room=1234` 開啟即自動進房），另一人加入；斷線或重新整理會自動回到原局。骰子由伺服器擲（`crypto` 亂數），雙方都改不了
- **即時爆掉機率**：窮舉 1296 種擲骰結果計算，顯示在控制列
- **分組互動**：組合卡片 hover 預覽賽道落點，點擊執行；僅剩 1 顆棋子時可擇一
- **三種畫面風格**：原版桌遊（紅色停車牌八角棋盤＋實體遊戲的錐形棋子，預設）／霓虹科技／磚塊冒險（致敬瑪利歐地底關：藍磚、問號磚、金幣）；大廳選或遊戲中按調色盤鈕切換，存 LocalStorage。皮膚全在 `index.html` 開頭三個 `[data-theme]` token 區塊
- **棋子樣式**：霓虹與磚塊冒險各有 5 種代表物（核心／閃電／火箭／入侵者／行星；蘑菇／星星／花／龜殼／水管），兩位玩家各自挑；全部是 inline SVG（`PIECES` 常數），吃玩家色
- 圖示一律線條 SVG（`IC` 常數），不用 emoji。⚠️ 圖示內的 class 別取 `.f1`–`.f6`，那是骰子六個面的 3D 轉向
- **新手教學**：大廳「🎓 新手教學」，固定骰點實際玩一回合（擲骰→分組→再擲→收手），四片擋板圍出洞口、只有洞內可點
- **一屏放得下**：遊戲頁固定 `100dvh`，棋盤格子大小用容器查詢單位 `cqw/cqh` 由剩餘空間推算，手機不必捲動、不會被頂列蓋到
- **戰績看板**：LocalStorage 永久保存場數、勝場、最高連勝、爆掉次數
- **骰子統計（DICE CHECK）**：驗證骰子公平用。記錄雙方擲骰次數、每擲 6 組兩兩點數和（2–12）的實際比例 vs 兩顆公平骰的理論值，以及實際爆掉率 vs 理論爆掉率（＝每次擲骰前畫面顯示的爆掉機率平均）。教學的固定骰點不計入
- **背景音樂**：3 首 Kevin MacLeod（incompetech.com，CC BY 4.0，頁尾已署名）：Neon Laser Horizon／Chill Wave／Floating Cities。來源依序嘗試：同站 `music/*.mp3`（GitHub Pages 回 `audio/mpeg`）→ incompetech 原站（回的是 `application/octet-stream`，iOS Safari 不一定肯播）→ 內建 Web Audio 合成器（音樂列會顯示「合成」）

## 開發

```bash
python -m http.server 8931 -d docs   # 然後開 http://localhost:8931/（線上對戰要用下面的 wrangler dev）
```

前端全部程式碼在 `docs/index.html`：規則核心 `Rules`（純邏輯不碰 DOM）、AI `AI`、UI 渲染分離，兩種模式共用同一套規則。

## 部署

網站檔案都在 `docs/`（`index.html`＋`music/`），後端在 `worker/`。

- **GitHub Pages**：從 `main` 分支的 `/docs` 發佈，push 即自動更新，網址如上。AI／同機雙人在這裡就能玩。
- **Cloudflare Worker**（線上對戰需要）：Cloudflare 後台 → Workers & Pages → Create → Import a repository → 選這個 repo，之後 push 自動部署到 `https://cant-stop.fbiericlin.workers.dev/`。
  - `wrangler.jsonc`：`assets.directory=./docs`、`main=worker/index.js`、Durable Object `Room`（免費方案需 `new_sqlite_classes`）、`run_worker_first: ["/api/*"]`
  - GitHub Pages 那份頁面的線上對戰也是連這個 Worker（`index.html` 的 `NET_ORIGIN`）；Worker 沒部署時會顯示「連不上對戰伺服器」，其他模式不受影響
  - 本機測試：`npx wrangler dev --local --port 8787`（不用登入），開 `http://127.0.0.1:8787/`

### 線上對戰協定（`worker/index.js` ↔ `index.html` 的 `Net`）

`wss://…/api/room?code=1234&action=create|join&token=…`。每個房號一個 Durable Object，只保存**有序事件紀錄**：
客戶端送 `roll`／`pick{i,k}`／`stop`／`again`，伺服器廣播 `dice{p,dice}`／`pick`／`stop`／`start`。兩邊用同一套 `Rules` 依序套用所以畫面一致；
伺服器不懂規則，輪到誰、階段對不對由客戶端的 `Net.valid()` 把關（不合法的事件雙方都會忽略）。重連時 `sync` 帶整份紀錄，`Net.fastApply()` 無動畫重播。
