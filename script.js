import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, deleteDoc, collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

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
const statusMsg = document.getElementById("statusMsg");

let current = new Date();
let selected = new Date();
let dayDataCache = {};

function pad(n){ return String(n).padStart(2,"0"); }
function format(sec){
  const h=Math.floor(sec/3600);
  const m=Math.floor((sec%3600)/60);
  const s=sec%60;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}
function parseTime(t){
  if(!t) return 0;
  t=t.replace(/[^0-9:]/g,"").trim();
  if(t.includes(":")){
    const [h,m,s]=t.split(":").map(Number);
    return h*3600+m*60+(s||0);
  }
  t=t.padStart(6,"0");
  return Number(t.slice(0,2))*3600 + Number(t.slice(2,4))*60 + Number(t.slice(4,6));
}

async function loadDayData(date){
  const iso = date.toISOString().slice(0,10);
  if(dayDataCache[iso]) return dayDataCache[iso];
  try {
    const snap = await getDoc(doc(db,"worklog",iso));
    const data = snap.exists()? snap.data(): null;
    dayDataCache[iso] = data;
    return data;
  } catch(e) {
    statusMsg.textContent = "데이터 불러오기 실패. 다시 로그인 필요할 수 있습니다.";
    const loginBtn = document.createElement("button");
    loginBtn.textContent = "다시 로그인";
    loginBtn.onclick = ()=>signOut(auth).then(()=>location.href="login.html");
    statusMsg.appendChild(loginBtn);
    return null;
  }
}

function renderCalendar(){
  calendar.innerHTML="";
  const y=current.getFullYear();
  const m=current.getMonth();
  for(let i=0;i<new Date(y,m,1).getDay();i++) calendar.appendChild(document.createElement("div"));
  const last=new Date(y,m+1,0).getDate();
  for(let d=1;d<=last;d++){
    const iso=`${y}-${pad(m+1)}-${pad(d)}`;
    const box=document.createElement("div");
    box.className="day";
    const dbData = dayDataCache[iso];
    const timeStr = dbData?.time? dbData.time : "";
    box.innerHTML=`<span>${d}</span><div class="preview">${timeStr}</div>`;
    if(iso===selected.toISOString().slice(0,10)) box.classList.add("selected");
    box.onclick = ()=>selectDate(new Date(iso));
    calendar.appendChild(box);
  }
}

async function selectDate(d){
  selected = d;
  selectedBox.textContent = selected.toISOString().slice(0,10);
  const data = await loadDayData(selected);
  startInput.value = data?.start || "";
  endInput.value = data?.end || "";
  memoInput.value = data?.memo || "";
  if(data?.break){
    breakCheck.checked=true; breakWrap.style.display="block"; breakInput.value=data.break;
  } else {
    breakCheck.checked=false; breakWrap.style.display="none"; breakInput.value="";
  }
  renderCalendar();
  calcWeekTotal();
}

breakCheck.onclick = ()=> {
  breakWrap.style.display = breakCheck.checked? "block":"none";
  if(!breakCheck.checked) breakInput.value="";
};

saveBtn.onclick = async ()=>{
  const iso = selected.toISOString().slice(0,10);
  const s = parseTime(startInput.value);
  const e = parseTime(endInput.value);
  const b = parseTime(breakInput.value);
  if(e<s) return alert("퇴근이 출근보다 빠를 수 없습니다.");
  const total = e-s-b;
  statusMsg.textContent = "저장중입니다...";
  await setDoc(doc(db,"worklog",iso),{
    start: startInput.value,
    end: endInput.value,
    break: breakCheck.checked? breakInput.value:"",
    memo: memoInput.value.trim(),
    time: format(total),
    sec: total
  });
  dayDataCache[iso] = {
    start:startInput.value,
    end:endInput.value,
    break: breakCheck.checked? breakInput.value:"",
    memo:memoInput.value.trim(),
    time:format(total),
    sec:total
  };
  statusMsg.textContent = "저장 완료!";
  renderCalendar();
  calcWeekTotal();
};

delBtn.onclick = async ()=>{
  const iso = selected.toISOString().slice(0,10);
  if(confirm("삭제하시겠습니까?")){
    await deleteDoc(doc(db,"worklog",iso));
    delete dayDataCache[iso];
    startInput.value=""; endInput.value=""; breakInput.value=""; memoInput.value="";
    statusMsg.textContent="삭제 완료!";
    renderCalendar();
    calcWeekTotal();
  }
};

function calcWeekTotal(){
  const startOfWeek = new Date(selected);
  startOfWeek.setDate(selected.getDate() - selected.getDay());
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate()+6);
  let sum = 0;
  for(const key in dayDataCache){
    const d = new Date(key);
    if(d>=startOfWeek && d<=endOfWeek){
      sum += dayDataCache[key]?.sec||0;
    }
  }
  weekTotal.textContent = format(sum);
}

document.getElementById("prevMonth").onclick = ()=> { current.setMonth(current.getMonth()-1); renderCalendar(); };
document.getElementById("nextMonth").onclick = ()=> { current.setMonth(current.getMonth()+1); renderCalendar(); };

onAuthStateChanged(auth,user=>{
  if(!user) location.href="login.html";
  selectDate(new Date());
});
