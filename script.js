import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, deleteDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signInWithPopup, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

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
const selectedEntry = document.getElementById("selectedEntry");
const statusMsg = document.createElement("div");
statusMsg.style.marginBottom = "8px";
statusMsg.style.fontSize = "13px";
statusMsg.style.color = "#555";

// 상태
let current = new Date();
let selected = new Date();
let monthDataCache = {}; // { 'YYYY-MM-DD': { start, end, memo, break, time, sec } }

// 유틸
function pad(n){ return String(n).padStart(2,"0"); }
function format(sec){
  const h=Math.floor(sec/3600);
  const m=Math.floor((sec%3600)/60);
  const s=sec%60;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}
function parseTime(t){
  if(!t) return 0;
  t=t.replace(/[^0-9:]/g,"").trim();
  if(t.includes(":")){
    const [h,m,s]=t.split(":").map(Number);
    return h*3600+m*60+(s||0);
  }
  t=t.padStart(6,"0");
  return Number(t.slice(0,2))*3600 + Number(t.slice(2,4))*60 + Number(t.slice(4,6));
}

// 월 데이터 불러오기 (한 번만)
async function loadMonthData(y,m){
  statusMsg.textContent = "데이터 불러오는 중...";
  calendar.parentNode.insertBefore(statusMsg, calendar);
  monthDataCache = {};
  try {
    const snapshot = await getDocs(collection(db,"worklog"));
    snapshot.forEach(doc=>{
      if(doc.id.startsWith(`${y}-${pad(m+1)}`)){
        monthDataCache[doc.id] = doc.data();
      }
    });
  } catch(e){
    console.error("월 데이터 불러오기 실패:", e);
    statusMsg.textContent = "데이터 불러오기 실패!";
    return;
  }
  statusMsg.textContent = "";
}

// 선택 날짜 렌더
function renderSelected(){
  const iso = selected.toISOString().slice(0,10);
  const data = monthDataCache[iso];
  if(!data){
    selectedEntry.innerHTML = `<div class="entry-card record-none">기록 없음</div>`;
    startInput.value = "";
    endInput.value = "";
    memoInput.value = "";
    breakCheck.checked = false;
    breakWrap.style.display = "none";
    breakInput.value = "";
    return;
  }

  selectedEntry.innerHTML = `
    <div class="entry-card">
      <div class="entry-time">${iso} (${data.time})</div>
      <div class="entry-memo">${data.memo||""}</div>
    </div>
  `;

  startInput.value = data.start||"";
  endInput.value = data.end||"";
  memoInput.value = data.memo||"";
  if(data.break){
    breakCheck.checked = true;
    breakWrap.style.display = "block";
    breakInput.value = data.break;
  } else {
    breakCheck.checked = false;
    breakWrap.style.display = "none";
    breakInput.value = "";
  }
}

// 캘린더 렌더 (월 기준, 한 번만)
function renderCalendar(){
  calendar.innerHTML="";
  const y = current.getFullYear();
  const m = current.getMonth();
  monthTitle.textContent = `${y}년 ${m+1}월`;

  const first = new Date(y,m,1).getDay();
  const last = new Date(y,m+1,0).getDate();

  for(let i=0;i<first;i++) calendar.appendChild(document.createElement("div"));

  for(let d=1; d<=last; d++){
    const iso=`${y}-${pad(m+1)}-${pad(d)}`;
    const box=document.createElement("div");
    box.className="day";
    box.innerHTML=`<span>${d}</span>`;
    if(monthDataCache[iso]) box.innerHTML += `<div class="preview">${monthDataCache[iso].time}</div>`;
    if(iso===selected.toISOString().slice(0,10)) box.classList.add("selected");
    box.onclick = ()=>{
      selected = new Date(iso);
      renderSelected();
      highlightSelectedDay();
    };
    calendar.appendChild(box);
  }
}

// 선택 날짜 강조
function highlightSelectedDay(){
  document.querySelectorAll(".day").forEach(d=>{
    d.classList.remove("selected");
    const span = d.querySelector("span");
    if(span && `${current.getFullYear()}-${pad(current.getMonth()+1)}-${pad(span.textContent)}` === selected.toISOString().slice(0,10)){
      d.classList.add("selected");
    }
  });
}

// 월 총합 계산
function calcMonthTotal(){
  const y = current.getFullYear();
  const m = current.getMonth();
  let sum = 0;
  for(const key in monthDataCache){
    if(key.startsWith(`${y}-${pad(m+1)}`)) sum += monthDataCache[key].sec||0;
  }
  monthTotal.textContent = format(sum);
}

// 이벤트
breakCheck.onclick = ()=> {
  breakWrap.style.display = breakCheck.checked ? "block":"none";
  if(!breakCheck.checked) breakInput.value="";
};

saveBtn.onclick = async ()=>{
  const iso = selected.toISOString().slice(0,10);
  const s = parseTime(startInput.value);
  const e = parseTime(endInput.value);
  const b = parseTime(breakInput.value);
  if(e < s){ alert("퇴근이 출근보다 빠를 수 없습니다."); return; }

  const total = e-s-b;
  statusMsg.textContent = "저장 중...";
  try {
    await setDoc(doc(db,"worklog",iso),{
      start: startInput.value,
      end: endInput.value,
      break: breakCheck.checked ? breakInput.value : "",
      memo: memoInput.value.trim(),
      time: format(total),
      sec: total
    });
    monthDataCache[iso] = {
      start: startInput.value,
      end: endInput.value,
      break: breakCheck.checked ? breakInput.value : "",
      memo: memoInput.value.trim(),
      time: format(total),
      sec: total
    };
  } catch(e){
    console.error("저장 실패:", e);
    statusMsg.textContent = "저장 실패!";
    return;
  }
  statusMsg.textContent = "";
  renderCalendar();
  renderSelected();
  calcMonthTotal();
};

// 삭제
delBtn.onclick = async ()=>{
  const iso = selected.toISOString().slice(0,10);
  if(!monthDataCache[iso]) return;
  if(!confirm("삭제하시겠습니까?")) return;

  statusMsg.textContent = "삭제 중...";
  try {
    await deleteDoc(doc(db,"worklog",iso));
    delete monthDataCache[iso];
  } catch(e){
    console.error("삭제 실패:", e);
    statusMsg.textContent = "삭제 실패!";
    return;
  }
  statusMsg.textContent = "";
  renderCalendar();
  renderSelected();
  calcMonthTotal();
};

// 이전/다음 달
document.getElementById("prevMonth").onclick=async ()=>{
  current.setMonth(current.getMonth()-1);
  await loadMonthData(current.getFullYear(), current.getMonth());
  renderCalendar();
  renderSelected();
  calcMonthTotal();
};
document.getElementById("nextMonth").onclick=async ()=>{
  current.setMonth(current.getMonth()+1);
  await loadMonthData(current.getFullYear(), current.getMonth());
  renderCalendar();
  renderSelected();
  calcMonthTotal();
};

// 초기 로딩
(async()=>{
  await loadMonthData(current.getFullYear(), current.getMonth());
  renderCalendar();
  renderSelected();
  calcMonthTotal();
})();
