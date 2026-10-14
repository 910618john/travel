# 旅行手帳

出國用：花費分帳、匯率換算、行程、景點、機票住宿、電子票券、行李清單。

網址：https://910618john.github.io/travel/

純前端 PWA，資料只存在自己裝置的瀏覽器（localStorage + IndexedDB），可在 ⚙︎ 匯出/匯入 JSON 備份。

## 功能

- 總覽：倒數、當地時間與時差、天氣預報、快速記帳、旅行總結
- 行程：清單／地圖（路線、住宿）／日記、拖拉排序、交通方式、營業時間提醒、分享與列印
- 景點：分類篩選、匯入 Google 地圖收藏
- 訂位：機票住宿交通、貼確認信自動建立
- 票券：PDF／截圖，離線可開
- 花費：多幣別、分帳結算、現金錢包、每日預算圖表、收據拍照辨識、退稅／報帳收據整理
- 工具：匯率（30 天走勢）、退稅、小費、外語卡片、緊急電話
- 清單：必買清單、行李整理（自動產生、托運／隨身、秤重、去回程）、出發準備與行前注意事項
- 雲端同步、共享旅程、照片同步、離線使用（PWA）

## 雲端同步

Firebase 專案 `travel-672ff`（Auth 電子郵件/密碼 + Firestore），設定在 `index.html` 的 `FIREBASE_CONFIG`。
私人旅程 `users/{uid}/trips/{tripId}`，共享旅程 `shared/{tripId}`（`emails` 成員才能讀寫），照片/PDF 存 `.../files/{fileId}`（壓縮後 ≤ ~700KB）。

Firestore 規則：

```
rules_version = '2';
service cloud.firestore {
  match /databases/{db}/documents {
    match /users/{uid}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
    match /shared/{tripId} {
      allow read, update, delete: if request.auth != null && request.auth.token.email in resource.data.emails;
      allow create: if request.auth != null && request.auth.token.email in request.resource.data.emails;
      match /files/{fileId} {
        allow read, write: if request.auth != null && request.auth.token.email in get(/databases/$(db)/documents/shared/$(tripId)).data.emails;
      }
    }
  }
}
```
