import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, deleteDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

window.addEventListener('DOMContentLoaded', () => {

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
  const selectedEntry = document.getElementById("selectedEntry");

  let current = new Date();
  let selected = new Date();
  let monthDataCache = {}; // 날짜별 데이터 캐싱

  // 유틸
  function pad(n){ return String(n).padStart(2,"0"); }

  // 105516 -> 10:55:16
  function formatTimeString(t){
    t = t.toString().padStart(6,"0");
    return `${t.slice(0,2)}:${t.slice(2,4)}:${t.slice(4,6)}`;
  }

  // 초 -> hh:mm:ss
  function formatSec(sec){
    const h = Math.floor(sec/3600);
    const m = Math.floor((sec%3600)/60);
    const s = sec%60;
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  }

  function parseTime(t){
    if(!t) return 0;
    t = t.toString().replace(/[^0-9:]/g,"").trim();
    if(t.includes(":")){
      const [h,m,s]=t.split(":").map(Number);
      return h*3600 + m*60 + (s||0);
    }
    t = t.padStart(6,"0");
    return Number(t.slice(0,2))*3600 + Number(t.slice(2,4))*60 + Number(t.slice(4,6));
  }

  // 한 날 데이터 로드
  async function loadDayData(date){
    const iso = date.toISOString().slice(0,10);
    try{
      const snap = await getDoc(doc(db,"worklog",iso));
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

  // 한 달 데이터 로드
  async function loadMonthData(year, month){
    try{
      const start = new Date(year, month, 1);
      const end = new Date(year, month+1, 0);
      const snap = await getDocs(collection(db,"worklog"));
      snap.forEach(doc => {
        const iso = doc.id;
        const d = new Date(iso);
        if(d >= start && d <= end){
          monthDataCache[iso] = doc.data();
        }
      });
    }catch(e){
      console.error("월 데이터 로드 실패:", e);
      calendarError.style.display = "block";
      calendarError.textContent = "월 데이터 불러오기 실패!";
    }
  }

  // 선택 날짜 표시 + 하단 기록
  async function renderSelected(){
    const iso = selected.toISOString().slice(0,10);
    selectedBox.textContent = iso;
    await loadDayData(selected);
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

    calcWeekTotal(selected);

    // 하단 기록 표시
    if(data){
      const startSec = parseTime(data.start);
      const endSec = parseTime(data.end);
      const totalSec = endSec - startSec - (data.break ? parseTime(data.break) : 0);
      const h = Math.floor(totalSec/3600);
      const m = Math.floor((totalSec%3600)/60);
      selectedEntry.innerHTML = `
        <div class="entry-card">
          <div class="entry-date">${iso}</div>
          <div class="entry-time" style="font-size:12px;color:#aaa;">
            ${formatTimeString(data.start)} - ${formatTimeString(data.end)} (${h}시간 ${m}분)
          </div>
          <div class="entry-memo">${data.memo || '메모 없음'}</div>
        </div>
      `;
    } else {
      selectedEntry.innerHTML = `<div class="record-none">선택한 날짜에 기록이 없습니다.</div>`;
    }
  }

  // 캘린더 렌더링
  function renderCalendar(){
    calendar.innerHTML = "";
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

      box.onclick = ()=> {
        selected = new Date(iso);
        renderSelected();
        highlightSelectedDay();
      };

      calendar.appendChild(box);
    }
  }

  function highlightSelectedDay(){
    document.querySelectorAll(".day").forEach(d=>{
      d.classList.remove("selected");
      const span = d.querySelector("span");
      if(span && Number(span.textContent) === selected.getDate()) d.classList.add("selected");
    });
  }

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
    weekTotal.textContent = `${Math.floor(sum/3600)}시간 ${Math.floor((sum%3600)/60)}분`;
  }

  // 이벤트
  breakCheck.onclick = ()=> {
    breakWrap.style.display = breakCheck.checked ? "block":"none";
    if(!breakCheck.checked) breakInput.value="";
  };

  saveBtn.onclick = async ()=>{
    const iso = selected.toISOString().slice(0,10);
    const s = parseTime(startInput.value);
    const e = parseTime(endInput.value);
    const b = parseTime(breakInput.value);
    if(e < s) return alert("퇴근이 출근보다 빠를 수 없습니다.");
    const total = e - s - b;

    saveBtn.textContent = "저장 중...";
    await setDoc(doc(db,"worklog",iso),{
      start: startInput.value,
      end: endInput.value,
      break: breakCheck.checked ? breakInput.value : "",
      memo: memoInput.value.trim(),
      time: formatSec(total),
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

  document.getElementById("prevMonth").onclick = async ()=>{
    current.setMonth(current.getMonth()-1);
    await loadMonthData(current.getFullYear(), current.getMonth());
    renderCalendar();
  };

  document.getElementById("nextMonth").onclick = async ()=>{
    current.setMonth(current.getMonth()+1);
    await loadMonthData(current.getFullYear(), current.getMonth());
    renderCalendar();
  };

  reLoginBtn.onclick = ()=> signOut(auth).then(()=> location.reload());

  // 초기
  onAuthStateChanged(auth, async user => {
    if(user){
      await loadMonthData(current.getFullYear(), current.getMonth());
      renderCalendar();
      renderSelected();
    } else {
      alert("로그인이 필요합니다.");
      location.href = "login.html";
    }
  });

});
