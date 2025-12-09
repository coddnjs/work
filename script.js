import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getFirestore, collection, doc, setDoc, deleteDoc, getDocs, query, where } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

// Firebase 설정
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
const auth = getAuth(app);

let selectedDate = null;
let cachedData = {};
let currentUser = null;

// UI 요소
const calendarEl = document.getElementById('calendar');
const monthTitleEl = document.getElementById('monthTitle');
const prevMonthBtn = document.getElementById('prevMonth');
const nextMonthBtn = document.getElementById('nextMonth');
const selectedDateBox = document.getElementById('selectedDateBox');
const startTimeInput = document.getElementById('startTime');
const endTimeInput = document.getElementById('endTime');
const breakCheck = document.getElementById('breakCheck');
const breakTimeInput = document.getElementById('breakTime');
const memoInput = document.getElementById('memo');
const saveBtn = document.getElementById('save');
const deleteBtn = document.getElementById('delete');
const weekTotalEl = document.getElementById('weekTotal');
const statusBox = document.getElementById('statusBox');

// 달력 상태
let currentYear, currentMonth;

// 날짜 포맷 YYYY-MM-DD
function formatDate(d){
  const y=d.getFullYear();
  const m=String(d.getMonth()+1).padStart(2,'0');
  const day=String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}

// 근무시간 계산
function parseTimeSec(start,end,breakTime='000000'){
  const parseHMS = s => s.includes(':') ? s.split(':').map(Number) : [parseInt(s.slice(0,2)),parseInt(s.slice(2,4)),parseInt(s.slice(4,6))];
  let [sh,sm,ss]=parseHMS(start);
  let [eh,em,es]=parseHMS(end);
  let [bh,bm,bs]=parseHMS(breakTime);
  let totalSec = (eh*3600+em*60+es) - (sh*3600+sm*60+ss) - (bh*3600+bm*60+bs);
  return totalSec>0?totalSec:0;
}

function calculateWorkTime(start,end,breakTime='000000'){
  const totalSec = parseTimeSec(start,end,breakTime);
  const h=String(Math.floor(totalSec/3600)).padStart(2,'0');
  const m=String(Math.floor((totalSec%3600)/60)).padStart(2,'0');
  const s=String(totalSec%60).padStart(2,'0');
  return `${h}:${m}:${s}`;
}

// 캘린더 렌더링
function renderCalendar(){
  calendarEl.innerHTML='';

  const firstDay = new Date(currentYear,currentMonth,1);
  const lastDay = new Date(currentYear,currentMonth+1,0);
  const startWeekDay = firstDay.getDay();
  const totalDays = lastDay.getDate();

  // 빈칸
  for(let i=0;i<startWeekDay;i++){
    const emptyCell = document.createElement('div');
    emptyCell.className='day empty';
    calendarEl.appendChild(emptyCell);
  }

  for(let i=1;i<=totalDays;i++){
    const dateObj = new Date(currentYear,currentMonth,i);
    const cell = document.createElement('div');
    cell.className='day';
    cell.dataset.date = formatDate(dateObj);

    const span = document.createElement('span');
    span.textContent = i;
    cell.appendChild(span);

    // 오늘 강조
    if(dateObj.toDateString() === new Date().toDateString()) cell.classList.add('today');

    // 클릭 시 선택
    cell.onclick = () => {
      document.querySelectorAll('.day.selected').forEach(el=>el.classList.remove('selected'));
      cell.classList.add('selected');
      selectDate(cell.dataset.date);
    };

    calendarEl.appendChild(cell);
  }

  monthTitleEl.textContent = `${currentYear}년 ${currentMonth+1}월`;

  // 선택된 날짜 다시 표시
  if(selectedDate) {
    const selectedCell = document.querySelector(`.day[data-date="${selectedDate}"]`);
    if(selectedCell) selectedCell.classList.add('selected');
  }
}

// 날짜 선택 시 패널 업데이트
function selectDate(date){
  selectedDate = date;
  selectedDateBox.textContent = date;

  const data = cachedData[date] || {};

  startTimeInput.value = data.start || '';
  endTimeInput.value = data.end || '';
  breakCheck.checked = data.break ? true : false;
  breakTimeInput.style.display = breakCheck.checked ? 'block' : 'none';
  breakTimeInput.value = data.break || '';
  memoInput.value = data.memo || '';

  updateWeekTotal(date);

  // 기록 표시
  const panelRecords = document.getElementById('panelRecords');
  if(!panelRecords){
    const recDiv = document.createElement('div');
    recDiv.id = 'panelRecords';
    selectedDateBox.parentElement.appendChild(recDiv);
  }

  const recDiv = document.getElementById('panelRecords');
  recDiv.innerHTML = '';

  if(data.start && data.end){
    const entry = document.createElement('div');
    entry.className = 'entry-card';
    entry.innerHTML = `<div class="entry-time">${data.start} ~ ${data.end} (${calculateWorkTime(data.start,data.end,data.break)})</div>
                       <div class="entry-memo">${data.memo || ''}</div>`;
    recDiv.appendChild(entry);
  } else {
    const none = document.createElement('div');
    none.className = 'record-none';
    none.textContent = '기록 없음';
    recDiv.appendChild(none);
  }
}

