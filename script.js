// ----------------------
// Firebase 초기 설정
// ----------------------
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "INPUT_YOUR_KEY",
    authDomain: "INPUT",
    projectId: "INPUT",
    storageBucket: "INPUT",
    messagingSenderId: "INPUT",
    appId: "INPUT"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ----------------------
// DOM 요소
// ----------------------
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

// ----------------------
// 달력 렌더링
// ----------------------
function renderCalendar() {
    calendar.innerHTML = "";
    monthTitle.innerText = `${current.getFullYear()}년 ${current.getMonth() + 1}월`;

    const year = current.getFullYear();
    const month = current.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();

    for (let i = 0; i < firstDay; i++) {
        const empty = document.createElement("div");
        empty.className = "empty";
        calendar.appendChild(empty);
    }

    for (let d = 1; d <= lastDate; d++) {
        const cell = document.createElement("div");
        cell.className = "day";
        cell.innerText = d;

        cell.addEventListener("click", () => {
            selected = new Date(year, month, d);
            loadData();
        });

        calendar.appendChild(cell);
    }

    updateMonthTotal();
}

// ----------------------
// 선택한 날짜 표시
// ----------------------
function updateSelectedBox() {
    selectedBox.innerText = `${selected.getFullYear()}-${selected.getMonth() + 1}-${selected.getDate()}`;
}

// ----------------------
// Firestore에서 데이터 불러오기
// ----------------------
async function loadData() {
    updateSelectedBox();

    const id = getId();
    const ref = doc(db, "work-records", id);
    const snap = await getDoc(ref);

    if (snap.exists()) {
        const data = snap.data();
        startInput.value = data.start || "";
        endInput.value = data.end || "";
        memoInput.value = data.memo || "";
        breakCheck.checked = data.breakEnabled || false;
        breakInput.value = data.breakTime || "";
    } else {
        startInput.value = "";
        endInput.value = "";
        memoInput.value = "";
        breakCheck.checked = false;
        breakInput.value = "";
    }

    toggleBreakInput();
}

// ----------------------
// Firestore 저장
// ----------------------
async function saveData() {
    const id = getId();
    const ref = doc(db, "work-records", id);

    await setDoc(ref, {
        date: id,
        start: startInput.value,
        end: endInput.value,
        memo: memoInput.value,
        breakEnabled: breakCheck.checked,
        breakTime: breakInput.value
    });

    alert("저장 완료!");
    updateMonthTotal();
}

// ----------------------
// Firestore 삭제
// ----------------------
async function deleteData() {
    const id = getId();
    const ref = doc(db, "work-records", id);

    await deleteDoc(ref);
    alert("삭제 완료!");

    loadData();
    updateMonthTotal();
}

// ----------------------
// 월 전체 근무시간 계산
// ----------------------
async function updateMonthTotal() {
    monthTotal.innerText = "계산 중...";

    let totalMin = 0;

    const year = current.getFullYear();
    const month = current.getMonth();

    for (let d = 1; d <= 31; d++) {
        const id = `${year}-${month + 1}-${d}`;
        const ref = doc(db, "work-records", id);
        const snap = await getDoc(ref);

        if (snap.exists()) {
            const data = snap.data();

            if (data.start && data.end) {
                const start = parseTime(data.start);
                const end = parseTime(data.end);
                let worked = end - start;

                if (data.breakEnabled && data.breakTime) {
                    worked -= parseInt(data.breakTime) * 60 * 1000;
                }

                totalMin += worked / 60000;
            }
        }
    }

    monthTotal.innerText = `${Math.floor(totalMin / 60)}시간 ${Math.floor(totalMin % 60)}분`;
}

// ----------------------
// 기타 유틸
// ----------------------
function getId() {
    return `${selected.getFullYear()}-${selected.getMonth() + 1}-${selected.getDate()}`;
}

function parseTime(t) {
    const [h, m] = t.split(":");
    return new Date(0, 0, 0, h, m);
}

function toggleBreakInput() {
    breakWrap.style.display = breakCheck.checked ? "block" : "none";
}

// ----------------------
// 이벤트 등록
// ----------------------
breakCheck.addEventListener("change", toggleBreakInput);
saveBtn.addEventListener("click", saveData);
delBtn.addEventListener("click", deleteData);

// ----------------------
// 초기 실행
// ----------------------
renderCalendar();
loadData();
