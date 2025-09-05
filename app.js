const DOCS = [
  { id:"D-001", title:"Договор №123", type:"Договор аренды", status:"Действует",
    version:"1.0", date:"2025-09-01", author:"Иван Иванов",
    counterparty:"ООО Ромашка", projectNumber:"PRJ-2025-001",
    parentId:null, children:["D-001-1","D-001-A"] },
  { id:"D-001-1", title:"Доп. соглашение №1", type:"Доп. соглашение", status:"Подписан",
    version:"1.0", date:"2025-09-03", author:null, counterparty:null,
    projectNumber:null, parentId:"D-001", children:[] },
  { id:"D-001-A", title:"Приложение А", type:"Приложение", status:"Черновик",
    version:"0.3", date:"2025-09-04", author:null, counterparty:null,
    projectNumber:null, parentId:"D-001", children:[] },
  { id:"D-002", title:"Договор поставки №456", type:"Договор поставки", status:"В работе",
    version:"2.0", date:"2025-08-15", author:"Петр Петров",
    counterparty:"ООО Василек", projectNumber:"PRJ-2025-002",
    parentId:null, children:["D-002-1"] },
  { id:"D-002-1", title:"Спецификация №1", type:"Приложение", status:"Подписан",
    version:"1.0", date:"2025-08-20", author:null, counterparty:null,
    projectNumber:null, parentId:"D-002", children:[] },
  { id:"D-003", title:"Соглашение о конфиденциальности", type:"NDA", status:"Действует",
    version:"1.0", date:"2025-07-10", author:"Анна Смирнова",
    counterparty:"ЗАО Ландыш", projectNumber:"PRJ-2025-003",
    parentId:null, children:[] }
];

const INHERITED = ["author","counterparty","projectNumber"];

const $list = document.getElementById("doc-list");
const $main = document.querySelector("main");
const $search = document.getElementById("search");
const $statusFilter = document.getElementById("status-filter");

const byId = Object.fromEntries(DOCS.map(d => [d.id, d]));

function getStatusBadge(status) {
  let classes = "px-2 py-0.5 rounded-full text-xs ";
  switch(status) {
    case "Действует": classes += "bg-green-100 text-green-700"; break;
    case "Подписан": classes += "bg-blue-100 text-blue-700"; break;
    case "В работе": classes += "bg-amber-100 text-amber-700"; break;
    case "Черновик": classes += "bg-gray-100 text-gray-700"; break;
    default: classes += "bg-gray-100 text-gray-700"; break;
  }
  return `<span class="${classes}">${status}</span>`;
}

function renderList(filter="", status="") {
  $list.innerHTML = "";
  DOCS.filter(d =>
    d.title.toLowerCase().includes(filter.toLowerCase()) &&
    (status === "" || d.status === status)
  ).forEach(d => {
    const li = document.createElement("li");
    li.className = "px-3 py-2 rounded hover:bg-gray-100 cursor-pointer flex justify-between";
    li.innerHTML = `<span>${d.title}</span>${getStatusBadge(d.status)}`;
    li.onclick = () => openCard(d.id);
    $list.appendChild(li);
  });
}

function withInheritance(doc) {
  if (!doc.parentId) return { doc, parent: null, resolved: { ...doc } };
  const parent = byId[doc.parentId];
  const resolved = { ...doc };
  INHERITED.forEach(k => { if (resolved[k] == null && parent) resolved[k] = parent[k]; });
  return { doc, parent, resolved };
}

function openCard(id) {
  const { doc, parent, resolved } = withInheritance(byId[id]);

  const childrenHtml = (doc.children || [])
    .map(cid => byId[cid] ? `<a href="#" data-child="${cid}" class="underline hover:no-underline">${byId[cid].title}</a>` : '')
    .filter(Boolean).join(", ") || "—";

  $main.innerHTML = `
    <div class="p-6 w-full text-left">
      <h2 class="text-xl font-bold mb-4">${resolved.title}</h2>
      <div class="grid grid-cols-2 gap-4">
        ${field("Тип", resolved.type)}
        ${field("Статус", resolved.status, true)}
        ${field("Версия", resolved.version)}
        ${field("Дата создания", resolved.date)}
        ${field("Автор", resolved.author, false, doc.author==null, parent)}
        ${field("Контрагент", resolved.counterparty, false, doc.counterparty==null, parent)}
        ${field("Номер проекта", resolved.projectNumber, false, doc.projectNumber==null, parent)}
      </div>
      <div class="mt-6">
        <h3 class="font-semibold mb-2">Связи</h3>
        <p class="text-sm text-gray-600">Родитель: ${ parent ? `<b>${parent.title}</b>` : "—" }</p>
        <p class="text-sm text-gray-600">Дочерние: ${childrenHtml}</p>
      </div>
    </div>
  `;

  // кликабельные дети
  $main.querySelectorAll('[data-child]').forEach(a => {
    a.addEventListener('click', e => {
      e.preventDefault();
      openCard(e.currentTarget.dataset.child);
    });
  });

  // обновляем футер печати
  const footerTitle = document.getElementById("print-doc-title");
  if (footerTitle) footerTitle.textContent = resolved.title || "Без названия";
}

