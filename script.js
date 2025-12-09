import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";
import { getAuth, signOut, onAuthStateChanged, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

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
const weekTotal = document.getElementById("weekTotal");
const infoBox = document.getElementById("infoBox"); // 위쪽 알림 영역
const loginBtn = document.getElementById("loginBtn"); // 위쪽 로그인 버튼

let current = new Date();
let selected = new Date();
let cachedData = {}; // 날짜별 캐시

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

// Firestore 데이터 로드
async function loadDayData(date){
  const iso = date.toISOString().slice(0,10);
  if(cachedData[iso]) return cachedData[iso]; // 캐시 반환
  try{
    const snap = await getDoc(doc(db,"worklog",iso));
    if(snap.exists()){
      cachedData[iso] = snap.data();
      return snap.data();
    } 
    return null;
  }catch(e){
    console.error("Firestore 접근 실패:", e);
    showError("데이터 불러오기 실패");
    return null;
  }
}

// 캘린더 렌더링
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

// 선택 날짜 반영
async function selectDate(d){
  selected = d;
  selectedBox.textContent = selected.toISOString().slice(0,10);

  const dbData = await loadDayData(selected);
  startInput.value = dbData?.start||"";
  endInput.value = dbData?.end||"";
  memoInput.value = dbData?.memo||"";
  if(dbData?.break){
    breakCheck.checked=true;
    breakWrap.style.display="block";
    breakInput.value=dbData.break;
  } else {
    breakCheck.checked=false;
    breakWrap.style.display="none";
    breakInput.value="";
  }

  renderSelected();
  calcWeekTotal();
}

// 선택 날짜 상세 표시
function renderSelected(){
  const box = document.getElementById("selectedEntry");
  const iso = selected.toISOString().slice(0,10);
  const db = cachedData[iso];
  if(!db){
    box.innerHTML=`<div class="entry-card record-none">기록 없음</div>`;
    return;
  }
  box.innerHTML=`
    <div class="entry-card">
      <div class="entry-time">${db.time}</div>
      <div class="entry-memo">${db.memo||""}</div>
    </div>
  `;
}

// 이번주 총 근무시간 계산
function calcWeekTotal(){
  const startOfWeek = new Date(selected);
  startOfWeek.setDate(selected.getDate() - selected.getDay()); // 일요일 기준
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate()+6);

  let sum = 0;
  for(let d = new Date(startOfWeek); d <= endOfWeek; d.setDate(d.getDate()+1)){
    const iso = d.toISOString().slice(0,10);
    if(cachedData[iso]?.sec) sum += cachedData[iso].sec;
  }
  weekTotal.textContent = format(sum);
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
  if(e<s) return alert("퇴근이 출근보다 빠를 수 없습니다.");
  const total = e-s-b;

  infoBox.textContent = "저장 중입니다...";
  await setDoc(doc(db,"worklog",iso),{
    start: startInput.value,
    end: endInput.value,
    break: breakCheck.checked ? breakInput.value : "",
    memo: memoInput.value.trim(),
    time: format(total),
    sec: total
  });
  cachedData[iso]={start:startInput.value,end:endInput.value,break:breakCheck.checked?breakInput.value:"",memo:memoInput.value.trim(),time:format(total),sec:total};

  infoBox.textContent = "저장 완료!";
  renderCalendar();
  renderSelected();
  calcWeekTotal();
  setTimeout(()=>infoBox.textContent="",2000);
};

delBtn.onclick=async()=>{
  const iso = selected.toISOString().slice(0,10);
  if(!confirm("정말 삭제하시겠습니까?")) return;
  infoBox.textContent="삭제 중입니다...";
  await deleteDoc(doc(db,"worklog",iso));
  cachedData[iso]=null;
  infoBox.textContent="삭제 완료!";
  renderCalendar();
  renderSelected();
  calcWeekTotal();
  setTimeout(()=>infoBox.textContent="",2000);
};

document.getElementById("prevMonth").onclick=()=>{
  current.setMonth(current.getMonth()-1);
  cachedData={}; // 새 달 로드 시 캐시 초기화
  renderCalendar();
  calcWeekTotal();
};
document.getElementById("nextMonth").onclick=()=>{
  current.setMonth(current.getMonth()+1);
  cachedData={};
  renderCalendar();
  calcWeekTotal();
};

// 초기
window.addEventListener("DOMContentLoaded", async ()=>{
  await renderCalendar();
  await selectDate(new Date()); // 최초 로드 시 오늘 데이터 표시
});
