let DOCS = [];

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

  // Скрываем сообщение "Выберите документ"
  const welcomeDiv = $main.querySelector('div:first-child');
  if (welcomeDiv) welcomeDiv.style.display = 'none';

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
        ${field("Дата создания", resolved.date || resolved.createdAt)}
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

  // Рендеринг дополнительных полей для новых типов документов
  renderApplicationExtras(doc);
  renderCostCentersTable(doc);
  renderApplicationTemplate(doc);
  renderAgreementExtras(doc);
  renderAgreementTemplates(doc);

  // обновляем футер печати
  const footerTitle = document.getElementById("print-doc-title");
  if (footerTitle) footerTitle.textContent = resolved.title || "Без названия";
}

function field(label, value, badge=false, inherited=false, parent=null) {
  const lock = inherited ? `<span class="ml-2 text-xs px-2 py-0.5 rounded bg-gray-100" title="Наследуется от: ${parent?.title || ''}">🔒</span>` : "";
  const val = badge ? getStatusBadge(value) : `<span class="${inherited ? 'text-gray-500' : 'font-medium'}">${value ?? "—"}</span>`;
  return `<div><div class="text-gray-500 text-xs">${label}${lock}</div><div>${val}</div></div>`;
}

// Функция форматирования чисел
function fmt(n) {
  return new Intl.NumberFormat('ru-RU').format(n);
}

// Рендеринг дополнительных полей для Application
function renderApplicationExtras(doc) {
  const wrap = document.getElementById('app-extra');
  if (!wrap) return;

  if (doc.type !== 'Application') { 
    wrap.innerHTML = ''; 
    wrap.classList.add('hidden');
    return; 
  }

  wrap.classList.remove('hidden');
  wrap.innerHTML = `
    <div class="grid grid-cols-2 gap-6">
      <div>
        <div class="text-sm text-gray-500">Организация</div>
        <div class="font-medium">${doc.organization ?? '—'}</div>
      </div>
      <div>
        <div class="text-sm text-gray-500">Контрагент</div>
        <div class="font-medium">${doc.counterparty ?? '—'}</div>
      </div>

      <div>
        <div class="text-sm text-gray-500">Гриф конфиденциальности</div>
        <div class="font-medium">${doc.confidentiality ?? '—'}</div>
      </div>
      <div>
        <div class="text-sm text-gray-500">Статья бюджета</div>
        <div class="font-medium">${doc.budgetArticle ?? '—'}</div>
      </div>

      <div class="col-span-2">
        <div class="text-sm text-gray-500">Содержание</div>
        <div class="font-medium">${doc.content ?? '—'}</div>
      </div>

      <div>
        <div class="text-sm text-gray-500">Регистрационный номер</div>
        <div class="font-medium">${doc.regNumber ?? '—'}</div>
      </div>

      <div>
        <div class="text-sm text-gray-500">Автор / Дата создания</div>
        <div class="font-medium">
          ${doc.author ?? '—'}${doc.createdAt ? ' — ' + doc.createdAt : ''}
        </div>
      </div>

      <div>
        <div class="text-sm text-gray-500">Ответственный</div>
        <div class="font-medium">${doc.responsible ?? '—'}</div>
      </div>

      <div>
        <div class="text-sm text-gray-500">Подразделение ответственного</div>
        <div class="font-medium">${doc.responsibleDept ?? '—'}</div>
      </div>
    </div>
  `;
}

// Рендеринг таблицы кост-центров
function renderCostCentersTable(doc) {
  const host = document.getElementById('cost-centers');
  if (!host) return;
  
  if (doc.type !== 'Application') { 
    host.innerHTML = ''; 
    host.classList.add('hidden');
    return; 
  }

  host.classList.remove('hidden');
  const rows = Array.isArray(doc.costCenters) ? doc.costCenters : [];
  const total = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);

  host.innerHTML = `
    <div class="mt-6">
      <div class="text-sm text-gray-500 mb-2">Кост-центр (табличный справочник)</div>
      <table class="w-full border rounded overflow-hidden">
        <thead>
          <tr class="bg-gray-50">
            <th class="text-left p-2 border-b">Центр затрат</th>
            <th class="text-right p-2 border-b">Сумма, ₽</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(r => `
            <tr>
              <td class="p-2 border-b">${r.cc}</td>
              <td class="p-2 border-b text-right">${fmt(r.amount || 0)}</td>
            </tr>
          `).join('')}
          <tr>
            <td class="p-2 font-semibold text-right">Итого:</td>
            <td class="p-2 font-semibold text-right">${fmt(total)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  `;
}

// Рендеринг автосгенерированного шаблона для Application
function renderApplicationTemplate(doc) {
  const box = document.getElementById('auto-template');
  if (!box) return;
  
  if (doc.type !== 'Application') { 
    box.innerHTML = ''; 
    box.classList.add('hidden');
    return; 
  }

  box.classList.remove('hidden');
  const rows = (doc.costCenters || [])
    .map(r => `— ${r.cc}: ${fmt(r.amount || 0)} ₽`).join('<br>');

  const total = (doc.costCenters || [])
    .reduce((s, r) => s + (Number(r.amount) || 0), 0);

  const template = `
    <div class="mt-6 p-4 border rounded bg-gray-50">
      <div class="font-semibold mb-2">Автосгенерированный шаблон</div>
      <div class="text-sm leading-relaxed">
        Организация: <b>${doc.organization ?? '—'}</b><br>
        Контрагент: <b>${doc.counterparty ?? '—'}</b><br>
        Статья бюджета: <b>${doc.budgetArticle ?? '—'}</b><br>
        Рег. номер: <b>${doc.regNumber ?? '—'}</b><br>
        Автор/Дата: <b>${doc.author ?? '—'}</b>${doc.createdAt ? ' — <b>' + doc.createdAt + '</b>' : ''}<br>
        Ответственный: <b>${doc.responsible ?? '—'}</b>, подразделение: <b>${doc.responsibleDept ?? '—'}</b><br>
        <br>
        Содержание: ${doc.content ?? '—'}<br>
        <br>
        Распределение по кост-центрам:<br>
        ${rows || '—'}<br>
        <b>Итого: ${fmt(total)} ₽</b>
      </div>
    </div>
  `;

  box.innerHTML = template;
}

