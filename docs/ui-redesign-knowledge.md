# ChainTicket UI Redesign 系統實作規範與 Knowledge

本文件整理 `Redesigned_UI/` 原型（HTML / CSS / JS）原樣移植至 ChainTicket（React 19 + TanStack Start + TypeScript + Tailwind CSS v4）的核心設計原則、踩坑紀錄與技術架構，供後續開發與 AI 協作直接依循。

---

## 1. 核心原則與設計檔對照

| 頁面 / 元件 | 原型來源 (`Redesigned_UI/`) | 系統對應檔案 |
| :--- | :--- | :--- |
| 共用深色殼層與導覽列 | `homepage.html` / `marketplace.html` / `1/customer_marketplace.html` | `src/components/public-dark-shell.tsx`, `src/components/dark-shell-shared.tsx`, `src/components/faucet-claim.tsx` |
| 全域深色主題樣式表 | `css/homepage.css`、`css/customer_my_ticket.css` 及各頁 `<style>` | `src/styles/public-dark.css` |
| 首頁與 3D 範例票卡 | `homepage.html`, `css/homepage.css` | `src/routes/index.tsx` |
| 拓樸波浪與星塵 Canvas | `js/homepage.js` | `src/components/topo-canvas.tsx` |
| Marketplace 輪播與詳情抽屜 | `marketplace.html`, `1/customer_marketplace.html` | `src/routes/marketplace.tsx` |
| My Tickets 未登入引導與 Ticket Archive 檔案館 | `my_ticket.html`（未登入）、`customer_my_ticket.html` / `css` / `js`（已登入） | `src/routes/my-tickets.tsx` |
| Admin 深色殼層與樣式表 | `admin_dashboard.*`、`admin_list.*`、`admin_setup.*` | `src/components/admin-dark-shell.tsx`, `src/styles/admin-dark.css` |
| Admin Dashboard | `admin_dashboard.html` / `css` / `js` | `src/routes/admin.tsx` |
| Admin Directory（KYC & Verified Organizers） | `admin_list.html` / `css` / `js` | `src/components/admin-list-directory.tsx`, `src/routes/admin.kyc.tsx`, `src/routes/admin.organizers.tsx` |
| Admin System Setup | `admin_setup.html` / `css` / `js` | `src/routes/admin.config.tsx` |

### 不可違反的邊界條件
1. **作用域嚴格隔離**：公開頁深色樣式包裹在 `.ct-dark-theme`（與 `.ct-dark-theme.ct-home-viewport`），Admin 深色樣式額外限定於 `.ct-dark-theme.ct-admin-theme`（`src/styles/admin-dark.css`），不可更動 Organizer、KYC 與 `/events/$eventId` 的原本淺色頁面（`src/styles.css`）。
2. **禁止臆造多餘元件與假資料**：不新增設計檔沒有的功能區塊或寫死假資料，資料一律來自真實 API 與會話狀態（`fetchHomeOverview`、`fetchEvents`、`fetchEvent`、`useSession`、`prepareBuyer`、`quoteBuy`、`buyNow` 及 Admin 的 `fetchInfra`、`fetchAdminEvents`、`fetchWithdrawals`、`fetchSignerOps`、`fetchPendingIndex`、`fetchKycQueue`、`fetchKycDetail`、`fetchKycPhoto`、`fetchOrganizers`）。
3. **不重複全域樣式污染**：公開頁專屬覆寫留在 `src/styles/public-dark.css`，Admin 專屬覆寫留在 `src/styles/admin-dark.css`，保留 `src/styles.css` 給全站淺色介面。

---

## 2. 字體與 Tailwind v4 衝突隔離規則

- **問題背景**：`src/routes/__root.tsx` 載入 Google Fonts 的 `"Familjen Grotesk"` 與 `"IBM Plex Mono"`，`src/styles.css` 設為 `--font-sans` 並在 `@layer base` 加上 `h1, h2, h3 { text-wrap: balance; }`、`html { -webkit-font-smoothing: antialiased; }`。若在 `.ct-dark-theme` 插入 `var(--font-sans)`，Windows 上會捨棄 `"Segoe UI"` 改渲染較窄高的 `"Familjen Grotesk"`，導致版面與字型和原版不同。
- **系統規範**：
  - `.ct-dark-theme` 必須使用原檔完全一致的字體棧：
    ```css
    font-family: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif;
    -webkit-font-smoothing: auto;
    -moz-osx-font-smoothing: auto;
    ```
  - 並重置標題與段落換行，避免被 `styles.css` 的 `balance` / `pretty` 改變斷行：
    ```css
    .ct-dark-theme h1,
    .ct-dark-theme h2,
    .ct-dark-theme h3,
    .ct-dark-theme p {
      text-wrap: wrap;
    }
    ```

