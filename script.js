import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, deleteDoc, collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

// 🔥 Firebase 설정 (자신의 Firebase 웹 앱 config로 바꾸세요)
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

// Firestore에서 특정 날짜 데이터 불러오기
async function loadDate(iso){
  const docRef = doc(db, "worklog", iso);
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? docSnap.data() : null;
}

// Firestore에서 이번 달 데이터 모두 불러오기
async function loadMonth(){
  const y = current.getFullYear();
  const m = pad(current.getMonth()+1);
  const colRef = collection(db, "worklog");
  const q = query(colRef); // 전체 불러오기
  const snapshot = await getDocs(q);
  const data = {};
  snapshot.forEach(doc => {
    if(doc.id.startsWith(`${y}-${m}`)) data[doc.id] = doc.data();
  });
  return data;
}

// 선택 날짜 업데이트
async function selectDate(d){
  selected = d;
  const iso = d.toISOString().slice(0,10);
  selectedBox.textContent = iso;

  const dbData = await loadDate(iso);

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

  renderCalendar();
  renderSelected();
  calcMonthTotal();
}

// 선택 날짜 렌더링
async function renderSelected(){
  const iso = selected.toISOString().slice(0,10);
  const dbData = await loadDate(iso);

  const box = document.getElementById("selectedEntry");
  box.innerHTML = "";

  if(!dbData){
    box.innerHTML=`<div class="entry-card record-none">기록 없음</div>`;
    return;
  }

  box.innerHTML = `
    <div class="entry-card">
      <div class="entry-time">${iso} (${dbData.time})</div>
      <div class="entry-memo">${dbData.memo||""}</div>
    </div>
  `;
}

// 달력 렌더링
async function renderCalendar(){
  calendar.innerHTML="";
  const y = current.getFullYear();
  const m = current.getMonth();
  monthTitle.textContent = `${y}년 ${m+1}월`;

  const firstDay = new Date(y,m,1).getDay();
  const lastDate = new Date(y,m+1,0).getDate();

  const dbData = await loadMonth();

  for(let i=0;i<firstDay;i++) calendar.appendChild(document.createElement("div"));

  for(let d=1;d<=lastDate;d++){
    const iso = `${y}-${pad(m+1)}-${pad(d)}`;
    const box = document.createElement("div");
    box.className="day";
    box.innerHTML=`<span>${d}</span>`;

    if(d==1 || d==lastDate){} // optional: 스타일 조정
    if(iso===selected.toISOString().slice(0,10)) box.classList.add("selected");
    if(dbData[iso]) box.innerHTML+=`<div class="preview">${dbData[iso].time}</div>`;

    // 요일별 색상
    const dayOfWeek = new Date(y,m,d).getDay();
    if(dayOfWeek===0) box.style.color="red";
    if(dayOfWeek===6) box.style.color="blue";

    box.onclick=()=>selectDate(new Date(iso));
    calendar.appendChild(box);
  }
}

// 저장 버튼
saveBtn.onclick = async () => {
  const iso = selected.toISOString().slice(0, 10);
  const s = parse(startInput.value);
  const e = parse(endInput.value);
  const b = parse(breakInput.value);

  if(e < s) return alert("퇴근이 출근보다 빠를 수 없습니다.");
  const total = e - s - b;

  await setDoc(doc(db,"worklog",iso), {
    start: startInput.value,
    end: endInput.value,
    break: breakCheck.checked ? breakInput.value : "",
    memo: memoInput.value.trim(),
    time: format(total),
    sec: total
  });

  alert("저장됨!");
  selectDate(selected);
};

// 삭제 버튼
delBtn.onclick = async () => {
  const iso = selected.toISOString().slice(0, 10);
  await deleteDoc(doc(db,"worklog",iso));
  alert("삭제됨!");
  selectDate(selected);
};

// 이번 달 총 근무시간 계산
async function calcMonthTotal(){
  const dbData = await loadMonth();
  const y = current.getFullYear();
  const m = pad(current.getMonth()+1);
  let sum=0;
  Object.values(dbData).forEach(v=>sum+=v.sec||0);
  monthTotal.textContent = format(sum);
}

// 월 이동
document.getElementById("prevMonth").onclick = ()=>{current.setMonth(current.getMonth()-1); renderCalendar(); calcMonthTotal();};
document.getElementById("nextMonth").onclick = ()=>{current.setMonth(current.getMonth()+1); renderCalendar(); calcMonthTotal();};

// 초기 렌더링
selectDate(new Date());
