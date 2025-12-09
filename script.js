// Firebase 모듈 import
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import { initializeFirestore, doc, getDoc, setDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

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

// Firestore persistence 비활성화
const db = initializeFirestore(app, { localCache: 'none' });

// Auth 초기화
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

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
const monthTotal = document.getElementById("monthTotal");

let current = new Date();
let selected = new Date();

// Utility
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

// Firestore 데이터 불러오기
async function loadDayData(date){
  const iso = date.toISOString().slice(0,10);
  try {
    const docRef = doc(db, "worklog", iso);
    const snap = await getDoc(docRef);
    return snap.exists() ? snap.data() : null;
  } catch(err){
    console.error("Firestore 접근 실패:", err);
    return null;
  }
}

// 날짜 선택
async function selectDate(d){
  selected = d;
  selectedBox.textContent = selected.toISOString().slice(0,10);

  const dbData = await loadDayData(selected);
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

  renderCalendar();
  renderSelected();
}

// 달력 렌더링
async function renderCalendar(){
  calendar.innerHTML="";
  const y=current.getFullYear();
  const m=current.getMonth();
  monthTitle.textContent=`${y}년 ${m+1}월`;

  const first=new Date(y,m,1).getDay();
  const last=new Date(y,m+1,0).getDate();

  for(let i=0;i<first;i++) calendar.appendChild(document.createElement("div"));

  for(let d=1; d<=last; d++){
    const iso=`${y}-${pad(m+1)}-${pad(d)}`;
    const box=document.createElement("div");
    box.className="day";
    box.innerHTML=`<span>${d}</span>`;
    const dbData = await loadDayData(new Date(iso));
    if(dbData) box.innerHTML+=`<div class="preview">${dbData.time}</div>`;
    if(iso===selected.toISOString().slice(0,10)) box.classList.add("selected");
    box.onclick = ()=>selectDate(new Date(iso));
    calendar.appendChild(box);
  }
}

// 선택된 날짜 내용 렌더링
function renderSelected(){
  const iso = selected.toISOString().slice(0,10);
  const box = document.getElementById("selectedEntry");
  loadDayData(selected).then(db=>{
    if(!db){
      box.innerHTML = `<div class="entry-card record-none">기록 없음</div>`;
      return;
    }
    box.innerHTML = `
      <div class="entry-card">
        <div class="entry-time">${iso} (${db.time})</div>
        <div class="entry-memo">${db.memo||""}</div>
      </div>
    `;
  });
}

// 이벤트
breakCheck.onclick = ()=> {
  breakWrap.style.display = breakCheck.checked ? "block":"none";
  if(!breakCheck.checked) breakInput.value="";
};

saveBtn.onclick = async ()=>{
  const iso = selected.toISOString().slice(0,10);
  const s = parse(startInput.value);
  const e = parse(endInput.value);
  const b = parse(breakInput.value);
  if(e < s) return alert("퇴근이 출근보다 빠를 수 없습니다.");
  const total = e-s-b;

  await setDoc(doc(db,"worklog",iso),{
    start: startInput.value,
    end: endInput.value,
    break: breakCheck.checked ? breakInput.value : "",
    memo: memoInput.value.trim(),
    time: format(total),
    sec: total
  });

  alert("저장되었습니다!");
  renderCalendar();
  renderSelected();
  calcMonthTotal();
};

function calcMonthTotal(){
  const y=current.getFullYear();
  const m=current.getMonth()+1;
  let sum=0;
  getDocs(collection(db,"worklog")).then(snapshot=>{
    snapshot.forEach(doc=>{
      if(doc.id.startsWith(`${y}-${pad(m)}`)){
        sum += doc.data().sec || 0;
      }
    });
    monthTotal.textContent=format(sum);
  });
}

document.getElementById("prevMonth").onclick=()=>{
  current.setMonth(current.getMonth()-1);
  renderCalendar();
  calcMonthTotal();
};
document.getElementById("nextMonth").onclick=()=>{
  current.setMonth(current.getMonth()+1);
  renderCalendar();
  calcMonthTotal();
};

// 🔹 Auth 상태 감지 후 초기화
onAuthStateChanged(auth, user=>{
  if(user){
    console.log("로그인 성공:", user.email);
    // 로그인 완료 후 달력 렌더링
    selectDate(new Date());
    calcMonthTotal();
  } else {
    // 로그인 안 된 경우 login.html로 이동
    window.location.href = "login.html";
  }
});
