import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, deleteDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";
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
const calendarError = document.getElementById("calendarError");
const reLoginBtn = document.getElementById("reLoginBtn");

let current = new Date();
let selected = new Date();
let monthDataCache = {}; // 날짜별 데이터 캐싱

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

// 데이터 로드
async function loadDayData(date){
  const iso = date.toISOString().slice(0,10);
  try{
    const docRef = doc(db,"worklog",iso);
    const snap = await getDoc(docRef);
    if(snap.exists()){
      monthDataCache[iso] = snap.data();
      calendarError.style.display = "none";
      reLoginBtn.style.display = "none";
      return snap.data();
    } else {
      monthDataCache[iso] = null;
      return null;
    }
  }catch(e){
    console.error("Firestore 접근 실패:", e);
    calendarError.style.display = "block";
    calendarError.textContent = "데이터 불러오기 실패!";
    reLoginBtn.style.display = "inline-block";
    return null;
  }
}

// 선택 날짜 표시
async function renderSelected(){
  selectedBox.textContent = selected.toISOString().slice(0,10);
  const data = monthDataCache[selected.toISOString().slice(0,10)];
  startInput.value = data?.start || "";
  endInput.value = data?.end || "";
  memoInput.value = data?.memo || "";
  if(data?.break){
    breakCheck.checked = true;
    breakWrap.style.display = "block";
    breakInput.value = data.break;
  } else {
    breakCheck.checked = false;
    breakWrap.style.display = "none";
    breakInput.value = "";
  }
  calcWeekTotal(selected);
}

// 캘린더 렌더링
function renderCalendar(){
  calendar.innerHTML="";
  const y = current.getFullYear();
  const m = current.getMonth();
  monthTitle.textContent = `${y}년 ${m+1}월`;

  const first = new Date(y,m,1).getDay();
  const last = new Date(y,m+1,0).getDate();

  for(let i=0;i<first;i++) calendar.appendChild(document.createElement("div"));

  for(let d=1; d<=last; d++){
    const iso = `${y}-${pad(m+1)}-${pad(d)}`;
    const box = document.createElement("div");
    box.className = "day";
    box.innerHTML = `<span>${d}</span>`;

    const data = monthDataCache[iso];
    if(data && data.time){
      const preview = document.createElement("div");
      preview.className = "preview";
      preview.textContent = data.time;
      box.appendChild(preview);
    }

    if(iso === selected.toISOString().slice(0,10)) box.classList.add("selected");

    box.onclick = ()=>{
      selected = new Date(iso);
      renderSelected();
      highlightSelectedDay();
    };

    calendar.appendChild(box);
  }
}

// 선택 날짜 하이라이트
function highlightSelectedDay(){
  document.querySelectorAll(".day").forEach(d=>{
    d.classList.remove("selected");
    const span = d.querySelector("span");
    if(span && span.textContent==selected.getDate()) d.classList.add("selected");
  });
}

// 주간 합산
function calcWeekTotal(selDate){
  const dayOfWeek = selDate.getDay();
  const startOfWeek = new Date(selDate);
  startOfWeek.setDate(selDate.getDate() - dayOfWeek);
  const endOfWeek = new Date(selDate);
  endOfWeek.setDate(selDate.getDate() + (6 - dayOfWeek));

  let sum = 0;
  for(let d = new Date(startOfWeek); d <= endOfWeek; d.setDate(d.getDate()+1)){
    const iso = d.toISOString().slice(0,10);
    const data = monthDataCache[iso];
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

  saveBtn.textContent = "저장 중...";
  await setDoc(doc(db,"worklog",iso),{
    start: startInput.value,
    end: endInput.value,
    break: breakCheck.checked ? breakInput.value : "",
    memo: memoInput.value.trim(),
    time: format(total),
    sec: total
  });
  saveBtn.textContent = "저장";

  await loadDayData(selected);
  renderCalendar();
  renderSelected();
};

delBtn.onclick = async ()=>{
  const iso = selected.toISOString().slice(0,10);
  await deleteDoc(doc(db,"worklog",iso));
  monthDataCache[iso] = null;
  renderCalendar();
  renderSelected();
};

// 이전/다음 달
document.getElementById("prevMonth").onclick = ()=>{
  current.setMonth(current.getMonth()-1);
  renderCalendar();
};
document.getElementById("nextMonth").onclick = ()=>{
  current.setMonth(current.getMonth()+1);
  renderCalendar();
};

// 재로그인
reLoginBtn.onclick = ()=>{
  signOut(auth).then(()=> location.reload());
};

// 초기
onAuthStateChanged(auth, user=>{
  if(user){
    renderCalendar();
    renderSelected();
  } else {
    alert("로그인이 필요합니다.");
    location.href = "login.html";
  }
});
