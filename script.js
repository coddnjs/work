import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, deleteDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

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
const delBtn = document.getElementById("delete");
const weekTotal = document.getElementById("weekTotal");
const statusBox = document.getElementById("statusBox"); // 캘린더 위 상태 표시 영역
const loginBtn = document.getElementById("loginBtn"); // 재로그인 버튼

let current = new Date();
let selected = new Date();
let dayDataCache = {}; // { 'YYYY-MM-DD': {start,end,break,memo,time,sec} }

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

// Firestore 데이터 로드 (캐시 사용)
async function loadDayData(date){
  const iso = date.toISOString().slice(0,10);
  if(dayDataCache[iso]) return dayDataCache[iso];

  try{
    const snap = await getDoc(doc(db,"worklog",iso));
    const data = snap.exists() ? snap.data() : null;
    dayDataCache[iso] = data;
    return data;
  }catch(e){
    console.error("Firestore 접근 실패:", e);
    statusBox.textContent = "데이터 불러오기 실패!";
    loginBtn.style.display = "inline-block";
    return null;
  }
}

// 선택 날짜 표시
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
  }else{
    breakCheck.checked = false;
    breakWrap.style.display = "none";
    breakInput.value = "";
  }

  renderSelected();
  calcWeekTotal();
}

// 선택 날짜 카드
function renderSelected(){
  const iso = selected.toISOString().slice(0,10);
  const box = document.getElementById("selectedEntry");
  const db = dayDataCache[iso];
  if(!db){
    box.innerHTML = `<div class="entry-card record-none">기록 없음</div>`;
    return;
  }
  box.innerHTML = `
    <div class="entry-card">
      <div class="entry-time">${db.time || "00:00:00"}</div>
      <div class="entry-memo">${db.memo||""}</div>
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

    const dbData = dayDataCache[iso];
    if(dbData && dbData.time) box.innerHTML+=`<div class="preview">${dbData.time}</div>`;
    if(iso===selected.toISOString().slice(0,10)) box.classList.add("selected");
    box.onclick = ()=> selectDate(new Date(iso));
    calendar.appendChild(box);
  }
}

// 주간 총 근무시간 계산
function calcWeekTotal(){
  const y = selected.getFullYear();
  const m = selected.getMonth();
  const d = selected.getDate();
  const dayOfWeek = selected.getDay(); // 0~6
  const startDate = new Date(y,m,d-dayOfWeek); // 이번주 일요일
  const endDate = new Date(y,m,d+(6-dayOfWeek)); // 이번주 토요일
  let sum = 0;

  for(let i=0;i<7;i++){
    const curr = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()+i);
    const iso = curr.toISOString().slice(0,10);
    const data = dayDataCache[iso];
    if(data?.sec) sum += data.sec;
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

  statusBox.textContent = "저장중입니다...";
  try{
    await setDoc(doc(db,"worklog",iso),{
      start: startInput.value,
      end: endInput.value,
      break: breakCheck.checked ? breakInput.value : "",
      memo: memoInput.value.trim(),
      time: format(total),
      sec: total
    });
    dayDataCache[iso] = {
      start: startInput.value,
      end: endInput.value,
      break: breakCheck.checked ? breakInput.value : "",
      memo: memoInput.value.trim(),
      time: format(total),
      sec: total
    };
    statusBox.textContent = "저장 완료!";
    renderSelected();
    renderCalendar();
    calcWeekTotal();
  }catch(e){
    console.error("저장 실패:", e);
    statusBox.textContent = "저장 실패!";
  }
  setTimeout(()=>{ statusBox.textContent = ""; },2000);
};

delBtn.onclick = async ()=>{
  const iso = selected.toISOString().slice(0,10);
  if(!confirm("정말 삭제하시겠습니까?")) return;
  statusBox.textContent = "삭제중입니다...";
  try{
    await deleteDoc(doc(db,"worklog",iso));
    delete dayDataCache[iso];
    startInput.value=endInput.value=breakInput.value=memoInput.value="";
    breakCheck.checked=false; breakWrap.style.display="none";
    statusBox.textContent = "삭제 완료!";
    renderSelected();
    renderCalendar();
    calcWeekTotal();
  }catch(e){
    console.error("삭제 실패:", e);
    statusBox.textContent = "삭제 실패!";
  }
  setTimeout(()=>{ statusBox.textContent = ""; },2000);
};

// 로그인/재로그인
loginBtn.onclick = async ()=>{
  try{
    await signInWithPopup(auth, provider);
    statusBox.textContent = "";
    loginBtn.style.display = "none";
    await fetchAllData();
    renderCalendar();
    selectDate(selected);
  }catch(e){
    console.error("로그인 실패:", e);
    statusBox.textContent = "로그인 실패!";
  }
};

// 모든 데이터 미리 로드
async function fetchAllData(){
  dayDataCache = {};
  try{
    const snapshot = await getDocs(collection(db,"worklog"));
    snapshot.forEach(doc=>{
      dayDataCache[doc.id] = doc.data();
    });
  }catch(e){
    console.error("전체 데이터 로드 실패:", e);
    statusBox.textContent = "데이터 로드 실패!";
    loginBtn.style.display = "inline-block";
  }
}

// 초기화
auth.onAuthStateChanged(async (user)=>{
  if(user){
    statusBox.textContent = "로그인 완료!";
    loginBtn.style.display = "none";
    await fetchAllData();
    renderCalendar();
    selectDate(selected);
  }else{
    statusBox.textContent = "로그인이 필요합니다.";
    loginBtn.style.display = "inline-block";
  }
});

document.getElementById("prevMonth").onclick=()=>{
  current.setMonth(current.getMonth()-1);
  renderCalendar();
};
document.getElementById("nextMonth").onclick=()=>{
  current.setMonth(current.getMonth()+1);
  renderCalendar();
};

// 페이지 초기
selectDate(new Date());