---

## 3. 導覽列（Navbar）與已登入狀態列規範

1. **全深色頁透明漸層 Navbar**：
   - `/`、`/marketplace`、`/my-tickets` 的 `.ct-dark-theme .navbar` 一律採用透明向下漸層（`linear-gradient(180deg, rgba(4, 6, 5, 0.75) 0%, rgba(4, 6, 5, 0) 100%)`、`border-bottom: 1px solid rgba(255, 255, 255, 0.04)`），**不加不透黑底與 `backdrop-filter: blur`**，讓 `.bg-stage` 的上方翡翠綠光暈自然透出。
2. **已登入 Attendee 狀態與 Faucet 位置**（依 `Redesigned_UI/1/custommer_marketplace.html`）：
   - **禁止**在 `.hero-top` 搜尋列上方插入大型 `.faucet-glass-bar`，否則會把搜尋膠囊與 3D 卡片輪播整組往下推、導致卡片底部被螢幕下緣裁切。
   - 測試網領水按鈕使用 `.btn-claim-mini`，透過 `PublicDarkShell` 的 `navRightPrefix` 放在 `.nav-right` 中 `.network-chip` 的左側（Dev Mode + 已登入時顯示）。
   - 已登入膠囊使用 `.attendee-wallet-pill`（`.wallet-balance-grp` + `.pill-divider` + `.wallet-addr` + `.role-badge-attendee` + `.btn-sign-out`），並在餘額增加時以 `requestAnimationFrame` 做 450ms 三次方緩動滾動更新（`1 - Math.pow(1 - p, 3)`）。
   - 手機端（`max-width: 768px`）隱藏頂部 `.attendee-wallet-pill` 與 `.btn-claim-mini`，改由 `mobileMenuExtra` 整合至 `.mobile-nav-drawer` 避免溢出。

---

## 4. Home 首頁 3D 範例票卡與背景動畫規範

1. **CSS `perspective` 直接子層要求**：
   - `Redesigned_UI/css/homepage.css` 在 `.hero-right` 設定 `perspective: 1200px`，在 `.holo-ticket` 設定 `transform: rotateY(-8deg) rotateX(4deg)`，`:hover` 時展開為 `rotateY(0deg) rotateX(0deg) translateY(-6px)`。
   - **禁忌**：不可在 `.hero-right` 與 `.holo-ticket` 之間再包一層沒有 `transform-style: preserve-3d` 的 `<Link>` 或 `<div>`，否則透視會被截斷，票卡會變成平面。
   - **正確作法**：直接把 `className="holo-ticket"`（搭配 `display: block; text-decoration: none; color: inherit;`）掛在 `<Link>` 本身上，使它成為 `.hero-right` 的直接子元素。
2. **背景拓樸波浪 Canvas（`src/components/topo-canvas.tsx`）**：
   - 直接照搬 `Redesigned_UI/js/homepage.js` 的 26 條曲線、`100` 分段、85 顆星塵與滑鼠推擠互動；於 `useEffect` 回傳函式統一執行 `cancelAnimationFrame` 與 `removeEventListener`。

---

## 5. Marketplace 原生 JS 移植架構（`src/routes/marketplace.tsx`）

為了保持 60fps 手感與 `Redesigned_UI` 一致的物理動畫，不將拖曳位移或動畫狀態交由 React `useState` 逐幀重繪，而是將原生 JS 封裝在 React `useEffect` / `useLayoutEffect` 中，核心資料狀態仍與 React Hooks 同步：

1. **3D 輪播與高速流光（Imperative DOM + Canvas）**：
   - 使用 `createCardElement()` 建立固定虛擬卡槽（清單 `< 3` 筆採有限模式；`>= 3` 筆建立 `s = -3..3` 環形插槽與無限循環模式 `mod()`），由 `updateCardTransforms()` 與 `renderSpeedStreaks()` 在單一 `requestAnimationFrame` 迴圈直接更新每個卡槽的 `transform`、`blur`、`opacity`、`zIndex` 及 `#speed-canvas`。
   - **保留目前位置**：重建插槽與 `#segmentBar` 的 `useEffect` 僅依賴 `filteredIdsKey`、`loading`、`items.length`，避免使用者購票成功刷新 `sold` / `available` 數據時輪播被重設回第 0 張；`populateCard()` 使用指紋字串 `sig`（含庫存、價格、`symbol`）按需更新卡面 DOM。

