# 旅行手帳

出國用：花費分帳、匯率換算、行程、景點、機票住宿、電子票券、行李清單。

網址：https://910618john.github.io/travel/

純前端 PWA，資料只存在自己裝置的瀏覽器（localStorage + IndexedDB），可在 ⚙︎ 匯出/匯入 JSON 備份。

## 雲端同步

Firebase 專案 `travel-672ff`（Auth 電子郵件/密碼 + Firestore），設定在 `index.html` 的 `FIREBASE_CONFIG`。
資料存在 `users/{uid}/trips/{tripId}`，Firestore 規則限制只有本人能讀寫。票券檔案不同步。
