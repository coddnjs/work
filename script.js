import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

// Firebase 초기화
const firebaseConfig = {
  apiKey: "AIzaSyCoMSY3XNJJ9jmemad545ugFVrfAM0T07M",
  authDomain: "work-3aad3.firebaseapp.com",
  projectId: "work-3aad3",
  storageBucket: "work-3aad3.appspot.com",
  messagingSenderId: "225615907016",
  appId: "1:225615907016:web:b9ccbe8331df644aa73dfd"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// DOM 요소
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

let current = new Date();
let selected = new Date();

// 유틸
const pad = n => String(n).padStart(2, "0");
const format = sec => {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
};
const parse = t => {
  if (!t) return 0;
  t = t.replace(/[^0-9:]/g, "").trim();
  if (t.includes(":")) {
    const [h, m, s] = t.split(":").map(Number);
    return h * 3600 + m * 60 + (s || 0);
  }
  t = t.padStart(6, "0");
  return Number(t.slice(0, 2)) * 3600 + Number(t.slice(2, 4)) * 60 + Number(t.slice(4, 6));
};

breakCheck.onclick = () => {
  breakWrap.style.display = breakCheck.checked ? "block" : "none";
  if (!breakCheck.checked) breakInput.value = "";
};

// localStorage fallback
function load() {
  try {
    return JSON.parse(localStorage.getItem("WORKLOG") || "{}");
  } catch {
    return {};
  }
}

function saveDB(data) {
  localStorage.setItem("WORKLOG", JSON.stringify(data));
}

// 날짜 선택
function selectDate(d) {
  selected = d;
  const iso = d.toISOString().slice(0, 10);
  const dbLocal = load();
  selectedBox.textContent = iso;

  startInput.value = dbLocal[iso]?.start || "";
  endInput.value = dbLocal[iso]?.end || "";
  memoInput.value = dbLocal[iso]?.memo || "";

  if (dbLocal[iso]?.break) {
    breakCheck.checked = true;
    breakWrap.style.display = "block";
    breakInput.value = dbLocal[iso]?.break;
  } else {
    breakCheck.checked = false;
    breakWrap.style.display = "none";
    breakInput.value = "";
  }

  renderCalendar();
  renderSelected();
}

// 달력 렌더링
function renderCalendar() {
  calendar.innerHTML = "";
  const y = current.getFullYear();
  const m = current.getMonth();
  monthTitle.textContent = `${y}년 ${m + 1}월`;

  const first = new Date(y, m, 1).getDay();
  const last = new Date(y, m + 1, 0).getDate();
  const dbLocal = load();

  for (let i = 0; i < first; i++) calendar.appendChild(document.createElement("div"));

  for (let d = 1; d <= last; d++) {
    const iso = `${y}-${pad(m + 1)}-${pad(d)}`;
    const box = document.createElement("div");
    box.className = "day";
    box.innerHTML = `<span>${d}</span>`;
    if (iso === selected.toISOString().slice(0, 10)) box.classList.add("selected");
    if (dbLocal[iso]) box.innerHTML += `<div class="preview">${dbLocal[iso].time}</div>`;
    if (d % 7 === 0) box.querySelector("span").style.color = "#3b66d6"; // 토
    if ((d + first) % 7 === 1) box.querySelector("span").style.color = "#d64545"; // 일
    box.onclick = () => selectDate(new Date(iso));
    calendar.appendChild(box);
  }
}

// 선택한 날짜 표시
function renderSelected() {
  const iso = selected.toISOString().slice(0, 10);
  const dbLocal = load()[iso];
  const box = document.getElementById("selectedEntry");
  box.innerHTML = "";

  if (!dbLocal) {
    box.innerHTML = `<div class="entry-card record-none">기록 없음</div>`;
    return;
  }

  box.innerHTML = `
    <div class="entry-card">
      <div class="entry-time">${iso} (${dbLocal.time})</div>
      <div class="entry-memo">${dbLocal.memo || ""}</div>
    </div>
  `;
}

// 저장
saveBtn.onclick = async () => {
  const iso = selected.toISOString().slice(0, 10);
  const s = parse(startInput.value);
  const e = parse(endInput.value);
  const b = parse(breakInput.value);

  if (e < s) return alert("퇴근이 출근보다 빠를 수 없습니다.");

  const total = e - s - b;

  const data = {
    start: startInput.value,
    end: endInput.value,
    break: breakCheck.checked ? breakInput.value : "",
    memo: memoInput.value.trim(),
    time: format(total),
    sec: total
  };

  saveDB({ ...load(), [iso]: data });

  try {
    await setDoc(doc(db, "worklog", iso), data);
  } catch {
    console.warn("Firestore 저장 실패, localStorage에만 저장됨");
  }

  renderCalendar();
  renderSelected();
  calcMonthTotal();
};

// 월 총합
function calcMonthTotal() {
  const dbLocal = load();
  const y = current.getFullYear();
  const m = current.getMonth() + 1;
  let sum = 0;

  Object.keys(dbLocal).forEach(k => {
    if (k.startsWith(`${y}-${pad(m)}`)) sum += dbLocal[k].sec;
  });

  monthTotal.textContent = format(sum);
}

// 이전/다음 달
document.getElementById("prevMonth").onclick = () => { current.setMonth(current.getMonth() - 1); renderCalendar(); calcMonthTotal(); };
document.getElementById("nextMonth").onclick = () => { current.setMonth(current.getMonth() + 1); renderCalendar(); calcMonthTotal(); };

// 초기 렌더
renderCalendar();
calcMonthTotal();
selectDate(new Date());
