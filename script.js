import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, deleteDoc, collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

// 🔹 Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyCoMSY3XNJJ9jmemad545ugFVrfAM0T07M",
  authDomain: "work-3aad3.firebaseapp.com",
  projectId: "work-3aad3",
  storageBucket: "work-3aad3.appspot.com",
  messagingSenderId: "225615907016",
  appId: "1:225615907016:web:b9ccbe8331df644aa73dfd"
};

// 🔹 Firebase 초기화
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// DOM Elements
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

// 🟢 시간 계산
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

// 🔹 Firestore 로드
async function load(iso){
  const docRef = doc(db, "worklog", iso);
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? docSnap.data() : null;
}

// 🔹 선택 날짜
async function selectDate(d){
  selected=d;
  const iso=d.toISOString().slice(0,10);
  selectedBox.textContent=iso;

  const dbEntry = await load(iso);

  startInput.value = dbEntry?.start || "";
  endInput.value = dbEntry?.end || "";
  memoInput.value = dbEntry?.memo || "";
  if(dbEntry?.break){
    breakCheck.checked = true;
    breakWrap.style.display = "block";
    breakInput.value = dbEntry?.break;
  } else {
    breakCheck.checked = false;
    breakWrap.style.display = "none";
    breakInput.value = "";
  }

  renderCalendar();
  renderSelected(dbEntry);
}

function renderSelected(dbEntry){
  const iso = selected.toISOString().slice(0,10);
  const box = document.getElementById("selectedEntry");
  box.innerHTML = "";

  if(!dbEntry){
    box.innerHTML = `<div class="entry-card record-none">기록 없음</div>`;
    return;
  }

  box.innerHTML = `
    <div class="entry-card">
      <div class="entry-time">${iso} (${dbEntry.time})</div>
      <div class="entry-memo">${dbEntry.memo||""}</div>
    </div>
  `;
}

// 🔹 달력 렌더링
async function renderCalendar(){
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

    const dbEntry = await load(iso);
    if(iso === selected.toISOString().slice(0,10)) box.classList.add("selected");
    if(dbEntry) box.innerHTML += `<div class="preview">${dbEntry.time}</div>`;
    box.onclick = () => selectDate(new Date(iso));
    calendar.appendChild(box);
  }
}

// 🔹 저장
saveBtn.onclick = async () => {
  const iso = selected.toISOString().slice(0, 10);
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
  selectDate(selected);
  calcMonthTotal();
};

// 🔹 삭제
delBtn.onclick = async () => {
  const iso = selected.toISOString().slice(0,10);
  await deleteDoc(doc(db,"worklog",iso));
  renderCalendar();
  selectDate(selected);
  calcMonthTotal();
};

// 🔹 이번 달 총 근무시간
async function calcMonthTotal(){
  const y=current.getFullYear();
  const m=current.getMonth()+1;
  let sum = 0;

  // Firestore에서 월 전체 데이터 조회
  const q = query(collection(db,"worklog"));
  const querySnapshot = await getDocs(q);
  querySnapshot.forEach(docSnap=>{
    if(docSnap.id.startsWith(`${y}-${pad(m)}`)){
      sum += docSnap.data().sec;
    }
  });

  monthTotal.textContent = format(sum);
}

// 이전/다음 달
document.getElementById("prevMonth").onclick = ()=>{current.setMonth(current.getMonth()-1); renderCalendar(); calcMonthTotal();};
document.getElementById("nextMonth").onclick = ()=>{current.setMonth(current.getMonth()+1); renderCalendar(); calcMonthTotal();};

// 초기 렌더링
renderCalendar();
calcMonthTotal();
selectDate(new Date());
