import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, deleteDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

// Firebase 설정
const firebaseConfig = {
  apiKey: "AIzaSyCoMSY3XNJJ9jmemad545ugFVrfAM0T07M",
  authDomain: "work-3aad3.firebaseapp.com",
  projectId: "work-3aad3",
  storageBucket: "work-3aad3.firebasestorage.app",
  messagingSenderId: "225615907016",
  appId: "1:225615907016:web:b9ccbe8331df644aa73dfd"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// DOM
const calendar = document.getElementById("calendar");
const monthTitle = document.getElementById("monthTitle");
const selectedBox = document.getElementById("selectedDateBox");
const startInput = document.getElementById("startTime");
const endInput = document.getElementById("endTime");
const breakInput = document.getElementById("breakTime");
const breakCheck = document.getElementById("breakCheck");
const breakWrap = document.getElementById("breakInputWrap");
const memoInput = document.getElementById("memo");
const saveBtn = document.getElementById("save");
const delBtn = document.getElementById("delete");
const monthTotal = document.getElementById("monthTotal");
const selectedEntryBox = document.getElementById("selectedEntry");

// 상태 표시용
const statusBox = document.createElement("div");
statusBox.style.fontSize = "13px";
statusBox.style.color = "#1b64da";
statusBox.style.marginTop = "4px";
selectedBox.parentNode.appendChild(statusBox);

// 날짜 캐시
const dayCache = {};

let current = new Date();
let selected = new Date();

// 유틸
function pad(n) { return String(n).padStart(2, "0"); }
function format(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}
function parse(t) {
  if (!t) return 0;
  t = t.replace(/[^0-9:]/g, "").trim();
  if (t.includes(":")) {
    const [h, m, s] = t.split(":").map(Number);
    return h * 3600 + m * 60 + (s || 0);
  }
  t = t.padStart(6, "0");
  return Number(t.slice(0, 2)) * 3600 + Number(t.slice(2, 4)) * 60 + Number(t.slice(4, 6));
}

// Firestore에서 데이터 불러오기 (캐시 없이 직접)
async function fetchDayData(date) {
  const iso = date.toISOString().slice(0, 10);
  try {
    const snap = await getDoc(doc(db, "worklog", iso));
    const data = snap.exists() ? snap.data() : null;
    dayCache[iso] = data; // 캐시에 저장
    return data;
  } catch (err) {
    console.error("Firestore 접근 실패:", err);
    return null;
  }
}

// selectDate 시 캐시 활용
async function selectDate(d) {
  selected = d;
  const iso = selected.toISOString().slice(0, 10);
  selectedBox.textContent = iso;

  // 캐시 확인
  let dbData = dayCache[iso];
  if (!dbData) dbData = null; // 캐시 없으면 아무 것도 표시하지 않음
  startInput.value = dbData?.start || "";
  endInput.value = dbData?.end || "";
  memoInput.value = dbData?.memo || "";
  if (dbData?.break) {
    breakCheck.checked = true;
    breakWrap.style.display = "block";
    breakInput.value = dbData.break;
  } else {
    breakCheck.checked = false;
    breakWrap.style.display = "none";
    breakInput.value = "";
  }

  renderSelectedCached();
  renderCalendarPreview();
}

// 캐시 데이터를 사용해서 선택된 날짜 렌더링
function renderSelectedCached() {
  const iso = selected.toISOString().slice(0, 10);
  const db = dayCache[iso];
  if (!db) {
    selectedEntryBox.innerHTML = `<div class="entry-card record-none">기록 없음</div>`;
    return;
  }
  selectedEntryBox.innerHTML = `
    <div class="entry-card">
      <div class="entry-time">${iso} (${db.time})</div>
      <div class="entry-memo">${db.memo || ""}</div>
    </div>
  `;
}

// 캘린더 렌더링 (미리보기만)
function renderCalendarPreview() {
  calendar.innerHTML = "";
  const y = current.getFullYear();
  const m = current.getMonth();
  monthTitle.textContent = `${y}년 ${m + 1}월`;

  const first = new Date(y, m, 1).getDay();
  const last = new Date(y, m + 1, 0).getDate();

  for (let i = 0; i < first; i++) calendar.appendChild(document.createElement("div"));

  for (let d = 1; d <= last; d++) {
    const iso = `${y}-${pad(m + 1)}-${pad(d)}`;
    const box = document.createElement("div");
    box.className = "day";
    box.innerHTML = `<span>${d}</span>`;
    const dbData = dayCache[iso];
    if (dbData) box.innerHTML += `<div class="preview">${dbData.time}</div>`;
    if (iso === selected.toISOString().slice(0, 10)) box.classList.add("selected");
    box.onclick = () => selectDate(new Date(iso));
    calendar.appendChild(box);
  }
}

// 이벤트
breakCheck.onclick = () => {
  breakWrap.style.display = breakCheck.checked ? "block" : "none";
  if (!breakCheck.checked) breakInput.value = "";
};

saveBtn.onclick = async () => {
  const iso = selected.toISOString().slice(0, 10);
  const s = parse(startInput.value);
  const e = parse(endInput.value);
  const b = parse(breakInput.value);
  if (e < s) return alert("퇴근이 출근보다 빠를 수 없습니다.");
  const total = e - s - b;

  statusBox.textContent = "저장 중입니다...";
  saveBtn.disabled = true;

  try {
    await setDoc(doc(db, "worklog", iso), {
      start: startInput.value,
      end: endInput.value,
      break: breakCheck.checked ? breakInput.value : "",
      memo: memoInput.value.trim(),
      time: format(total),
      sec: total
    });
    // 캐시 갱신
    dayCache[iso] = {
      start: startInput.value,
      end: endInput.value,
      break: breakCheck.checked ? breakInput.value : "",
      memo: memoInput.value.trim(),
      time: format(total),
      sec: total
    };
    renderSelectedCached();
    renderCalendarPreview();
    calcMonthTotal();
    statusBox.textContent = "저장 완료!";
  } catch (err) {
    console.error("저장 실패:", err);
    statusBox.textContent = "저장 실패!";
  } finally {
    saveBtn.disabled = false;
    setTimeout(() => (statusBox.textContent = ""), 1500);
  }
};

delBtn.onclick = async () => {
  const iso = selected.toISOString().slice(0, 10);
  if (!confirm("삭제하시겠습니까?")) return;

  statusBox.textContent = "삭제 중...";
  delBtn.disabled = true;

  try {
    await deleteDoc(doc(db, "worklog", iso));
    dayCache[iso] = null; // 캐시 삭제
    startInput.value = "";
    endInput.value = "";
    breakInput.value = "";
    breakCheck.checked = false;
    memoInput.value = "";
    renderSelectedCached();
    renderCalendarPreview();
    calcMonthTotal();
    statusBox.textContent = "삭제 완료!";
  } catch (err) {
    console.error("삭제 실패:", err);
    statusBox.textContent = "삭제 실패!";
  } finally {
    delBtn.disabled = false;
    setTimeout(() => (statusBox.textContent = ""), 1500);
  }
};

// 이번 달 총 시간 계산
function calcMonthTotal() {
  const y = current.getFullYear();
  const m = current.getMonth() + 1;
  let sum = 0;
  Object.keys(dayCache).forEach(date => {
    if (date.startsWith(`${y}-${pad(m)}`)) sum += dayCache[date]?.sec || 0;
  });
  monthTotal.textContent = format(sum);
}

// 이전/다음 달
document.getElementById("prevMonth").onclick = () => {
  current.setMonth(current.getMonth() - 1);
  renderCalendarPreview();
  calcMonthTotal();
};
document.getElementById("nextMonth").onclick = () => {
  current.setMonth(current.getMonth() + 1);
  renderCalendarPreview();
  calcMonthTotal();
};

// 초기
selectDate(new Date());
