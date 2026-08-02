/**
 * BEP 시나리오 저장소 — Firestore 어댑터
 *
 * 지금까지 시뮬레이터가 쓰던 localStorage + 파일 저장 방식을 대체한다.
 * 브라우저 새로고침·기기 변경과 무관하게 같은 시나리오를 보게 하는 것이 목적이다.
 *
 * 컬렉션 : bep_scenarios/{id}
 *   { version, name, note, params, kpi, createdAt, updatedAt, updatedBy }
 *
 * 규칙 : 관리자만 읽고 쓴다. 참가자 앱에는 노출하지 않는다.
 */

import { normalizeParams, makeScenario, SCENARIO_VERSION } from "./bepModel.js";

const COLLECTION = "bep_scenarios";

/**
 * @param {import("firebase/firestore").Firestore} db
 * @param {object} fs  firebase/firestore 에서 가져온 함수 묶음
 *   { collection, doc, getDocs, getDoc, setDoc, deleteDoc, serverTimestamp, query, orderBy }
 */
export function createStore(db, fs) {
  const col = () => fs.collection(db, COLLECTION);

  return {
    /** 목록 — 최근 수정순 */
    async list() {
      const snap = await fs.getDocs(fs.query(col(), fs.orderBy("updatedAt", "desc")));
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    },

    async get(id) {
      const d = await fs.getDoc(fs.doc(db, COLLECTION, id));
      if (!d.exists()) return null;
      const raw = d.data();
      return { id: d.id, ...raw, params: normalizeParams(raw.params) };
    },

    /**
     * 저장. id 를 주면 덮어쓰고, 없으면 새로 만든다.
     * kpi 는 저장 시점에 서버가 다시 계산해 넣는다 — 클라이언트 값을 믿지 않는다.
     */
    async save({ id, name, note, params, uid }) {
      const doc = makeScenario(name, normalizeParams(params), note);
      const ref = id ? fs.doc(db, COLLECTION, id) : fs.doc(col());
      await fs.setDoc(
        ref,
        {
          ...doc,
          updatedAt: fs.serverTimestamp(),
          updatedBy: uid || null,
          ...(id ? {} : { createdAt: fs.serverTimestamp() }),
        },
        { merge: true }
      );
      return ref.id;
    },

    async remove(id) {
      await fs.deleteDoc(fs.doc(db, COLLECTION, id));
    },
  };
}

/* ───────── 서버(Admin SDK)용 ───────── */

/** @param {FirebaseFirestore.Firestore} db  firebase-admin 의 firestore() */
export function createAdminStore(db) {
  const col = db.collection(COLLECTION);
  return {
    async list() {
      const snap = await col.orderBy("updatedAt", "desc").get();
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    },
    async get(id) {
      const d = await col.doc(id).get();
      return d.exists ? { id: d.id, ...d.data() } : null;
    },
    async save({ id, name, note, params, uid }) {
      const doc = makeScenario(name, normalizeParams(params), note);
      const ref = id ? col.doc(id) : col.doc();
      await ref.set(
        {
          ...doc,
          updatedAt: new Date(),
          updatedBy: uid || null,
          ...(id ? {} : { createdAt: new Date() }),
        },
        { merge: true }
      );
      return ref.id;
    },
    async remove(id) {
      await col.doc(id).delete();
    },
  };
}

export { COLLECTION, SCENARIO_VERSION };