2. **卡片視覺與海報圖片分工**：
   - **輪播小卡片（`.event-card`）維持純色漸層**：不顯示活動圖片，保持與 `Redesigned_UI` HTML/CSS/JS 完全一致的五色漸層主題（`emerald`、`amber`、`crimson`、`cyan`、`violet`）與 `.card-halftone` 紋理。
   - **活動詳情橫幅（`.detail-banner`）顯示活動圖片**：在 `DetailContent` 渲染 `.detail-banner-poster`（`opacity: 0.48`、`object-fit: cover`）搭配 `.detail-banner-scrim` 漸層遮罩確保文字可讀。
   - **IPFS 網址安全解析（`resolvePosterUrl`）**：
     - 資料庫中已儲存的 HTTPS 連結（例如 `https://gateway.pinata.cloud/ipfs/...` 或一般圖片 CDN）**直接保留原網址**，不可盲目覆寫為 `https://dweb.link/ipfs/...`（實測 `dweb.link` 與 `ipfs.io` 易回傳 HTTP 429 或 `ERR_BLOCKED_BY_RESPONSE.NotSameOrigin`）。
     - 僅針對 `ipfs://` 開頭的 URI 透過 `config.ipfsGateway`（預設 fallback 為 `https://gateway.pinata.cloud`）轉換；`onError` 時附帶一次 `gateway.pinata.cloud` fallback 重試，若仍失敗則隱藏圖片退回純色漸層。

3. **搜尋膠囊擴展（Morph Pill）與物理高度詳情抽屜**：
   - `#morphPill` 與 `#filterDrawer` 直接使用 DOM class 與 `filterStrip.scrollHeight` 物理高度轉場；`#filterStrip` 僅顯示 `All Categories` 與活動分類標籤（不額外增加設計檔沒有的過濾按鈕）。
   - `#detailOuter` 始終常駐掛載於 DOM（收合時 `height: 0; opacity: 0;`）：
     - 開啟：`0px` → 強制 reflow → `detailInner.scrollHeight` → 動畫結束（680ms）設為 `auto`，並以四次方緩動 `smoothScrollToY()` 捲動至頂部對齊。
     - 切換不同卡片：鎖定前高度 → 加入 `.detail-content-stage.swapping`（淡出 240ms，期間**保留舊詳情文字避免預先清空造成高度閃爍**）→ 切換內容並在下一幀移除 `.swapping` → 過渡到新高度。
     - 異步票種讀取（`fetchEvent`）：當 `detail` 或 `contractsOpen` 改變時，若抽屜高度尚在固定 px 過渡階段，透過 `settleDetailHeight()` 同步最新 `detailInner.scrollHeight`。

4. **桌機端滑鼠拖曳與防文字反白**：
   - `.ct-dark-theme`（與 `.marketplace-shell`）設定 `user-select: none; -webkit-user-select: none;`（`input, textarea` 覆寫為 `user-select: text`），並在 `<main>` 監聽 `selectstart`（排除表單輸入元件）與 `dragstart` 攔截。
   - `#carouselViewport` 在 `pointerdown` 時支援滑鼠左鍵與右鍵拖曳卡片，且於滑鼠按下時清除既有選取 `window.getSelection()?.removeAllRanges()`；若以右鍵拖曳超過 `5px`（`wasDraggedRef`），設定 `suppressNextContextMenuRef` 僅於放開當次攔截右鍵選單，確保右鍵滑卡片順暢不跳框。

---

## 6. 開發環境與驗證基準

- **Vite 伺服器設定（`vite.config.ts`）**：`server` 設定 `host: "0.0.0.0"`、`port: 8085`、`strictPort: true`、`allowedHosts: [".trycloudflare.com"]`，方便本地瀏覽器與 Cloudflare Tunnel 預覽。
- **驗證指令**：
  - 單檔 ESLint：`npx eslint src/routes/index.tsx src/routes/marketplace.tsx src/components/public-dark-shell.tsx`
  - 型別檢查：`npm run typecheck`（註：既有無關預先錯誤位於 `src/components/app-shell.tsx`）
  - 單元測試：`npm run test`
  - 完整建置：`npm run build`
