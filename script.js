import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, deleteDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signOut, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

// Firebase 초기화
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
const messageBox = document.getElementById("messageBox");

let current = new Date();
let selected = new Date();
let cacheData = {}; // 날짜별 캐시
let user = null;

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
  t = t.replace(/[^0-9:]/g,"").trim();
  if(t.includes(":")){
    const [h,m,s]=t.split(":").map(Number);
    return h*3600+m*60+(s||0);
  }
  t = t.padStart(6,"0");
  return Number(t.slice(0,2))*3600 + Number(t.slice(2,4))*60 + Number(t.slice(4,6));
}

// Firestore 데이터 불러오기 (캐시 저장)
async function loadDayData(date){
  const iso = date.toISOString().slice(0,10);
  if(cacheData[iso]) return cacheData[iso];
  try {
    const docRef = doc(db, "worklog", iso);
    const snap = await getDoc(docRef);
    const data = snap.exists() ? snap.data() : null;
    cacheData[iso] = data;
    return data;
  } catch(err){
    console.error("Firestore 접근 실패:", err);
    messageBox.innerHTML = "데이터 불러오기 실패! <button id='relogin'>다시 로그인</button>";
    document.getElementById("relogin").onclick = ()=>location.reload();
    return null;
  }
}

// 선택 날짜 UI
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

  renderSelectedEntry(dbData);
  renderCalendar(); // 시각은 캘린더 칸에 표시
  calcWeekTotal();
}

// 선택한 날짜의 근무시간 표시
function renderSelectedEntry(dbData){
  const box = document.getElementById("selectedEntry");
  if(!dbData){
    box.innerHTML = `<div class="entry-card record-none">기록 없음</div>`;
    return;
  }
  box.innerHTML = `
    <div class="entry-card">
      <div class="entry-time">${dbData.time}</div>
      <div class="entry-memo">${dbData.memo||""}</div>
    </div>
  `;
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
    const dbData = cacheData[iso];
    if(dbData) box.innerHTML+=`<div class="preview">${dbData.time}</div>`;
    if(iso===selected.toISOString().slice(0,10)) box.classList.add("selected");
    box.onclick = ()=>selectDate(new Date(iso));
    calendar.appendChild(box);
  }
}

// 저장
saveBtn.onclick = async ()=>{
  if(!user) return alert("로그인 필요");
  const iso = selected.toISOString().slice(0,10);
  const s = parseTime(startInput.value);
  const e = parseTime(endInput.value);
  const b = parseTime(breakInput.value);
  if(e < s) return alert("퇴근이 출근보다 빠를 수 없습니다.");
  const total = e-s-b;

  messageBox.textContent = "저장중입니다...";
  try {
    await setDoc(doc(db,"worklog",iso),{
      start: startInput.value,
      end: endInput.value,
      break: breakCheck.checked ? breakInput.value : "",
      memo: memoInput.value.trim(),
      time: format(total),
      sec: total
    });
    cacheData[iso] = {
      start: startInput.value,
      end: endInput.value,
      break: breakCheck.checked ? breakInput.value : "",
      memo: memoInput.value.trim(),
      time: format(total),
      sec: total
    };
    messageBox.textContent = "저장되었습니다!";
    renderCalendar();
    renderSelectedEntry(cacheData[iso]);
    calcWeekTotal();
  } catch(err){
    console.error(err);
    messageBox.textContent = "저장 실패!";
  }
};

// 삭제
delBtn.onclick = async ()=>{
  if(!user) return alert("로그인 필요");
  const iso = selected.toISOString().slice(0,10);
  messageBox.textContent = "삭제중입니다...";
  try {
    await deleteDoc(doc(db,"worklog",iso));
    cacheData[iso] = null;
    startInput.value = endInput.value = memoInput.value = breakInput.value = "";
    breakCheck.checked = false;
    breakWrap.style.display = "none";
    messageBox.textContent = "삭제되었습니다!";
    renderCalendar();
    renderSelectedEntry(null);
    calcWeekTotal();
  } catch(err){
    console.error(err);
    messageBox.textContent = "삭제 실패!";
  }
};

// 이번주 총 근무시간 계산
function calcWeekTotal(){
  const y = selected.getFullYear();
  const m = selected.getMonth();
  const day = selected.getDay();
  const start = new Date(selected);
  start.setDate(selected.getDate() - day); // 주 시작: 일요일
  const end = new Date(selected);
  end.setDate(start.getDate()+6);

  let sum=0;
  for(let d = new Date(start); d <= end; d.setDate(d.getDate()+1)){
    const iso = d.toISOString().slice(0,10);
    if(cacheData[iso]?.sec) sum += cacheData[iso].sec;
  }
  weekTotal.textContent = format(sum);
}

// 외출 체크
breakCheck.onclick = ()=>{
  breakWrap.style.display = breakCheck.checked ? "block":"none";
  if(!breakCheck.checked) breakInput.value="";
};

// 월 이동
document.getElementById("prevMonth").onclick = ()=>{
  current.setMonth(current.getMonth()-1);
  renderCalendar();
};
document.getElementById("nextMonth").onclick = ()=>{
  current.setMonth(current.getMonth()+1);
  renderCalendar();
};

// 로그인 상태 확인
onAuthStateChanged(auth, (u)=>{
  if(u){
    user = u;
    messageBox.textContent = "";
    selectDate(selected);
  } else {
    user = null;
    messageBox.innerHTML = "로그인 필요! <button id='loginBtn'>로그인</button>";
    document.getElementById("loginBtn").onclick = async ()=>{
      try{
        const provider = new GoogleAuthProvider();
        await signInWithPopup(auth, provider);
      } catch(err){
        console.error(err);
        messageBox.textContent = "로그인 실패!";
      }
    };
  }
});

// 초기 로드
selectDate(selected);
