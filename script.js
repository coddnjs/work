import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, deleteDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

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
const msgBox = document.getElementById("messageBox"); // 캘린더 위 메시지용

let current = new Date();
let selected = new Date();
let monthDataCache = {}; // 이번 달 데이터 캐싱

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
async function loadMonthData(year,month){
  monthDataCache = {};
  try{
    const snapshot = await getDocs(collection(db,"worklog"));
    snapshot.forEach(doc=>{
      if(doc.id.startsWith(`${year}-${pad(month)}`)){
        monthDataCache[doc.id] = doc.data();
      }
    });
    msgBox.textContent = "";
  } catch(e){
    console.error("데이터 불러오기 실패:", e);
    msgBox.innerHTML = `데이터 불러오기 실패! <button id="reloginBtn">다시 로그인</button>`;
    document.getElementById("reloginBtn").onclick = ()=>location.reload();
  }
}

// 날짜 선택
function selectDate(d){
  selected = d;
  selectedBox.textContent = selected.toISOString().slice(0,10);

  const iso = selected.toISOString().slice(0,10);
  const data = monthDataCache[iso];

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

  renderCalendar();
  renderSelected();
  calcWeekTotal();
}

// 선택된 날짜 데이터 표시
function renderSelected(){
  const iso = selected.toISOString().slice(0,10);
  const box = document.getElementById("selectedEntry");
  const data = monthDataCache[iso];
  if(!data){
    box.innerHTML = `<div class="entry-card record-none">기록 없음</div>`;
    return;
  }
  box.innerHTML = `
    <div class="entry-card">
      <div class="entry-time">${data.time}</div>
      <div class="entry-memo">${data.memo||""}</div>
    </div>
  `;
}

// 달력 렌더링
function renderCalendar(){
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
    const data = monthDataCache[iso];
    if(data) box.innerHTML+=`<div class="preview">${data.time}</div>`;
    if(iso===selected.toISOString().slice(0,10)) box.classList.add("selected");
    box.onclick = ()=>selectDate(new Date(iso));
    calendar.appendChild(box);
  }
}

// Break toggle
breakCheck.onclick = ()=> {
  breakWrap.style.display = breakCheck.checked ? "block":"none";
  if(!breakCheck.checked) breakInput.value="";
};

// 이번주 총 근무시간
function calcWeekTotal(){
  const day = selected.getDay();
  const monday = new Date(selected);
  monday.setDate(selected.getDate() - (day===0?6:day-1));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate()+6);

  let sum=0;
  for(let d=new Date(monday); d<=sunday; d.setDate(d.getDate()+1)){
    const iso = d.toISOString().slice(0,10);
    const data = monthDataCache[iso];
    if(data && data.sec) sum += data.sec;
  }
  weekTotal.textContent=format(sum);
}

// 저장
saveBtn.onclick = async ()=>{
  const iso = selected.toISOString().slice(0,10);
  const s = parse(startInput.value);
  const e = parse(endInput.value);
  const b = parse(breakInput.value);
  if(e < s) return alert("퇴근이 출근보다 빠를 수 없습니다.");
  const total = e-s-b;
  msgBox.textContent="저장중입니다...";

  try{
    await setDoc(doc(db,"worklog",iso),{
      start: startInput.value,
      end: endInput.value,
      break: breakCheck.checked ? breakInput.value : "",
      memo: memoInput.value.trim(),
      time: format(total),
      sec: total
    });
    monthDataCache[iso] = {start:startInput.value,end:endInput.value,break:breakCheck.checked?breakInput.value:"",memo:memoInput.value,time:format(total),sec:total};
    msgBox.textContent="저장 완료!";
    
    await loadMonthData(current.getFullYear(),current.getMonth()+1);
    renderCalendar();
    renderSelected();
    calcWeekTotal();
  } catch(e){
    console.error(e);
    msgBox.textContent="저장 실패!";
  }
  setTimeout(()=>msgBox.textContent="",2000);
};

// 삭제
delBtn.onclick = async ()=>{
  const iso = selected.toISOString().slice(0,10);
  if(!confirm("삭제하시겠습니까?")) return;
  msgBox.textContent="삭제중입니다...";
  try{
    await deleteDoc(doc(db,"worklog",iso));
    delete monthDataCache[iso];
    msgBox.textContent="삭제 완료!";
    
    await loadMonthData(current.getFullYear(),current.getMonth()+1);
    renderCalendar();
    renderSelected();
    calcWeekTotal();

    startInput.value=endInput.value=memoInput.value=breakInput.value="";
    breakCheck.checked=false;
    breakWrap.style.display="none";
  } catch(e){
    console.error(e);
    msgBox.textContent="삭제 실패!";
  }
  setTimeout(()=>msgBox.textContent="",2000);
};

// 이전/다음 달
document.getElementById("prevMonth").onclick=()=>{
  current.setMonth(current.getMonth()-1);
  renderCalendar();
};
document.getElementById("nextMonth").onclick=()=>{
  current.setMonth(current.getMonth()+1);
  renderCalendar();
};

// 초기 로드
onAuthStateChanged(auth, user=>{
  if(user){
    msgBox.textContent="";
    loadMonthData(current.getFullYear(),current.getMonth()+1).then(()=>{
      renderCalendar();
      selectDate(selected);
    });
  } else {
    location.href="login.html";
  }
});
