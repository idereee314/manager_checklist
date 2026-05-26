// ── Config ────────────────────────────────
const SUPABASE_URL = 'https://lttprbyfbroiicvietal.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx0dHByYnlmYnJvaWljdmlldGFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2OTQyMDIsImV4cCI6MjA5NTI3MDIwMn0.z3F9i_RKmu1Yf-PFY9KpFiLYwrngCkZpGgRLbotBxQw';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Constants ─────────────────────────────
const MN_DAYS   = ['Ням','Дав','Мяг','Лха','Пүр','Баа','Бям'];
const MN_MONTHS = ['1-р сар','2-р сар','3-р сар','4-р сар','5-р сар','6-р сар',
                   '7-р сар','8-р сар','9-р сар','10-р сар','11-р сар','12-р сар'];

// ── State ─────────────────────────────────
let tasks     = [];
let viewYear, viewMonth;
let selDate   = todayStr();

// ── Helpers ───────────────────────────────
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function prog(t) {
  const subs = t.subtasks || [];
  return subs.length ? Math.round(subs.filter(s => s.done).length / subs.length * 100) : 0;
}

function allDone(t) {
  const subs = t.subtasks || [];
  return subs.length > 0 && subs.every(s => s.done);
}

function dayTasks(date) {
  return tasks.filter(t => t.date === date).sort((a, b) => a.time < b.time ? -1 : 1);
}

function fmtDate(y, m, d) {
  return new Date(y, m, d).toISOString().slice(0, 10);
}

function showToast(msg, isError = false) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast show' + (isError ? ' error' : '');
  setTimeout(() => el.className = 'toast', 2500);
}

// ── Supabase CRUD ─────────────────────────
async function loadAll() {
  const { data, error } = await sb
    .from('tasks')
    .select('*, subtasks(*)')
    .order('date')
    .order('time');

  if (error) {
    showToast('Өгөгдөл ачаалахад алдаа гарлаа', true);
    return;
  }
  tasks = (data || []).map(t => ({ ...t, exp: false, subtasks: t.subtasks || [] }));
}

async function createTask(name, date, time) {
  const { data, error } = await sb
    .from('tasks')
    .insert({ name, date, time: time || null })
    .select()
    .single();

  if (error) { showToast('Алдаа гарлаа', true); return null; }
  return { ...data, exp: true, subtasks: [] };
}

async function deleteTask(id) {
  const { error } = await sb.from('tasks').delete().eq('id', id);
  if (error) { showToast('Устгахад алдаа гарлаа', true); return false; }
  return true;
}

async function createSubtask(taskId, text) {
  const { data, error } = await sb
    .from('subtasks')
    .insert({ task_id: taskId, text, done: false })
    .select()
    .single();

  if (error) { showToast('Алдаа гарлаа', true); return null; }
  return data;
}

async function updateSubtask(id, done) {
  const { error } = await sb.from('subtasks').update({ done }).eq('id', id);
  if (error) { showToast('Алдаа гарлаа', true); return false; }
  return true;
}

async function deleteSubtask(id) {
  const { error } = await sb.from('subtasks').delete().eq('id', id);
  if (error) { showToast('Алдаа гарлаа', true); return false; }
  return true;
}

async function updateAllSubtasks(taskId, done) {
  const { error } = await sb.from('subtasks').update({ done }).eq('task_id', taskId);
  if (error) { showToast('Алдаа гарлаа', true); return false; }
  return true;
}

// ── UI Actions ────────────────────────────
function toggleExp(id) {
  const t = tasks.find(t => t.id === id);
  if (t) t.exp = !t.exp;
  renderDayPanel();
}

async function toggleAll(id) {
  const t = tasks.find(t => t.id === id);
  if (!t) return;
  const done = allDone(t);
  const ok = await updateAllSubtasks(id, !done);
  if (!ok) return;
  t.subtasks.forEach(s => s.done = !done);
  renderDayPanel();
  renderCal();
}

async function toggleSub(tid, sid) {
  const t = tasks.find(t => t.id === tid);
  const s = t?.subtasks.find(s => s.id === sid);
  if (!s) return;
  const ok = await updateSubtask(sid, !s.done);
  if (!ok) return;
  s.done = !s.done;
  renderDayPanel();
  renderCal();
}

async function delSubUI(tid, sid) {
  const ok = await deleteSubtask(sid);
  if (!ok) return;
  const t = tasks.find(t => t.id === tid);
  if (t) t.subtasks = t.subtasks.filter(s => s.id !== sid);
  renderDayPanel();
  renderCal();
}

async function delTaskUI(id) {
  const ok = await deleteTask(id);
  if (!ok) return;
  tasks = tasks.filter(t => t.id !== id);
  renderDayPanel();
  renderCal();
}

