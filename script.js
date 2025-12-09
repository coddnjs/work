import { db, doc, setDoc, getDoc, deleteDoc } from './index.html';

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
function parseTime(t){
  if(!t) return 0;
  t = t.replace(/[^0-9:]/g,"").trim();
  if(t.includes(":")){
    const [h,m,s]=t.split(":").map(Number);
    return h*3600 + m*60 + (s||0);
  }
  t=t.padStart(6,"0");
  return Number(t.slice(0,2))*3600 + Number(t.slice(2,4))*60 + Number(t.slice(4,6));
}

// Firestore에서 불러오기
async function loadDB(){
  const docRef = doc(db, "worklog", "all");
  const snapshot = await getDoc(docRef);
  return snapshot.exists() ? snapshot.data() : {};
}

// Firestore에 저장
async function saveDB(date, data){
  const docRef = doc(db, "worklog", date);
  await setDoc(docRef, data);
}

// 선택 날짜 처리
async function selectDate(d){
  selected = d;
  const iso = d.toISOString().slice(0,10);
  selectedBox.textContent = iso;

  const dbData = await loadDB();
  const dayData = dbData[iso] || {};

  startInput.value = dayData.start || "";
  endInput.value = dayData.end || "";
  memoInput.value = dayData.memo || "";
  if(dayData.break){
    breakCheck.checked = true;
    breakWrap.style.display="block";
    breakInput.value = dayData.break;
  } else {
    breakCheck.checked = false;
    breakWrap.style.display="none";
    breakInput.value="";
  }

  renderCalendar();
  renderSelected(dayData);
}

function renderSelected(data){
  const iso = selected.toISOString().slice(0,10);
  const box = document.getElementById("selectedEntry");
  box.innerHTML = data ? `
    <div class="entry-card">
      <div class="entry-time">${iso} (${data.time})</div>
      <div class="entry-memo">${data.memo||""}</div>
    </div>` : `<div class="entry-card record-none">기록 없음</div>`;
}

// 달력 렌더링
async function renderCalendar(){
  calendar.innerHTML="";
  const y=current.getFullYear();
  const m=current.getMonth();
  monthTitle.textContent=`${y}년 ${m+1}월`;
  const first=new Date(y,m,1).getDay();
  const last=new Date(y,m+1,0).getDate();

  const dbData = await loadDB();

  for(let i=0;i<first;i++) calendar.appendChild(document.createElement("div"));

  for(let d=1; d<=last; d++){
    const iso = `${y}-${pad(m+1)}-${pad(d)}`;
    const box = document.createElement("div");
    box.className="day";
    box.innerHTML = `<span>${d}</span>`;
    if(iso === selected.toISOString().slice(0,10)) box.classList.add("selected");
    if(dbData[iso]) box.innerHTML += `<div class="preview">${dbData[iso].time}</div>`;

    const weekday = (first + d - 1) % 7;
    if(weekday === 0) box.querySelector("span").style.color = "#d64545";
    if(weekday === 6) box.querySelector("span").style.color = "#3b66d6";

    box.onclick = ()=> selectDate(new Date(iso));
    calendar.appendChild(box);
  }
}

saveBtn.onclick = async ()=>{
  const iso = selected.toISOString().slice(0,10);
  const s = parseTime(startInput.value);
  const e = parseTime(endInput.value);
  const b = parseTime(breakInput.value);
  if(e < s) return alert("퇴근이 출근보다 빠를 수 없습니다.");
  const total = e - s - b;

  await saveDB(iso, {
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
};

document.getElementById("prevMonth").onclick = ()=>{
  current.setMonth(current.getMonth()-1);
  renderCalendar();
};
document.getElementById("nextMonth").onclick = ()=>{
  current.setMonth(current.getMonth()+1);
  renderCalendar();
};

// 초기화
renderCalendar();
selectDate(new Date());