function field(label, value, badge=false, inherited=false, parent=null) {
  const lock = inherited ? `<span class="ml-2 text-xs px-2 py-0.5 rounded bg-gray-100" title="Наследуется от: ${parent?.title || ''}">🔒</span>` : "";
  const val = badge ? getStatusBadge(value) : `<span class="${inherited ? 'text-gray-500' : 'font-medium'}">${value ?? "—"}</span>`;
  return `<div><div class="text-gray-500 text-xs">${label}${lock}</div><div>${val}</div></div>`;
}

// фильтры
if ($search) $search.addEventListener("input", () => renderList($search.value, $statusFilter?.value || ""));
if ($statusFilter) $statusFilter.addEventListener("change", () => renderList($search?.value || "", $statusFilter.value));

// старт
renderList();
console.log("Документы загружены:", DOCS.length);

// ====== ДЕМО-РЕЖИМ (минимальная реализация) ======
let tourIndex = 0;
const $tourOverlay = document.getElementById('tour-overlay');
const $tourPopover = document.getElementById('tour-popover');
const $tourContent = document.getElementById('tour-content');
const $tourNext = document.getElementById('tour-next');
const $tourPrev = document.getElementById('tour-prev');
const $tourEnd  = document.getElementById('tour-end');
const $demoBtn  = document.getElementById('demo-btn');

function _showTourUI(show) {
  if (!$tourOverlay || !$tourPopover) return;
  $tourOverlay.classList.toggle('hidden', !show);
  $tourPopover.classList.toggle('hidden', !show);
  // снимем прошлую подсветку
  document.querySelectorAll('.tour-highlight').forEach(n => n.classList.remove('tour-highlight'));
}

function _focusTarget(el) {
  if (!el) return;
  el.classList.add('tour-highlight');
  const r = el.getBoundingClientRect();
  // позиционируем поповер под элементом
  $tourPopover.style.top = `${Math.max(16, window.scrollY + r.bottom + 8)}px`;
  $tourPopover.style.left = `${Math.max(16, window.scrollX + r.left)}px`;
}

const TOUR_STEPS = [
  {
    id: 'intro',
    text: 'Это демо: слева список, справа карточка. Начнём с родительского документа.',
    target: () => document.getElementById('doc-list'),
    onNext: () => openCard('D-001')
  },
  {
    id: 'parent',
    text: 'Родительский документ. Поля редактируемы, статус с цветным бейджем.',
    target: () => document.querySelector('main h2'),
    onNext: () => openCard('D-001-1')
  },
  {
    id: 'child',
    text: 'Дочерний: обратите внимание на 🔒 — Автор, Контрагент и № проекта наследуются от родителя.',
    target: () => Array.from(document.querySelectorAll('main .text-gray-500.text-xs'))
                       .find(n => n.textContent.includes('Автор'))
  },
  {
    id: 'relations',
    text: 'Связи: родитель и дочерние (по ссылкам можно переходить).',
    target: () => Array.from(document.querySelectorAll('main p'))
                       .find(n => n.textContent.includes('Дочерние'))
  },
  {
    id: 'search',
    text: 'Есть поиск по названию. Введите «договор», чтобы отфильтровать список.',
    target: () => document.getElementById('search'),
    onNext: () => { const s = document.getElementById('search'); if (s) s.focus(); }
  },
  {
    id: 'independent',
    text: 'Откроем независимый документ — «Соглашение о конфиденциальности».',
    target: () => document.getElementById('doc-list'),
    onNext: () => openCard('D-003')
  },
  {
    id: 'print',
    text: 'Экспорт: нажмите «Скачать PDF». Будут шапка с датой и футер с названием документа.',
    target: () => Array.from(document.querySelectorAll('button'))
                       .find(b => b.textContent.includes('Скачать PDF'))
  },
  {
    id: 'finish',
    text: 'Демо завершено. Можно исследовать прототип дальше.',
    target: () => document.querySelector('main')
  }
];

function renderStep() {
  const step = TOUR_STEPS[tourIndex];
  if (!step) return endTour();
  $tourContent.innerHTML = step.text;
  const target = step.target && step.target();
  document.querySelectorAll('.tour-highlight').forEach(n => n.classList.remove('tour-highlight'));
  _focusTarget(target);
}

function nextStep() {
  const step = TOUR_STEPS[tourIndex];
  if (step && typeof step.onNext === 'function') step.onNext();
  tourIndex = Math.min(TOUR_STEPS.length - 1, tourIndex + 1);
  renderStep();
}

function prevStep() {
  tourIndex = Math.max(0, tourIndex - 1);
  renderStep();
}

function startTour() {
  tourIndex = 0;
  _showTourUI(true);
  renderStep();
}

function endTour() {
  _showTourUI(false);
}

// привязки кнопок (если элементы есть на странице)
$demoBtn  && $demoBtn.addEventListener('click', startTour);
$tourNext && $tourNext.addEventListener('click', nextStep);
$tourPrev && $tourPrev.addEventListener('click', prevStep);
$tourEnd  && $tourEnd.addEventListener('click', endTour);
$tourOverlay && $tourOverlay.addEventListener('click', endTour);
// ====== /ДЕМО-РЕЖИМ ======