// 雲端同步(Firebase Auth + Firestore)
// 資料結構: users/{uid}/trips/{tripId} = { data: 旅程JSON字串, mt: 最後修改時間, deleted: 是否已刪除 }
// 每個旅程各自比 mt, 新的蓋舊的; 刪除留墓碑, 避免其他裝置又把它傳回來
const V = "10.12.2";
const { initializeApp } = await import(`https://www.gstatic.com/firebasejs/${V}/firebase-app.js`);
const A = await import(`https://www.gstatic.com/firebasejs/${V}/firebase-auth.js`);
const F = await import(`https://www.gstatic.com/firebasejs/${V}/firebase-firestore.js`);

export function start(cfg) {
  const app = initializeApp(cfg);
  const auth = A.getAuth(app);
  const db = F.getFirestore(app);
  const App = window.TravelApp;
  let col = null, unsub = null, ready = false, remote = {};

  const S = (window.TravelSync = {
    user: null,
    state: "未連線",
    login: (em, pw) => A.signInWithEmailAndPassword(auth, em, pw),
    register: (em, pw) => A.createUserWithEmailAndPassword(auth, em, pw),
    logout: () => A.signOut(auth),
    push(t) {
      // mt=0 是新裝置上沒動過的預設旅程, 不上傳
      if (!ready || !t.mt) return;
      const mt = t.mt;
      if (t.id in remote && remote[t.id] >= mt) return;
      remote[t.id] = mt;
      F.setDoc(F.doc(col, t.id), { data: JSON.stringify(t), mt, deleted: false }).catch(err);
    },
    remove(id, mt) {
      if (!ready) return;
      remote[id] = mt;
      F.setDoc(F.doc(col, id), { data: "", mt, deleted: true }).catch(err);
    },
  });
  const status = (s) => { S.state = s; };
  const err = (e) => status("同步錯誤：" + e.message);

  A.onAuthStateChanged(auth, (u) => {
    if (unsub) unsub();
    unsub = null; ready = false; remote = {};
    S.user = u ? u.email : null;
    if (!u) return status("未登入");
    status("同步中…");
    col = F.collection(db, "users", u.uid, "trips");
    unsub = F.onSnapshot(col, (snap) => {
      for (const ch of snap.docChanges()) {
        const id = ch.doc.id, d = ch.doc.data();
        if (ch.type === "removed") { delete remote[id]; continue; }
        remote[id] = d.mt;
        const local = App.get(id);
        const delAt = App.deleted()[id] || 0;
        if (d.deleted) { if (local && (local.mt || 0) <= d.mt) App.remove(id); }
        else if (delAt > d.mt) { if (ready) S.remove(id, delAt); }
        else if (!local || (local.mt || 0) < d.mt) { try { App.apply(JSON.parse(d.data)); } catch (e) { err(e); } }
      }
      if (!ready) {
        ready = true;
        // 第一次連上: 把本機比較新的旅程跟離線時刪掉的旅程補傳上去
        for (const t of App.trips()) S.push(t);
        for (const [id, mt] of Object.entries(App.deleted())) if (!(id in remote) || remote[id] < mt) S.remove(id, mt);
      }
      status(snap.metadata.hasPendingWrites ? "上傳中…" : "已同步 " + new Date().toLocaleTimeString("zh-TW"));
    }, err);
  });
}
