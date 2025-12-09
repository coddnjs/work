import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, deleteDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";
import { getAuth, setPersistence, browserLocalPersistence, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

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
const auth = getAuth(app);

// DOM 요소
let calendar, monthTitle, selectedBox, startInput, endInput, breakInput, breakCheck, breakWrap, memoInput, saveBtn, delBtn, weekTotal, statusBox, selectedEntry;

// 날짜 상태
let current = new Date();
let selected = new Date();
let monthDataCache = {};

// 유틸
function pad(n){ return String(n).padStart(2,"0"); }
function format(sec){
  const h = Math.floor(sec/3600);
  const m = Math.floor((sec%3600)/60);
  const s = sec%60;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}
function parseTime(t){
  if(!t) return 0;
  t = t.replace(/[^0-9:]/g,"").trim();
  if(t.includes(":")){
    const [h,m,s] = t.split(":").map(Number);
    return h*3600 + m*60 + (s||0);
  }
  t = t.padStart(6,"0");
  return Number(t.slice(0,2))*3600 + Number(t.slice(2,4))*60 + Number(t.slice(4,6));
}

// DOMContentLoaded
window.addEventListener("DOMContentLoaded", () => {
  // DOM 가져오기
  calendar = document.getElementById("calendar");
  monthTitle = document.getElementById("monthTitle");
  selectedBox = document.getElementById("selectedDateBox");
  startInput = document.getElementById("startTime");
  endInput = document.getElementById("endTime");
  breakInput = document.getElementById("breakTime");
  breakCheck = document.getElementById("breakCheck");
  breakWrap = document.getElementById("breakInputWrap");
  memoInput = document.getElementById("memo");
  saveBtn = document.getElementById("save");
  delBtn = document.getElementById("delete");
  weekTotal = document.getElementById("weekTotal");
  statusBox = document.getElementById("statusBox");
  selectedEntry = document.getElementById("selectedEntry");

  // Auth persistence 설정
  setPersistence(auth, browserLocalPersistence)
    .then(() => {
      onAuthStateChanged(auth, async user => {
        if(user){
          await loadMonthData(current.getFullYear(), current.getMonth());
          renderCalendar();
          renderSelected();
          setupEvents();
        } else {
          alert("로그인이 필요합니다.");
          location.href = "login.html";
        }
      });
    }).catch(err => {
      console.error("Auth persistence 설정 실패:", err);
    });
});

// 이벤트 연결
function setupEvents(){
  breakCheck.onclick = ()=> {
    breakWrap.style.display = breakCheck.checked ? "block" : "none";
    if(!breakCheck.checked) breakInput.value="";
  };

  saveBtn.onclick = async ()=>{
    const iso = selected.toISOString().slice(0,10);
    const s = parseTime(startInput.value);
    const e = parseTime(endInput.value);
    const b = parseTime(breakInput.value);
    if(e < s) return alert("퇴근이 출근보다 빠를 수 없습니다.");
    const total = e - s - b;

    saveBtn.textContent = "저장 중...";
    await setDoc(doc(db,"worklog",iso),{
      start: startInput.value,
      end: endInput.value,
      break: breakCheck.checked ? breakInput.value : "",
      memo: memoInput.value.trim(),
      time: format(total),
      sec: total
    });
    saveBtn.textContent = "저장";

    await loadDayData(selected);
    await loadMonthData(current.getFullYear(), current.getMonth());
    renderCalendar();
    renderSelected();
  };

  delBtn.onclick = async ()=>{
    const iso = selected.toISOString().slice(0,10);
    await deleteDoc(doc(db,"worklog",iso));
    monthDataCache[iso] = null;
    renderCalendar();
    renderSelected();
  };

  document.getElementById("prevMonth").onclick = async ()=>{
    current.setMonth(current.getMonth()-1);
    await loadMonthData(current.getFullYear(), current.getMonth());
    renderCalendar();
  };
  document.getElementById("nextMonth").onclick = async ()=>{
    current.setMonth(current.getMonth()+1);
    await loadMonthData(current.getFullYear(), current.getMonth());
    renderCalendar();
  };
}

// 일별 데이터 로드
async function loadDayData(date){
  const iso = date.toISOString().slice(0,10);
  try{
    const snap = await getDoc(doc(db,"worklog",iso));
    if(snap.exists()){
      monthDataCache[iso] = snap.data();
      statusBox.textContent = "";
      return snap.data();
    } else {
      monthDataCache[iso] = null;
      return null;
    }
  }catch(e){
    console.error(e);
    statusBox.textContent = "데이터 로드 실패!";
    return null;
  }
}

// 월별 데이터 로드
async function loadMonthData(year, month){
  try{
    const snap = await getDocs(collection(db,"worklog"));
    snap.forEach(doc => {
      const iso = doc.id;
      const d = new Date(iso);
      if(d.getFullYear()===year && d.getMonth()===month){
        monthDataCache[iso] = doc.data();
      }
    });
  }catch(e){
    console.error(e);
    statusBox.textContent = "월 데이터 로드 실패!";
  }
}

// 선택 날짜 렌더링
async function renderSelected(){
  const iso = selected.toISOString().slice(0,10);
  selectedBox.textContent = iso;
  await loadDayData(selected);
  const data = monthDataCache[iso];
  startInput.value = data?.start || "";
  endInput.value = data?.end || "";
  memoInput.value = data?.memo || "";
  if(data?.break){
    breakCheck.checked = true;
    breakWrap.style.display = "block";
    breakInput.value = data.break;
  } else {
    breakCheck.checked = false;
    breakWrap.style.display = "none";
    breakInput.value = "";
  }
  calcWeekTotal(selected);

  // 하단 기록 표시
  if(data){
    selectedEntry.innerHTML = `
      <div class="entry-card">
        <div class="entry-time">${iso}<br>
        <span style="font-size:11px;font-weight:400;color:#aaa;">
          ${data.start || '--'} - ${data.end || '--'}
        </span>
        </div>
        <div class="entry-memo">${data.memo || '메모 없음'}</div>
      </div>
    `;
  } else {
    selectedEntry.innerHTML = `<div class="record-none">선택한 날짜에 기록이 없습니다.</div>`;
  }
}

// 캘린더 렌더링
function renderCalendar(){
  calendar.innerHTML = "";
  const y = current.getFullYear();
  const m = current.getMonth();
  monthTitle.textContent = `${y}년 ${m+1}월`;

  const firstDay = new Date(y,m,1).getDay();
  const lastDate = new Date(y,m+1,0).getDate();

  for(let i=0;i<firstDay;i++) calendar.appendChild(document.createElement("div"));

  for(let d=1;d<=lastDate;d++){
    const iso = `${y}-${pad(m+1)}-${pad(d)}`;
    const box = document.createElement("div");
    box.className = "day";
    box.innerHTML = `<span>${d}</span>`;

    const data = monthDataCache[iso];
    if(data && data.time){
      const preview = document.createElement("div");
      preview.className = "preview";
      preview.textContent = data.time;
      box.appendChild(preview);
    }

    if(iso === selected.toISOString().slice(0,10)) box.classList.add("selected");

    box.onclick = ()=>{
      selected = new Date(iso);
      renderSelected();
      highlightSelectedDay();
    };
    calendar.appendChild(box);
  }
}

// 선택 날짜 하이라이트
function highlightSelectedDay(){
  document.querySelectorAll(".day").forEach(d=>{
    d.classList.remove("selected");
    const span = d.querySelector("span");
    if(span && Number(span.textContent) === selected.getDate()) d.classList.add("selected");
  });
}

// 주간 합계
function calcWeekTotal(sel){
  const dayOfWeek = sel.getDay();
  const startOfWeek = new Date(sel);
  startOfWeek.setDate(sel.getDate() - dayOfWeek);
  const endOfWeek = new Date(sel);
  endOfWeek.setDate(sel.getDate() + (6 - dayOfWeek));

  let sum = 0;
  for(let d = new Date(startOfWeek); d <= endOfWeek; d.setDate(d.getDate()+1)){
    const iso = d.toISOString().slice(0,10);
    const data = monthDataCache[iso];
    if(data?.sec) sum += data.sec;
  }
  weekTotal.textContent = format(sum);
}