async function addSub(tid) {
  const inp = document.getElementById('si' + tid);
  if (!inp || !inp.value.trim()) return;
  const t = tasks.find(t => t.id === tid);
  if (!t) return;
  inp.disabled = true;
  const sub = await createSubtask(tid, inp.value.trim());
  inp.disabled = false;
  if (!sub) return;
  t.subtasks.push(sub);
  renderDayPanel();
  renderCal();
}

// ── Calendar ──────────────────────────────
function initView() {
  const now = new Date();
  viewYear  = now.getFullYear();
  viewMonth = now.getMonth();
}

function shiftMonth(d) {
  viewMonth += d;
  if (viewMonth > 11) { viewMonth = 0; viewYear++; }
  if (viewMonth < 0)  { viewMonth = 11; viewYear--; }
  renderCal();
}

function selectDate(date) {
  selDate = date;
  renderCal();
  renderDayPanel();
}

function renderCal() {
  document.getElementById('cal-month-label').textContent = MN_MONTHS[viewMonth] + ' ' + viewYear;

  const first    = new Date(viewYear, viewMonth, 1);
  let startDow   = first.getDay();
  startDow       = startDow === 0 ? 6 : startDow - 1;
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const daysInPrev  = new Date(viewYear, viewMonth, 0).getDate();
  const today    = todayStr();

  let cells = [];
  for (let i = 0; i < startDow; i++) {
    const d = daysInPrev - startDow + 1 + i;
    cells.push({ d, date: fmtDate(viewYear, viewMonth - 1, d), other: true });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ d, date: fmtDate(viewYear, viewMonth, d), other: false });
  }
  const total = Math.ceil(cells.length / 7) * 7;
  let nd = 1;
  while (cells.length < total) {
    cells.push({ d: nd, date: fmtDate(viewYear, viewMonth + 1, nd), other: true });
    nd++;
  }

  const grid = document.getElementById('cal-grid');
  grid.innerHTML = cells.map(c => {
    const dt      = dayTasks(c.date);
    const isToday = c.date === today;
    const isSel   = c.date === selDate;

    const dots = dt.slice(0, 3).map(t => {
      const done    = allDone(t);
      const overdue = c.date < today && !done;
      return `<div class="day-dot ${done ? 'done' : overdue ? 'overdue' : 'pending'}"></div>`;
    }).join('');

    const numEl = isToday
      ? `<span class="day-num" style="background:var(--accent);color:#fff;width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;">${c.d}</span>`
      : `<span class="day-num">${c.d}</span>`;

    return `<div class="cal-day ${c.other ? 'other-month' : ''} ${isToday ? 'today' : ''} ${isSel ? 'selected' : ''}"
      onclick="selectDate('${c.date}')">
      ${numEl}
      <div class="day-dots">${dots}</div>
    </div>`;
  }).join('');

  renderTopStats();
}

function renderTopStats() {
  const total      = tasks.reduce((a, t) => a + (t.subtasks?.length || 0), 0);
  const done       = tasks.reduce((a, t) => a + (t.subtasks?.filter(s => s.done).length || 0), 0);
  const todayCount = dayTasks(todayStr()).length;

  document.getElementById('topbar-stats').innerHTML = `
    <div class="stat-pill green"><span>${done}</span>/${total} subtask</div>
    <div class="stat-pill amber"><span>${todayCount}</span> өнөөдөр</div>
    <div class="stat-pill purple"><span>${tasks.length}</span> нийт</div>`;
}