// Рендеринг дополнительных полей для Agreement
function renderAgreementExtras(doc) {
  const wrap = document.getElementById('app-extra');
  if (!wrap) return;
  if (doc.type !== 'Agreement') return;

  const block = `
    <div class="grid grid-cols-2 gap-6 mt-6">
      <div>
        <div class="text-sm text-gray-500">Организация</div>
        <div class="font-medium">${doc.organization ?? '—'}</div>
      </div>
      <div>
        <div class="text-sm text-gray-500">Контрагент</div>
        <div class="font-medium">${doc.counterparty ?? '—'}</div>
      </div>

      <div>
        <div class="text-sm text-gray-500">Регистрационный номер</div>
        <div class="font-medium">${doc.regNumber ?? '—'}</div>
      </div>

      <div>
        <div class="text-sm text-gray-500">Автор / Дата создания</div>
        <div class="font-medium">
          ${doc.author ?? '—'}${doc.createdAt ? ' — ' + doc.createdAt : ''}
        </div>
      </div>

      <div>
        <div class="text-sm text-gray-500">Ответственный</div>
        <div class="font-medium">${doc.responsible ?? '—'}</div>
      </div>

      <div>
        <div class="text-sm text-gray-500">Подразделение ответственного</div>
        <div class="font-medium">${doc.responsibleDept ?? '—'}</div>
      </div>
    </div>
  `;

  wrap.insertAdjacentHTML('beforeend', block);
  wrap.classList.remove('hidden');
}

// Рендеринг шаблонов для Agreement
function renderAgreementTemplates(doc) {
  const box = document.getElementById('auto-template');
  if (!box) return;
  if (doc.type !== 'Agreement') return;

  const kinds = Array.isArray(doc.agreementKinds) ? doc.agreementKinds : [];

  const ndaTpl = `
    <div class="mb-4">
      <div class="font-semibold">Шаблон: NDA</div>
      <div class="text-sm leading-relaxed">
        Между <b>${doc.organization ?? '—'}</b> и <b>${doc.counterparty ?? '—'}</b> 
        заключается соглашение о неразглашении конфиденциальной информации.
        Стороны обязуются использовать получаемые сведения исключительно для целей сотрудничества
        и не раскрывать их третьим лицам без письменного согласия другой стороны.
        Рег. №: <b>${doc.regNumber ?? '—'}</b>. Ответственный: <b>${doc.responsible ?? '—'}</b>.
      </div>
    </div>`;

  const acTpl = `
    <div class="mb-2">
      <div class="font-semibold">Шаблон: Антикоррупционное соглашение</div>
      <div class="text-sm leading-relaxed">
        <b>${doc.organization ?? '—'}</b> и <b>${doc.counterparty ?? '—'}</b> 
        подтверждают приверженность требованиям антикоррупционного законодательства и политик комплаенса.
        Стороны обязуются воздерживаться от любых форм неправомерного вознаграждения,
        незамедлительно сообщать о конфликте интересов и сотрудничать в проверках.
        Рег. №: <b>${doc.regNumber ?? '—'}</b>. Ответственный: <b>${doc.responsible ?? '—'}</b>.
      </div>
    </div>`;

  let content = `<div class="mt-6 p-4 border rounded bg-gray-50">
    <div class="font-semibold mb-2">Автосгенерированные шаблоны</div>`;

  if (kinds.includes('NDA')) content += ndaTpl;
  if (kinds.includes('AntiCorruption')) content += acTpl;

  if (!kinds.length) content += ndaTpl;

  content += `</div>`;
  box.insertAdjacentHTML('beforeend', content);
  box.classList.remove('hidden');
}

// фильтры
if ($search) $search.addEventListener("input", () => renderList($search.value, $statusFilter?.value || ""));
if ($statusFilter) $statusFilter.addEventListener("change", () => renderList($search?.value || "", $statusFilter.value));

// Загрузка данных
async function loadDocuments() {
  try {
    const response = await fetch('data/sample-docs.json');
    DOCS = await response.json();
    renderList();
    console.log("Документы загружены:", DOCS.length);
  } catch (error) {
    console.error('Ошибка загрузки документов:', error);
    // Fallback к встроенным данным
    DOCS = [
      { id:"D-001", title:"Договор №123", type:"Договор аренды", status:"Действует",
        version:"1.0", date:"2025-09-01", author:"Иван Иванов",
        counterparty:"ООО Ромашка", projectNumber:"PRJ-2025-001",
        parentId:null, children:["D-001-1","D-001-A"] }
    ];
    renderList();
  }
}

// старт
loadDocuments();

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