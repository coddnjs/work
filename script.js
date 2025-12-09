// Firebase SDK import (Firestore만)
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

// Firebase 설정
const firebaseConfig = {
  apiKey: "AIzaSyCoMSY3XNJJ9jmemad545ugFVrfAM0T07M",
  authDomain: "work-3aad3.firebaseapp.com",
  projectId: "work-3aad3",
  storageBucket: "work-3aad3.appspot.com",
  messagingSenderId: "225615907016",
  appId: "1:225615907016:web:b9ccbe8331df644aa73dfd"
};

// Firebase 초기화
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

breakCheck.onclick = () => {
  breakWrap.style.display = breakCheck.checked ? "block" : "none";
  if (!breakCheck.checked) breakInput.value = "";
};

function pad(n){return String(n).padStart(2,"0");}
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

// Firestore에서 데이터 로드
async function loadDB() {
  const iso = selected.toISOString().slice(0,10);
  const docSnap = await getDoc(doc(db, "worklog", iso));
  if (docSnap.exists()) return docSnap.data();
  return null;
}

// Firestore에 저장
async function saveDB() {
  const iso = selected.toISOString().slice(0,10);
  const s = parse(startInput.value);
  const e = parse(endInput.value);
  const b = parse(breakInput.value);
  if (e < s) return alert("퇴근이 출근보다 빠를 수 없습니다.");
  const total = e - s - b;

  await setDoc(doc(db, "worklog", iso), {
    start: startInput.value,
    end: endInput.value,
    break: breakCheck.checked ? breakInput.value : "",
    memo: memoInput.value.trim(),
    time: format(total),
    sec: total
  });

  alert("저장됨!");
  renderCalendar();
  renderSelected();
  calcMonthTotal();
}

// 캘린더, 선택된 날짜, 총 근무시간 렌더링
function selectDate(d){ selected = d; renderSelected(); renderCalendar(); calcMonthTotal(); }

function renderSelected() {
  const iso = selected.toISOString().slice(0,10);
  loadDB().then(dbEntry => {
    const box = document.getElementById("selectedEntry");
    box.innerHTML = "";
    if (!dbEntry) {
      box.innerHTML = `<div class="entry-card record-none">기록 없음</div>`;
      return;
    }
    box.innerHTML = `
      <div class="entry-card">
        <div class="entry-time">${iso} (${dbEntry.time})</div>
        <div class="entry-memo">${dbEntry.memo||""}</div>
      </div>
    `;
    startInput.value = dbEntry.start || "";
    endInput.value = dbEntry.end || "";
    memoInput.value = dbEntry.memo || "";
    if(dbEntry.break){
      breakCheck.checked=true;
      breakWrap.style.display="block";
      breakInput.value=dbEntry.break;
    } else {
      breakCheck.checked=false;
      breakWrap.style.display="none";
      breakInput.value="";
    }
  });
}

function renderCalendar(){
  calendar.innerHTML="";
  const y=current.getFullYear();
  const m=current.getMonth();
  monthTitle.textContent=`${y}년 ${m+1}월`;
  const first=new Date(y,m,1).getDay();
  const last=new Date(y,m+1,0).getDate();

  for(let i=0;i<first;i++) calendar.appendChild(document.createElement("div"));

  for(let d=1;d<=last;d++){
    const iso=`${y}-${pad(m+1)}-${pad(d)}`;
    const box=document.createElement("div");
    box.className="day";
    box.innerHTML=`<span>${d}</span>`;
    if(iso===selected.toISOString().slice(0,10)) box.classList.add("selected");
    box.onclick=()=>selectDate(new Date(iso));
    calendar.appendChild(box);
  }
}

function calcMonthTotal(){
  let sum=0;
  const y=current.getFullYear();
  const m=current.getMonth()+1;
  loadDB().then(dbEntry=>{
    if(dbEntry?.sec) sum += dbEntry.sec;
    monthTotal.textContent=format(sum);
  });
}

// 버튼 이벤트
saveBtn.onclick = saveDB;
document.getElementById("prevMonth").onclick=()=>{current.setMonth(current.getMonth()-1); renderCalendar(); calcMonthTotal();}
document.getElementById("nextMonth").onclick=()=>{current.setMonth(current.getMonth()+1); renderCalendar(); calcMonthTotal();}

// 초기화
renderCalendar();
selectDate(new Date());
calcMonthTotal();