// 선택 주 총 근무시간
function updateWeekTotal(dateStr){
  const d = new Date(dateStr);
  const dayOfWeek = d.getDay();
  const sunday = new Date(d); sunday.setDate(d.getDate()-dayOfWeek);
  const saturday = new Date(d); saturday.setDate(d.getDate()+(6-dayOfWeek));

  let totalSec=0;
  for(let key in cachedData){
    const kd = new Date(key);
    if(kd>=sunday && kd<=saturday){
      const c = cachedData[key];
      if(c.start && c.end) totalSec += parseTimeSec(c.start,c.end,c.break);
    }
  }

  const h=String(Math.floor(totalSec/3600)).padStart(2,'0');
  const m=String(Math.floor((totalSec%3600)/60)).padStart(2,'0');
  const s=String(totalSec%60).padStart(2,'0');
  weekTotalEl.textContent=`${h}:${m}:${s}`;
}

// Firestore 데이터 불러오기
async function loadMonthData(){
  if(!currentUser) return;
  statusBox.style.display='block';
  statusBox.textContent='데이터 불러오는 중...';
  cachedData={};

  try{
    const q = query(collection(db,'workRecords'),where('uid','==',currentUser.uid));
    const snapshot = await getDocs(q);
    snapshot.forEach(docSnap=>{
      const d = docSnap.data();
      cachedData[d.date] = { start:d.start, end:d.end, break:d.break, memo:d.memo };
    });
    statusBox.style.display='none';
    renderCalendar();
    if(selectedDate) selectDate(selectedDate);
  }catch(e){
    console.error(e);
    statusBox.textContent='데이터 불러오기 실패';
  }
}

// 저장
async function saveData(){
  if(!currentUser||!selectedDate) return;
  statusBox.style.display='block';
  statusBox.textContent='저장 중...';
  try{
    await setDoc(doc(db,'workRecords',`${currentUser.uid}_${selectedDate}`),{
      uid:currentUser.uid,
      date:selectedDate,
      start:startTimeInput.value,
      end:endTimeInput.value,
      break:breakCheck.checked?breakTimeInput.value:'',
      memo:memoInput.value
    });
    await loadMonthData();
    statusBox.textContent='저장 완료';
  }catch(e){
    console.error(e);
    statusBox.textContent='저장 실패';
  }
}

// 삭제
async function deleteData(){
  if(!currentUser||!selectedDate) return;
  statusBox.style.display='block';
  statusBox.textContent='삭제 중...';
  try{
    await deleteDoc(doc(db,'workRecords',`${currentUser.uid}_${selectedDate}`));
    await loadMonthData();
    statusBox.textContent='삭제 완료';
  }catch(e){
    console.error(e);
    statusBox.textContent='삭제 실패';
  }
}

// 구글 로그인
async function signIn(){
  const provider = new GoogleAuthProvider();
  try{
    const result = await signInWithPopup(auth,provider);
    currentUser = result.user;
    await loadMonthData();
  }catch(e){
    console.error(e);
    alert('로그인 실패');
  }
}

// 초기화
function init(){
  const today = new Date();
  currentYear = today.getFullYear();
  currentMonth = today.getMonth();

  prevMonthBtn.onclick = ()=>{
    currentMonth--;
    if(currentMonth<0){currentMonth=11;currentYear--;}
    loadMonthData(); renderCalendar();
  };

  nextMonthBtn.onclick = ()=>{
    currentMonth++;
    if(currentMonth>11){currentMonth=0;currentYear++;}
    loadMonthData(); renderCalendar();
  };

  saveBtn.onclick = saveData;
  deleteBtn.onclick = deleteData;
  breakCheck.onchange = ()=>{ breakTimeInput.style.display = breakCheck.checked?'block':'none'; };

  onAuthStateChanged(auth,user=>{
    if(user){currentUser=user; loadMonthData();}
    else{signIn();}
  });
}

init();
