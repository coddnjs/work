import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, deleteDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

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
const selectedEntryBox = document.getElementById("selectedEntry");

let current = new Date();
let selected = new Date();

// 캐시
let monthDataCache = {}; // { "YYYY-MM-DD": {...} }
let cacheYear = null;
let cacheMonth = null;

// 유틸
function pad(n){ return String(n).padStart(2,"0"); }
function format(sec){
  const h=Math.floor(sec/3600);
  const m=Math.floor((sec%3600)/60);
  const s=sec%60;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}
function parse(t){
  if(!t) return 0;
  t=t.replace(/[^0-9:]/g,"").trim();
  if(t.includes(":")){
    const [h,m,s]=t.split(":").map(Number);
    return h*3600+m*60+(s||0);
  }
  t=t.padStart(6,"0");
  return Number(t.slice(0,2))*3600 + Number(t.slice(2,4))*60 + Number(t.slice(4,6));
}

// 한 달치 데이터 불러오기
async function loadMonthData(year, month){
  monthDataCache = {};
  cacheYear = year;
  cacheMonth = month;
  monthTitle.textContent = `${year}년 ${month}월`;
  calendar.innerHTML = "로딩중...";

  const snapshot = await getDocs(collection(db,"worklog"));
  snapshot.forEach(doc => {
    if(doc.id.startsWith(`${year}-${pad(month)}`)){
      monthDataCache[doc.id] = doc.data();
    }
  });

  renderCalendar();
  calcMonthTotal();
}

// 캘린더 렌더링
function renderCalendar(){
  calendar.innerHTML="";
  const y = current.getFullYear();
  const m = current.getMonth();
  const first = new Date(y,m,1).getDay();
  const last = new Date(y,m+1,0).getDate();

  for(let i=0;i<first;i++) calendar.appendChild(document.createElement("div"));

  for(let d=1; d<=last; d++){
    const iso = `${y}-${pad(m+1)}-${pad(d)}`;
    const box = document.createElement("div");
    box.className = "day";
    box.innerHTML = `<span>${d}</span>`;
    if(monthDataCache[iso]) box.innerHTML+=`<div class="preview">${monthDataCache[iso].time}</div>`;
    if(iso === selected.toISOString().slice(0,10)) box.classList.add("selected");
    box.onclick = () => selectDate(iso);
    calendar.appendChild(box);
  }
}

// 날짜 선택 (캐시 사용)
function selectDate(iso){
  selected = new Date(iso);
  selectedBox.textContent = iso;
  const dbData = monthDataCache[iso] || null;

  startInput.value = dbData?.start || "";
  endInput.value = dbData?.end || "";
  memoInput.value = dbData?.memo || "";
  if(dbData?.break){
    breakCheck.checked = true;
    breakWrap.style.display = "block";
    breakInput.value = dbData.break;
  } else {
    breakCheck.checked = false;
    breakWrap.style.display = "none";
    breakInput.value = "";
  }

  renderSelectedCached(iso, dbData);
}

function renderSelectedCached(iso, dbData){
  if(!dbData){
    selectedEntryBox.innerHTML = `<div class="entry-card record-none">기록 없음</div>`;
    return;
  }
  selectedEntryBox.innerHTML = `
    <div class="entry-card">
      <div class="entry-time">${iso} (${dbData.time})</div>
      <div class="entry-memo">${dbData.memo||""}</div>
    </div>
  `;
}

// 저장
saveBtn.onclick = async ()=>{
  const iso = selected.toISOString().slice(0,10);
  const s = parse(startInput.value);
  const e = parse(endInput.value);
  const b = parse(breakInput.value);
  if(e < s) return alert("퇴근이 출근보다 빠를 수 없습니다.");
  const total = e-s-b;

  saveBtn.disabled = true;
  saveBtn.textContent = "저장중...";

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

  renderCalendar();
  renderSelectedCached(iso, monthDataCache[iso]);
  calcMonthTotal();

  saveBtn.disabled = false;
  saveBtn.textContent = "저장";
  alert("저장되었습니다!");
};

// 삭제
delBtn.onclick = async ()=>{
  const iso = selected.toISOString().slice(0,10);
  if(!monthDataCache[iso]) return alert("삭제할 데이터가 없습니다.");

  if(!confirm("정말 삭제하시겠습니까?")) return;

  await deleteDoc(doc(db,"worklog",iso));
  delete monthDataCache[iso];
  renderCalendar();
  selectDate(iso);
  calcMonthTotal();
};

// 월 총합
function calcMonthTotal(){
  let sum = 0;
  Object.values(monthDataCache).forEach(d=>{ sum += d.sec || 0; });
  monthTotal.textContent = format(sum);
}

// 브레이크 체크
breakCheck.onclick = ()=> {
  breakWrap.style.display = breakCheck.checked ? "block":"none";
  if(!breakCheck.checked) breakInput.value="";
};

// 이전/다음 월
document.getElementById("prevMonth").onclick=()=>{
  current.setMonth(current.getMonth()-1);
  loadMonthData(current.getFullYear(), current.getMonth()+1);
};
document.getElementById("nextMonth").onclick=()=>{
  current.setMonth(current.getMonth()+1);
  loadMonthData(current.getFullYear(), current.getMonth()+1);
};

// 초기
onAuthStateChanged(auth, (user)=>{
  if(user){
    loadMonthData(current.getFullYear(), current.getMonth()+1);
    selectDate(selected.toISOString().slice(0,10));
  } else {
    alert("로그인 필요");
    location.href="login.html";
  }
});
