// 雲端同步(Firebase Auth + Firestore)
// 私人旅程: users/{uid}/trips/{tripId} = { data: 旅程JSON字串, mt: 最後修改時間, deleted }
// 共享旅程: shared/{tripId} = { data, mt, deleted, emails: [成員Email] }, 私人那邊只留 { shared: true } 記號
// 照片/PDF: users/{uid}/files/{fileId} 或 shared/{tripId}/files/{fileId} = { d: dataURL, type }
// 每個旅程各自比 mt, 新的蓋舊的; 刪除留墓碑, 避免其他裝置又把它傳回來
const V = "10.12.2";
const { initializeApp } = await import(`https://www.gstatic.com/firebasejs/${V}/firebase-app.js`);
const A = await import(`https://www.gstatic.com/firebasejs/${V}/firebase-auth.js`);
const F = await import(`https://www.gstatic.com/firebasejs/${V}/firebase-firestore.js`);

const MAX_FILE = 950000; // Firestore 單筆上限 1MB

export function start(cfg) {
  const app = initializeApp(cfg);
  const auth = A.getAuth(app);
  const db = F.getFirestore(app);
  const App = window.TravelApp;
  let uid = null, colP = null, unsubs = [], readyP = false, readyS = false, remote = {}, marked = {};
  const ready = () => readyP && readyS;

  const S = (window.TravelSync = {
    user: null,
    state: "未連線",
    login: (em, pw) => A.signInWithEmailAndPassword(auth, em, pw),
    register: (em, pw) => A.createUserWithEmailAndPassword(auth, em, pw),
    logout: () => A.signOut(auth),
    push(t) {
      // mt=0 是新裝置上沒動過的預設旅程, 不上傳
      if (!ready() || !t.mt) return;
      if (t.id in remote && remote[t.id] >= t.mt) return;
      remote[t.id] = t.mt;
      const data = JSON.stringify(t);
      if (t.shared) {
        const emails = [...new Set((t.emails || []).map((e) => e.toLowerCase()))];
        F.setDoc(F.doc(db, "shared", t.id), { data, mt: t.mt, deleted: false, emails }).catch(err);
        if (!marked[t.id]) { marked[t.id] = 1; F.setDoc(F.doc(colP, t.id), { data: "", mt: t.mt, deleted: false, shared: true }).catch(err); }
      } else F.setDoc(F.doc(colP, t.id), { data, mt: t.mt, deleted: false }).catch(err);
    },
    remove(id, mt) {
      if (!ready()) return;
      remote[id] = mt;
      if (marked[id]) F.updateDoc(F.doc(db, "shared", id), { data: "", mt, deleted: true }).catch(err);
      else F.setDoc(F.doc(colP, id), { data: "", mt, deleted: true }).catch(err);
    },
    async putFile(t, fileId, blob) {
      if (!uid) return false;
      const d = await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob); });
      if (d.length > MAX_FILE) return "big";
      await F.setDoc(fileRef(t, fileId), { d, type: blob.type || "" });
      return true;
    },
    async getFile(t, fileId) {
      if (!uid) return null;
      for (const ref of [fileRef(t, fileId), F.doc(db, "users", uid, "files", fileId)]) {
        try { const s = await F.getDoc(ref); if (s.exists()) return await (await fetch(s.data().d)).blob(); } catch (e) { }
      }
      return null;
    },
    delFile(t, fileId) { if (uid) F.deleteDoc(fileRef(t, fileId)).catch(() => {}); },
  });
  const fileRef = (t, fileId) => t.shared ? F.doc(db, "shared", t.id, "files", fileId) : F.doc(db, "users", uid, "files", fileId);
  const status = (s) => { S.state = s; };
  const err = (e) => status("同步錯誤：" + e.message);

  // 雲端一筆旅程進來: 比 mt 決定要不要套用
  function incoming(id, d) {
    remote[id] = Math.max(remote[id] || 0, d.mt);
    const local = App.get(id);
    const delAt = App.deleted()[id] || 0;
    if (d.deleted) { if (local && (local.mt || 0) <= d.mt) App.remove(id); }
    else if (delAt > d.mt) { if (ready()) S.remove(id, delAt); }
    else if (!local || (local.mt || 0) < d.mt) { try { App.apply(JSON.parse(d.data)); } catch (e) { err(e); } }
  }
  function onReady() {
    // 第一次連上: 把本機比較新的旅程、離線時刪掉的旅程、還沒上傳的檔案補上去
    for (const t of App.trips()) S.push(t);
    for (const [id, mt] of Object.entries(App.deleted())) if (!(id in remote) || remote[id] < mt) S.remove(id, mt);
    App.uploadPending();
  }

  A.onAuthStateChanged(auth, (u) => {
    unsubs.forEach((f) => f()); unsubs = [];
    readyP = readyS = false; remote = {}; marked = {};
    uid = u ? u.uid : null;
    S.user = u ? u.email : null;
    if (!u) return status("未登入");
    status("同步中…");
    colP = F.collection(db, "users", u.uid, "trips");
    unsubs.push(F.onSnapshot(colP, (snap) => {
      for (const ch of snap.docChanges()) {
        if (ch.type === "removed") continue;
        const d = ch.doc.data();
        if (d.shared) { marked[ch.doc.id] = 1; continue; }
        incoming(ch.doc.id, d);
      }
      if (!readyP) { readyP = true; if (ready()) onReady(); }
      status(snap.metadata.hasPendingWrites ? "上傳中…" : "已同步 " + new Date().toLocaleTimeString("zh-TW"));
    }, err));
    const qS = F.query(F.collection(db, "shared"), F.where("emails", "array-contains", (u.email || "").toLowerCase()));
    unsubs.push(F.onSnapshot(qS, (snap) => {
      for (const ch of snap.docChanges()) {
        const id = ch.doc.id;
        marked[id] = 1;
        if (ch.type === "removed") { const l = App.get(id); if (l && l.shared) App.remove(id); continue; } // 被移出共享
        incoming(id, ch.doc.data());
      }
      if (!readyS) { readyS = true; if (ready()) onReady(); }
    }, (e) => {
      // 規則還沒更新時共享查詢會被拒, 不能卡住私人旅程的同步
      status("共享功能需要更新 Firestore 規則（" + e.code + "）");
      if (!readyS) { readyS = true; if (ready()) onReady(); }
    }));
  });
}
