// script.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, deleteDoc, collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

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
const weekTotal = document.getElementById("weekTotal");
const statusBox = document.getElementById("statusBox"); // 로딩/저장 메시지용
const selectedBox = document.getElementById("selectedDateBox");
const startInput = document.getElementById("startTime");
const endInput = document.getElementById("endTime");
const breakInput = document.getElementById("breakTime");
const breakCheck = document.getElementById("breakCheck");
const breakWrap = document.getElementById("breakInputWrap");
const memoInput = document.getElementById("memo");
const saveBtn = document.getElementById("save");
const delBtn = document.getElementById("delete");

let current = new Date();
let selected = new Date();
let cachedData = {}; // 날짜별 데이터 캐시

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

// Firestore 데이터 불러오기 (캐싱)
async function loadAllData(month, year){
  statusBox.textContent = "데이터 로딩 중...";
  const snapshot = await getDocs(collection(db,"worklog"));
  cachedData = {};
  snapshot.forEach(doc=>{
    if(doc.id.startsWith(`${year}-${pad(month)}`)){
      cachedData[doc.id] = doc.data();
    }
  });
  statusBox.textContent = "";
}

// 날짜 선택
function selectDate(d){
  selected = d;
  selectedBox.textContent = selected.toISOString().slice(0,10);
  const iso = selected.toISOString().slice(0,10);
  const dbData = cachedData[iso];

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
  calcWeekTotal();
}

// 캘린더 렌더링
function renderCalendar(){
  calendar.innerHTML="";
  const y=current.getFullYear();
  const m=current.getMonth()+1;
  monthTitle.textContent=`${y}년 ${m}월`;

  const first=new Date(current.getFullYear(), current.getMonth(),1).getDay();
  const last=new Date(current.getFullYear(), current.getMonth()+1,0).getDate();

  for(let i=0;i<first;i++) calendar.appendChild(document.createElement("div"));

  for(let d=1; d<=last; d++){
    const iso = `${y}-${pad(m)}-${pad(d)}`;
    const box = document.createElement("div");
    box.className="day";
    box.innerHTML=`<span>${d}</span>`;
    if(cachedData[iso]){
      box.innerHTML += `<div class="preview">${cachedData[iso].time || ""}</div>`;
    }
    if(iso === selected.toISOString().slice(0,10)) box.classList.add("selected");
    box.onclick = ()=>selectDate(new Date(iso));
    calendar.appendChild(box);
  }
}

// 주간 총 근무시간 계산
function calcWeekTotal(){
  const day = selected.getDay(); // 0~6
  const startOfWeek = new Date(selected);
  startOfWeek.setDate(selected.getDate()-day); // 일요일
  const endOfWeek = new Date(selected);
  endOfWeek.setDate(selected.getDate()+(6-day)); // 토요일

  let sum = 0;
  for(let d = new Date(startOfWeek); d <= endOfWeek; d.setDate(d.getDate()+1)){
    const iso = d.toISOString().slice(0,10);
    if(cachedData[iso]) sum += cachedData[iso].sec || 0;
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
  if(e < s) return alert("퇴근이 출근보다 빠를 수 없습니다.");
  const total = e-s-b;

  statusBox.textContent = "저장 중...";
  await setDoc(doc(db,"worklog",iso),{
    start: startInput.value,
    end: endInput.value,
    break: breakCheck.checked ? breakInput.value : "",
    memo: memoInput.value.trim(),
    time: format(total),
    sec: total
  });

  await loadAllData(current.getMonth()+1,current.getFullYear());
  selectDate(selected);
  statusBox.textContent = "저장 완료!";
  setTimeout(()=>statusBox.textContent="",1000);
};

delBtn.onclick = async ()=>{
  const iso = selected.toISOString().slice(0,10);
  statusBox.textContent = "삭제 중...";
  await deleteDoc(doc(db,"worklog",iso));
  await loadAllData(current.getMonth()+1,current.getFullYear());
  selectDate(selected);
  statusBox.textContent = "삭제 완료!";
  setTimeout(()=>statusBox.textContent="",1000);
};

// 이전/다음 달
document.getElementById("prevMonth").onclick = async ()=>{
  current.setMonth(current.getMonth()-1);
  await loadAllData(current.getMonth()+1,current.getFullYear());
  renderCalendar();
  calcWeekTotal();
};
document.getElementById("nextMonth").onclick = async ()=>{
  current.setMonth(current.getMonth()+1);
  await loadAllData(current.getMonth()+1,current.getFullYear());
  renderCalendar();
  calcWeekTotal();
};

// 초기화
onAuthStateChanged(auth,user=>{
  if(user){
    loadAllData(current.getMonth()+1,current.getFullYear()).then(()=>{
      selectDate(selected);
    });
  } else {
    statusBox.textContent = "로그인이 필요합니다.";
  }
});
