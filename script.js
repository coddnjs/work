import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, deleteDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

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
let calendar, monthTitle, selectedBox, startInput, endInput, breakInput, breakCheck, breakWrap, memoInput, saveBtn, delBtn, weekTotal, statusBox;

let current = new Date();
let selected = new Date();
let cacheData = {}; // 날짜별 캐시

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

async function loadDayData(date, force=false){
  const iso = date.toISOString().slice(0,10);
  if(!force && cacheData[iso]) return cacheData[iso];
  try{
    const snap = await getDoc(doc(db,"worklog",iso));
    const data = snap.exists()? snap.data():null;
    cacheData[iso] = data;
    return data;
  }catch(e){
    statusBox.textContent = "데이터 불러오기 실패. 다시 로그인 필요할 수 있습니다.";
    return null;
  }
}

async function selectDate(d){
  selected = d;
  selectedBox.textContent = selected.toISOString().slice(0,10);
  const dbData = await loadDayData(selected);
  startInput.value = dbData?.start||"";
  endInput.value = dbData?.end||"";
  memoInput.value = dbData?.memo||"";
  if(dbData?.break){
    breakCheck.checked = true;
    breakWrap.style.display = "block";
    breakInput.value = dbData.break;
  } else {
    breakCheck.checked = false;
    breakWrap.style.display = "none";
    breakInput.value = "";
  }
  renderSelected();
}

function renderSelected(){
  const iso = selected.toISOString().slice(0,10);
  const box = document.getElementById("selectedEntry");
  const db = cacheData[iso];
  if(!db){
    box.innerHTML = "기록 없음";
    return;
  }
  box.innerHTML = `<div class="entry-card">
      <div class="entry-time">${db.time}</div>
      <div class="entry-memo">${db.memo||""}</div>
  </div>`;
}

async function renderCalendar(){
  calendar.innerHTML="";
  const y=current.getFullYear();
  const m=current.getMonth();
  monthTitle.textContent=`${y}년 ${m+1}월`;

  const first=new Date(y,m,1).getDay();
  const last=new Date(y,m+1,0).getDate();

  for(let i=0;i<first;i++) calendar.appendChild(document.createElement("div"));

  const loadingDiv = document.createElement("div");
  loadingDiv.textContent = "불러오는 중...";
  calendar.appendChild(loadingDiv);

  for(let d=1; d<=last; d++){
    const iso=`${y}-${pad(m+1)}-${pad(d)}`;
    const box=document.createElement("div");
    box.className="day";
    box.innerHTML=`<span>${d}</span>`;

    const dbData = await loadDayData(new Date(iso), true);
    if(dbData) box.innerHTML+=`<div class="preview">${dbData.time}</div>`;
    if(iso===selected.toISOString().slice(0,10)) box.classList.add("selected");
    box.onclick = ()=>selectDate(new Date(iso));
    calendar.appendChild(box);
  }
}

function calcWeekTotal(){
  const start = new Date(selected);
  const day = start.getDay();
  start.setDate(start.getDate() - day); // 주 시작일
  let sum=0;
  const promises = [];
  for(let i=0;i<7;i++){
    const d = new Date(start);
    d.setDate(start.getDate()+i);
    const iso = d.toISOString().slice(0,10);
    if(cacheData[iso]?.sec) sum += cacheData[iso].sec;
    else promises.push(loadDayData(d).then(db=>{ if(db?.sec) sum+=db.sec; }));
  }
  Promise.all(promises).then(()=>{ weekTotal.textContent = format(sum); });
}

// 초기 DOMContentLoaded
document.addEventListener("DOMContentLoaded", () => {
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

  breakCheck.onclick = ()=> {
    breakWrap.style.display = breakCheck.checked?"block":"none";
    if(!breakCheck.checked) breakInput.value="";
  };

  saveBtn.onclick = async ()=>{
    statusBox.textContent="저장중...";
    const iso = selected.toISOString().slice(0,10);
    const s = parse(startInput.value);
    const e = parse(endInput.value);
    const b = parse(breakInput.value);
    if(e < s){ alert("퇴근이 출근보다 빠를 수 없습니다."); statusBox.textContent=""; return; }
    const total = e-s-b;
    await setDoc(doc(db,"worklog",iso),{
      start:startInput.value,
      end:endInput.value,
      break: breakCheck.checked?breakInput.value:"",
      memo: memoInput.value.trim(),
      time: format(total),
      sec: total
    });
    await loadDayData(selected,true);
    statusBox.textContent="저장 완료!";
    renderCalendar();
    renderSelected();
    calcWeekTotal();
    setTimeout(()=>{statusBox.textContent="";},1000);
  };

  // 삭제 버튼
  delBtn.onclick = async ()=>{
    const iso = selected.toISOString().slice(0,10);
    await deleteDoc(doc(db,"worklog",iso));
    delete cacheData[iso];
    statusBox.textContent="삭제 완료!";
    renderCalendar();
    renderSelected();
    calcWeekTotal();
    setTimeout(()=>{statusBox.textContent="";},1000);
  };

  document.getElementById("prevMonth").onclick = async ()=>{
    current.setMonth(current.getMonth()-1);
    await renderCalendar();
    calcWeekTotal();
  };
  document.getElementById("nextMonth").onclick = async ()=>{
    current.setMonth(current.getMonth()+1);
    await renderCalendar();
    calcWeekTotal();
  };

  selectDate(new Date());
  calcWeekTotal();
});
