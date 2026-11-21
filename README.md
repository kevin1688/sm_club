# Lucky Price Roulette｜雙階段網頁輪盤抽獎程式

一款依據 **UI/UX Pro Max (`ui-ux-pro-max-skill`)** 設計系統打造的雙階段輪盤抽獎應用：先由輪盤抽出**得標人物 ID**，再由輪盤抽出**得標金額**，並具備實體撥片音效、最低價／最高價專屬反差動畫、本機模擬模式與 GitHub 雲端紀錄同步。

## 核心功能

- **雙階段輪盤抽獎**：
  1. 階段一：旋轉人物輪盤鎖定得標者 ID。
  2. 階段二：切換至金額輪盤抽出得標金額（支援自動倒數進入或手動觸發）。
- **抽出移除開關**：
  - 可獨立切換「人物 ID 抽出後是否移除」與「抽獎金額抽出後是否移除」。
- **最大／最小金額專屬動畫與音效**：
  - **最小金額（幸運便宜購買）**：雙側彩帶禮花、金綠星光與皇冠飄落、閃光掃過卡片 + 上升琶音勝利音效。
  - **最大金額（荷包警報・要付較高金額）**：畫面震撼搖晃、暗紅閃電閃光、火焰／閃電／錢包警示特效 + 低音震撼與幽默下降銅管音效。
  - **輪盤機械撥片音效**：使用 Web Audio API 零依賴即時合成，隨輪盤轉速由快到慢精準於扇區邊界觸發。
- **先本機模擬，再一鍵上傳 GitHub**：
  - 預設以本機瀏覽器 `localStorage` 儲存模擬紀錄，可安心反覆試玩與清空。
  - 確認流程無誤後，點擊右上角「**本機模擬 / GitHub 設定**」，填入 GitHub `Owner`、`Repo`、`Branch`、`data/history.json` 與具備該 Repo `Contents: Read and write` 權限的 Fine-grained Personal Access Token，即可一鍵批次上傳或開啟每次抽獎自動寫入 GitHub。
  - 歷史面板提供總筆數、累計金額、幸運最低價／最高價統計、搜尋篩選與 UTF-8 CSV 匯出。

## 本機啟動

```bash
npm install
npm run dev
```

## 測試與建置

```bash
npm test
npm run build
```

## 部署至 GitHub Pages

專案已內建 `.github/workflows/deploy.yml`：
1. 將本專案推送到您的 GitHub Repository（`main` 分支）。
2. 在 GitHub Repo 的 **Settings → Pages** 將 Source 設為 **GitHub Actions**。
3. 推送後即自動建置並發布至 GitHub Pages。

