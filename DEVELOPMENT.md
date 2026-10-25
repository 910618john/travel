# 開發交接說明

給接手修改這個專案的人或 AI 看。

## 基本

- 網址：https://910618john.github.io/travel/（GitHub Pages，`main` 分支根目錄，push 後約 1 分鐘上線）
- Repo：https://github.com/910618john/travel
- 純前端 PWA，沒有建置步驟、沒有套件管理：直接改檔案、push 就部署
- 介面文字一律繁體中文（台灣用語）

## 檔案

| 檔案 | 內容 |
|---|---|
| `index.html` | 整個 App：CSS、HTML、JS 全在這一個檔（約 3400 行） |
| `sync.js` | Firebase 登入與 Firestore 同步（ES module，從 gstatic CDN 載入 Firebase 10.12.2） |
| `sw.js` | Service Worker：自己的檔案 stale-while-revalidate、地圖圖磚與函式庫 cache-first |
| `manifest.json`、`icon-*.png` | PWA 設定與圖示 |

**每次改完一定要把 `sw.js` 裡的 `CACHE = "travel-vNN"` 數字加 1**，使用者才會看到「有新版本」提示。

## 資料

- 全部狀態在全域物件 `S`，存在 `localStorage["travel_v1"]`；`saveLocal()` 只存本機，`save()` 會更新目前旅程的 `mt` 並排程雲端同步
- `S.trips[]` 每個旅程的欄位見 `newTrip()`；舊資料載入時 `fillTrip()` 會補上缺的欄位
- `T()` 取得目前旅程；照片/PDF 存 IndexedDB（`fput`/`fget`），雲端同步時另存 Firestore
- 帳號層級設定（Google 路線金鑰、樂天 ID、緊急卡）走 `TravelApp.settings()` / `applySettings()`，存在 `users/{uid}/meta/settings`
- 只存本機、不同步的：`S.theme`、`S.style`、`S.anim`、`S.fz`、`S.stc`（車站快取）、`S.wx`（天氣快取）、`S.hol`、`S.fp`（足跡手動地點）

## 畫面架構

- `render()` 依 `S.tab` 呼叫 `V[tab](t)` 產生 HTML 字串放進 `#view`；分頁：home、itin、books、tickets、exp、fx（工具）、pack（清單）
- 子分頁狀態在 `filt`（例如 `filt.iv` 行程檢視、`filt.tool` 工具、`filt.pk` 清單）
- 所有點擊用 document 上的事件委派：`data-tab`、`data-f`/`data-v`（切換篩選）、`data-act`（動作，看 `if (act === "...")` 那一大串）、`data-edit="kind:id"`（開編輯表單）
- 表單：`SCHEMA[kind]` 定義欄位，`openForm(kind, item, after, pre)` 通用表單；時間欄位用 `timeSel()`（分只有 00/15/30/45）
- 使用者輸入放進 HTML 前一定要用 `esc()`
- iPhone Safari 要點得到的元素需要 `cursor:pointer`（已在 CSS 對 `[data-act]` 等設好）

## 外觀

- CSS 變數在 `:root`（`--bg --card --fg --mut --line --acc --red --warn`），深色模式用 `prefers-color-scheme` 與 `data-theme`
- 和風介面：`<html data-style="wa">`（櫻花），福岡再加 `data-city="fuk"`（博多織花紋、Q 版插畫）；`applyDisplay()` 依目的地自動切換
- 插畫都是內嵌的 SVG data URI（CSS 變數 `--ill-*`、`--seigaiha`），不用外部圖片
- 分頁切換動畫：`animView()`，種類由 `data-anim` 決定

## 外部服務（都免費、免金鑰，除非另外註明）

匯率 open.er-api.com、匯率走勢 fawazahmed0 currency-api、天氣與城市 Open-Meteo、定位 Nominatim/Photon、附近與車站 Overpass、地圖 OpenStreetMap + Leaflet、文字辨識 Tesseract.js、條碼 ZXing、節日 Nager.Date、地震 P2P地震情報、翻譯 Google 翻譯非官方端點（備用 MyMemory）、商品 Open Food/Beauty/Products Facts。
選填金鑰：Google Routes API（使用者自己填，有每日 300 次上限）、樂天 API ID。

## 測試方式

沒有自動化測試檔。修改後至少：
1. 本機開 `python3 -m http.server`，用手機寬度（390px）與電腦寬度各看一次，切淺色/深色
2. 打開瀏覽器主控台確認沒有錯誤，所有分頁都點過（畫面出現「這頁出錯了」代表 render 拋錯）
3. 改到表單或拖曳的話，實際新增/編輯/拖曳一次