// ── Day panel ─────────────────────────────
function renderDayPanel() {
  const today = todayStr();
  const dt    = new Date(selDate + 'T00:00:00');
  const dow   = MN_DAYS[dt.getDay()];
  const diff  = Math.round((new Date(selDate) - new Date(today)) / 86400000);
  const title = diff === 0 ? 'Өнөөдөр' : diff === 1 ? 'Маргааш' : diff === -1 ? 'Өчигдөр' : dow;
  const md    = selDate.slice(5).replace('-', '/');

  document.getElementById('day-title').textContent = title;
  document.getElementById('day-sub').textContent   = `${selDate.slice(0, 4)} оны ${md} — ${dow}`;

  const ts        = dayTasks(selDate);
  const totalSubs = ts.reduce((a, t) => a + (t.subtasks?.length || 0), 0);
  const doneSubs  = ts.reduce((a, t) => a + (t.subtasks?.filter(s => s.done).length || 0), 0);
  const pct       = totalSubs ? Math.round(doneSubs / totalSubs * 100) : 0;

  document.getElementById('day-prog-fill').style.width = pct + '%';
  document.getElementById('day-prog-pct').textContent  = pct + '%';

  const el = document.getElementById('task-list');
  if (!ts.length) {
    el.innerHTML = `<div class="no-tasks">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2">
        <rect x="3" y="4" width="18" height="18" rx="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
      <span>Энэ өдөрт ажил байхгүй</span>
    </div>`;
    return;
  }

  el.innerHTML = ts.map(t => {
    const p       = prog(t);
    const done    = allDone(t);
    const isOld   = selDate < today && !done;
    const r = 10, c = Math.PI * 2 * r, off = c - (c * p / 100);

    const statusBadge = isOld
      ? `<span class="badge badge-overdue">Хоцорсон</span>`
      : done ? `<span class="badge badge-done">Дууссан</span>`
      : p > 0 ? `<span class="badge badge-pending">${p}%</span>` : '';

    return `<div class="task-block ${done ? 'all-done' : ''}">
      <div class="task-row">
        <div class="big-check ${done ? 'done' : ''}" onclick="toggleAll('${t.id}')">
          <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <div class="task-meta-col" onclick="toggleExp('${t.id}')">
          <div class="task-title ${done ? 'done' : ''}">${t.name}</div>
          <div class="task-subtitle">${t.subtasks?.length
            ? `${t.subtasks.filter(s => s.done).length}/${t.subtasks.length} subtask`
            : 'subtask байхгүй'}</div>
        </div>
        <div class="task-badges">
          ${t.time ? `<span class="badge badge-time">${t.time}</span>` : ''}
          ${statusBadge}
          ${t.subtasks?.length ? `
            <div class="ring-mini">
              <svg width="28" height="28" viewBox="0 0 28 28">
                <circle class="rb" cx="14" cy="14" r="${r}"/>
                <circle class="rf" cx="14" cy="14" r="${r}"
                  stroke-dasharray="${c.toFixed(1)}"
                  stroke-dashoffset="${off.toFixed(1)}"/>
              </svg>
              <div class="rl">${p}%</div>
            </div>` : ''}
          <button class="expander ${t.exp ? 'open' : ''}" onclick="toggleExp('${t.id}')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
          <button class="del-task" onclick="delTaskUI('${t.id}')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14H6L5 6"/>
              <path d="M10 11v6"/><path d="M14 11v6"/>
              <path d="M9 6V4h6v2"/>
            </svg>
          </button>
        </div>
      </div>

      <div class="task-prog-strip">
        <div class="task-prog-fill" style="width:${p}%"></div>
      </div>

      ${t.exp ? `<div class="subtask-section">
        <div class="sub-list">
          ${(t.subtasks || []).map(s => `
            <div class="sub-row">
              <div class="sm-check ${s.done ? 'on' : ''}" onclick="toggleSub('${t.id}','${s.id}')">
                <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <span class="sub-txt ${s.done ? 'done' : ''}">${s.text}</span>
              <button class="sub-del" onclick="delSubUI('${t.id}','${s.id}')">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>`).join('')}
        </div>
        <div class="sub-add-wrap">
          <input type="text" id="si${t.id}"
            placeholder="Subtask нэмэх..."
            onkeydown="if(event.key==='Enter') addSub('${t.id}')"/>
          <button onclick="addSub('${t.id}')">+ Нэмэх</button>
        </div>
      </div>` : ''}
    </div>`;
  }).join('');
}

// ── Modal ─────────────────────────────────
function setQuickDate(daysFromNow) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  const val = d.toISOString().slice(0, 10);
  document.getElementById('f-date').value = val;
  document.querySelectorAll('.dq-btn').forEach((b, i) => {
    b.classList.toggle('active', i === [0,1,7].indexOf(daysFromNow));
  });
}

function setQuickTime(val) {
  document.getElementById('f-time').value = val;
  document.querySelectorAll('.tq-btn').forEach(b => {
    b.classList.toggle('active', b.textContent === val);
  });
}
function openModal() {
  document.getElementById("f-name").value = "";
  document.getElementById("f-date").value = selDate;
  document.getElementById("f-time").value = "";
  const diff = Math.round((new Date(selDate) - new Date(todayStr())) / 86400000);
  document.querySelectorAll(".dq-btn").forEach((b, i) => {
    b.classList.toggle("active", (i === 0 && diff === 0) || (i === 1 && diff === 1));
  });
  document.querySelectorAll(".tq-btn").forEach(b => b.classList.remove("active"));
  document.getElementById("overlay").classList.add("show");
  setTimeout(() => document.getElementById("f-name").focus(), 50);
}

function closeModal() {
  document.getElementById('overlay').classList.remove('show');
}

function overlayClick(e) {
  if (e.target === e.currentTarget) closeModal();
}

async function saveTask() {
  const name = document.getElementById('f-name').value.trim();
  const date = document.getElementById('f-date').value;
  const time = document.getElementById('f-time').value;
  if (!name || !date) return;

  const btn = document.getElementById('btn-save');
  btn.disabled    = true;
  btn.textContent = 'Хадгалж байна...';

  const task = await createTask(name, date, time);
  btn.disabled    = false;
  btn.textContent = 'Нэмэх';
  if (!task) return;

  tasks.push(task);
  closeModal();
  showToast('Ажил нэмэгдлээ ✓');
  renderCal();
  renderDayPanel();
}

document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

// ── Init ──────────────────────────────────
async function init() {
  initView();
  await loadAll();
  document.getElementById('loading').classList.add('hide');
  renderCal();
  renderDayPanel();
}

init();