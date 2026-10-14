# 旅行手帳

出國用：花費分帳、匯率換算、行程、景點、機票住宿、電子票券、行李清單。

網址：https://910618john.github.io/travel/

純前端 PWA，資料只存在自己裝置的瀏覽器（localStorage + IndexedDB），可在 ⚙︎ 匯出/匯入 JSON 備份。

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
