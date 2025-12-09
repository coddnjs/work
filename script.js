// ========================
// Firebase 초기화
// ========================
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCoMSY3XNJJ9jmemad545ugFVrfAM0T07M",
  authDomain: "work-3aad3.firebaseapp.com",
  projectId: "work-3aad3",
  storageBucket: "work-3aad3.appspot.com",
  messagingSenderId: "225615907016",
  appId: "1:225615907016:web:b9ccbe8331df644aa73dfd"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ========================
// DOM 요소
// ========================
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

// ========================
// 날짜 변수
// ========================
let current = new Date();
let selected = new Date();

// ========================
// 유틸 함수
// ========================
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

// ========================
// 외출 체크
// ========================
breakCheck.onclick = () => {
  breakWrap.style.display = breakCheck.checked ? "block" : "none";
  if (!breakCheck.checked) breakInput.value = "";
};

// ========================
// 데이터 로드/저장 (Firestore)
// ========================
async function loadDB() {
  const iso = selected.toISOString().slice(0,10);
  try {
    const docSnap = await getDoc(doc(db, "worklog", iso));
    return docSnap.exists() ? docSnap.data() : null;
  } catch (err) {
    console.error(err);
    return null;
  }
}

async function saveDB(iso, data){
  await setDoc(doc(db, "worklog", iso), data);
}

// ========================
// 선택 날짜 관련
// ========================
async function selectDate(d){
  selected=d;
  const iso=d.toISOString().slice(0,10);
  selectedBox.textContent=iso;

  const dbEntry = await loadDB();

  startInput.value = dbEntry?.start || "";
  endInput.value = dbEntry?.end || "";
  memoInput.value = dbEntry?.memo || "";

  if(dbEntry?.break){
    breakCheck.checked=true;
    breakWrap.style.display="block";
    breakInput.value=dbEntry?.break;
  } else {
    breakCheck.checked=false;
    breakWrap.style.display="none";
    breakInput.value="";
  }

  renderCalendar();
  renderSelected(dbEntry);
}

// ========================
// 선택 날짜 하단 내용 렌더
// ========================
function renderSelected(dbEntry=null){
  const iso=selected.toISOString().slice(0,10);
  const box=document.getElementById("selectedEntry");
  box.innerHTML="";

  if(!dbEntry){
    box.innerHTML=`<div class="entry-card record-none">기록 없음</div>`;
    return;
  }

  box.innerHTML = `
    <div class="entry-card">
      <div class="entry-time">${iso} (${dbEntry.time})</div>
      <div class="entry-memo">${dbEntry.memo||""}</div>
    </div>
  `;
}

// ========================
// 달력 렌더링
// ========================
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

    if(iso===selected.toISOString().slice(0,10)) box.classList.add("selected");

    const dbEntry = await getDoc(doc(db, "worklog", iso));
    if(dbEntry.exists()) box.innerHTML+=`<div class="preview">${dbEntry.data().time}</div>`;

    box.onclick = () => selectDate(new Date(iso));
    calendar.appendChild(box);
  }
}

// ========================
// 이번달 총 합계
// ========================
async function calcMonthTotal(){
  const y=current.getFullYear();
  const m=current.getMonth()+1;
  let sum=0;

  for(let d=1; d<=31; d++){
    const iso = `${y}-${pad(m)}-${pad(d)}`;
    try{
      const docSnap = await getDoc(doc(db,"worklog",iso));
      if(docSnap.exists()) sum += docSnap.data().sec;
    } catch(e){ }
  }

  monthTotal.textContent = format(sum);
}

// ========================
// 저장 버튼
// ========================
saveBtn.onclick = async () => {
  saveBtn.classList.add("active");
  setTimeout(() => saveBtn.classList.remove("active"), 150);

  const iso = selected.toISOString().slice(0, 10);
  const s = parse(startInput.value);
  const e = parse(endInput.value);
  const b = parse(breakInput.value);

  if(e < s) return alert("퇴근이 출근보다 빠를 수 없습니다.");
  const total = e - s - b;

  try{
    await saveDB(iso, {
      start: startInput.value,
      end: endInput.value,
      break: breakCheck.checked ? breakInput.value : "",
      memo: memoInput.value.trim(),
      time: format(total),
      sec: total
    });

    // 화면 상단 알림
    const alertBox = document.createElement("div");
    alertBox.className = "save-alert";
    alertBox.textContent = "저장되었습니다!";
    document.body.appendChild(alertBox);
    setTimeout(() => alertBox.remove(), 2000);

    // 하단 내용 갱신
    const dbEntry = await loadDB();
    renderSelected(dbEntry);
    renderCalendar();
    calcMonthTotal();

  } catch(err){
    console.error(err);
    alert("저장 중 오류 발생");
  }
};

// ========================
// 삭제 버튼
// ========================
delBtn.onclick = async () => {
  const iso = selected.toISOString().slice(0,10);
  try{
    await deleteDoc(doc(db,"worklog",iso));
    startInput.value = endInput.value = memoInput.value = breakInput.value = "";
    breakCheck.checked=false;
    breakWrap.style.display="none";

    renderSelected();
    renderCalendar();
    calcMonthTotal();
  } catch(err){
    console.error(err);
    alert("삭제 중 오류 발생");
  }
};

// ========================
// 이전/다음 달
// ========================
document.getElementById("prevMonth").onclick = () => { current.setMonth(current.getMonth()-1); renderCalendar(); calcMonthTotal(); };
document.getElementById("nextMonth").onclick = () => { current.setMonth(current.getMonth()+1); renderCalendar(); calcMonthTotal(); };

// ========================
// 초기 실행
// ========================
selectDate(new Date());
calcMonthTotal();
renderCalendar();
