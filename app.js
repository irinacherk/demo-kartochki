let DOCS = [];

const INHERITED = ["author","counterparty","projectNumber"];

let $list, $main, $search, $statusFilter;

// Инициализация DOM элементов
function initDOMElements() {
  $list = document.getElementById("doc-list");
  $main = document.querySelector("main");
  $search = document.getElementById("search");
  $statusFilter = document.getElementById("status-filter");
  
  if (!$list || !$main) {
    console.error('Критические DOM элементы не найдены!');
    return false;
  }
  return true;
}

let byId = {};

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
  if (!$list) {
    console.error('$list не инициализирован');
    return;
  }
  $list.innerHTML = "";
  DOCS.filter(d =>
    d.title.toLowerCase().includes(filter.toLowerCase()) &&
    (status === "" || d.status === status)
  ).forEach(d => {
    const li = document.createElement("li");
    li.className = "px-3 py-2 rounded hover:bg-gray-100 cursor-pointer flex justify-between items-center";
    const typeBadge = `<span class="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700 ml-2">${d.type}</span>`;
    li.innerHTML = `<div class="flex items-center"><span>${d.title}</span>${typeBadge}</div>${getStatusBadge(d.status)}`;
    li.onclick = () => openCard(d.id);
    $list.appendChild(li);
  });
}

function withInheritance(doc) {
  if (!doc) return { doc: null, parent: null, resolved: {} }; // защита на всякий случай

  // если у документа нет родителя — возвращаем его как есть
  const parentId = doc.relations?.parent || doc.parentId;
  if (!parentId) return { doc, parent: null, resolved: { ...doc } };

  // ищем родительский документ
  const parent = byId[parentId] || DOCS.find(d => d.id === parentId);
  if (!parent) return { doc, parent: null, resolved: { ...doc } }; // если родитель не найден — просто возвращаем исходный документ

  // создаём копию документа
  const resolved = { ...doc };

  // копируем поля из родителя, если они отсутствуют у текущего документа
  const inheritFields = [
    'organization',
    'counterparty',
    'budgetArticle',
    'costCenters',
    'cashFlowArticle',
    'paymentType',
    'author',
    'projectNumber'
  ];

  for (const field of inheritFields) {
    if (resolved[field] == null && parent[field] != null) {
      resolved[field] = parent[field];
    }
  }

  return { doc, parent, resolved };
}

function openCard(id) {
  if (!$main) {
    console.error('$main не инициализирован');
    return;
  }
  const doc = byId[id];
  if (!doc) {
    console.error('Документ не найден:', id);
    return;
  }
  
  try {
    // страховка от undefined
    normalizeRelations(doc);
    const result = withInheritance(doc);
    const { doc: normalizedDoc, parent, resolved } = result || { doc, parent: null, resolved: { ...doc } };

  // Скрываем сообщение "Выберите документ"
  const welcomeDiv = $main.querySelector('div:first-child');
  if (welcomeDiv) welcomeDiv.style.display = 'none';

  const childrenIds = normalizedDoc.children || normalizedDoc.relations?.children || [];
  const childrenHtml = childrenIds
    .map(cid => {
      const childDoc = byId[cid];
      return childDoc ? `<a href="#" data-child="${cid}" class="underline hover:no-underline">${childDoc.title}</a>` : '';
    })
    .filter(Boolean).join(", ") || "—";

  $main.innerHTML = `
    <div class="p-6 w-full text-left">
      <h2 class="text-xl font-bold mb-4">${resolved.title}</h2>
      <div class="grid grid-cols-2 gap-4">
        ${field("Тип", resolved.type)}
        ${field("Статус", resolved.status, true)}
        ${field("Версия", resolved.version)}
        ${field("Дата создания", resolved.date || resolved.createdAt)}
        ${field("Автор", resolved.author, false, normalizedDoc.author==null, parent)}
        ${field("Контрагент", resolved.counterparty, false, normalizedDoc.counterparty==null, parent)}
        ${field("Номер проекта", resolved.projectNumber, false, normalizedDoc.projectNumber==null, parent)}
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
  renderApplicationExtras(normalizedDoc);
  renderCostCentersTable(normalizedDoc);
  renderApplicationTemplate(normalizedDoc);
  renderAgreementExtras(normalizedDoc);
  renderAgreementTemplates(normalizedDoc);
  renderContractExtras(normalizedDoc);
  renderContractAmounts(normalizedDoc);
  renderInheritedCostCenters(normalizedDoc);
  renderContractTemplate(normalizedDoc);
  renderAttachmentExtras(normalizedDoc);
  renderAttachmentTemplate(normalizedDoc);
  renderInvoiceExtras(normalizedDoc);
  renderInvoiceValidation(normalizedDoc);
  renderClosingExtras(normalizedDoc);
  renderClosingValidation(normalizedDoc);
  renderClosingTemplate(normalizedDoc);

  // Построение диаграмм
  buildHierarchyMermaid(DOCS);
  buildInheritanceMermaid(normalizedDoc, parent);

  // обновляем футер печати
  const footerTitle = document.getElementById("print-doc-title");
  if (footerTitle) footerTitle.textContent = resolved.title || "Без названия";
  
  } catch (error) {
    console.error('Ошибка при открытии карточки:', error);
    $main.innerHTML = `
      <div class="p-6 w-full text-left">
        <h2 class="text-xl font-bold mb-4 text-red-600">Ошибка загрузки документа</h2>
        <p class="text-gray-600">Не удалось загрузить документ: ${id}</p>
        <p class="text-sm text-gray-500 mt-2">Ошибка: ${error.message}</p>
      </div>
    `;
  }
}

function field(label, value, badge=false, inherited=false, parent=null) {
  const lock = inherited ? `<span class="ml-2 text-xs px-2 py-0.5 rounded bg-gray-100" title="Наследуется из ${parent?.title || ''} (${parent?.id || ''})">🔒</span>` : "";
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

  const totalAmount = doc.totalAmount || 0;
  const isValid = total === totalAmount;
  const statusColor = isValid ? 'text-green-600' : 'text-red-600';
  const statusIcon = isValid ? '✅' : '❌';
  const statusText = isValid ? 'Суммы совпадают' : 'Суммы не совпадают';

  host.innerHTML = `
    <div class="mt-6">
      <div class="text-sm text-gray-500 mb-2">Кост-центр (табличный справочник)</div>
      <table class="w-full border rounded overflow-hidden">
        <thead>
          <tr class="bg-gray-50">
            <th class="text-left p-2 border-b">Центр затрат</th>
            <th class="text-right p-2 border-b">Сумма, ${doc.currency || 'RUB'}</th>
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
            <td class="p-2 font-semibold text-right">Итого по кост-центрам:</td>
            <td class="p-2 font-semibold text-right">${fmt(total)} ${doc.currency || 'RUB'}</td>
          </tr>
          <tr>
            <td class="p-2 font-semibold text-right">Общая сумма заявки:</td>
            <td class="p-2 font-semibold text-right">${fmt(totalAmount)} ${doc.currency || 'RUB'}</td>
          </tr>
        </tbody>
      </table>
      <div class="mt-3 p-2 rounded ${isValid ? 'bg-green-50' : 'bg-red-50'}">
        <span class="${statusColor} font-semibold">${statusIcon} ${statusText}</span>
      </div>
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
    .map(r => `— ${r.cc}: ${fmt(r.amount || 0)} ${doc.currency || 'RUB'}`).join('<br>');

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
        <b>Итого: ${fmt(total)} ${doc.currency || 'RUB'}</b>
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

// Рендеринг дополнительных полей для Contract
function renderContractExtras(doc) {
  const wrap = document.getElementById('app-extra');
  if (!wrap) return;
  if (doc.type !== 'Contract') return;

  const parent = getParentDoc(doc);
  const resolved = { ...doc };
  
  // Наследуем поля от родителя Application
  if (parent) {
    if (!resolved.organization) resolved.organization = parent.organization;
    if (!resolved.counterparty) resolved.counterparty = parent.counterparty;
    if (!resolved.budgetArticle) resolved.budgetArticle = parent.budgetArticle;
    if (!resolved.projectNumber) resolved.projectNumber = parent.projectNumber;
  }

  const block = `
    <div class="grid grid-cols-2 gap-6 mt-6">
      <div>
        <div class="text-sm text-gray-500">Организация ${doc.organization ? '' : '🔒'}</div>
        <div class="font-medium">${resolved.organization ?? '—'}</div>
      </div>
      <div>
        <div class="text-sm text-gray-500">Контрагент ${doc.counterparty ? '' : '🔒'}</div>
        <div class="font-medium">${resolved.counterparty ?? '—'}</div>
      </div>

      <div>
        <div class="text-sm text-gray-500">Статус контрагента</div>
        <div class="font-medium">${doc.counterpartyStatus ?? '—'}</div>
      </div>
      <div>
        <div class="text-sm text-gray-500">ДДС статья</div>
        <div class="font-medium">${doc.cashFlowArticle ?? '—'}</div>
      </div>

      <div>
        <div class="text-sm text-gray-500">Тип оплаты</div>
        <div class="font-medium">${doc.paymentType ?? '—'}</div>
      </div>
      <div>
        <div class="text-sm text-gray-500">Срок оплаты</div>
        <div class="font-medium">${doc.paymentTerm ?? '—'}</div>
      </div>

      <div>
        <div class="text-sm text-gray-500">Кто подписывает первым</div>
        <div class="font-medium">${doc.firstSigner ?? '—'}</div>
      </div>
      <div>
        <div class="text-sm text-gray-500">Дата подписания</div>
        <div class="font-medium">${doc.signingDate || (doc.status === 'Подписан' ? new Date().toLocaleDateString('ru-RU') : '—')}</div>
      </div>

      <div class="col-span-2">
        <div class="text-sm text-gray-500">Тип договора</div>
        <div class="font-medium">
          ${doc.contractKind === 'offer' 
            ? '<span class="px-2 py-1 rounded-full bg-orange-100 text-orange-700 text-sm">Договор-оферта</span>'
            : '<span class="px-2 py-1 rounded-full bg-blue-100 text-blue-700 text-sm">Договор</span>'
          }
        </div>
      </div>

      <div>
        <div class="text-sm text-gray-500">Статья бюджета ${doc.budgetArticle ? '' : '🔒'}</div>
        <div class="font-medium">${resolved.budgetArticle ?? '—'}</div>
      </div>
      <div>
        <div class="text-sm text-gray-500">Номер проекта ${doc.projectNumber ? '' : '🔒'}</div>
        <div class="font-medium">${resolved.projectNumber ?? '—'}</div>
      </div>
    </div>
  `;

  wrap.insertAdjacentHTML('beforeend', block);
  wrap.classList.remove('hidden');
}

// Рендеринг сумм договора
function renderContractAmounts(doc) {
  const host = document.getElementById('cost-centers');
  if (!host) return;
  if (doc.type !== 'Contract') return;

  host.classList.remove('hidden');
  const paymentType = doc.paymentType || 'prepay';
  
  let amountsHtml = '';
  
  if (paymentType === 'partial') {
    amountsHtml = `
      <div class="grid grid-cols-2 gap-4">
        <div>
          <div class="text-sm text-gray-500">Предоплата</div>
          <div class="font-medium text-lg">${fmt(doc.prepay?.amountTotal || 0)} ${doc.prepay?.currency || 'RUB'}</div>
        </div>
        <div>
          <div class="text-sm text-gray-500">Постоплата</div>
          <div class="font-medium text-lg">${fmt(doc.postpay?.amountTotal || 0)} ${doc.postpay?.currency || 'RUB'}</div>
        </div>
      </div>
    `;
  } else if (paymentType === 'prepay') {
    amountsHtml = `
      <div>
        <div class="text-sm text-gray-500">Предоплата</div>
        <div class="font-medium text-lg">${fmt(doc.prepay?.amountTotal || 0)} ${doc.prepay?.currency || 'RUB'}</div>
      </div>
    `;
  } else if (paymentType === 'postpay') {
    amountsHtml = `
      <div>
        <div class="text-sm text-gray-500">Постоплата</div>
        <div class="font-medium text-lg">${fmt(doc.postpay?.amountTotal || 0)} ${doc.postpay?.currency || 'RUB'}</div>
      </div>
    `;
  }

  const total = (doc.prepay?.amountTotal || 0) + (doc.postpay?.amountTotal || 0);

  host.innerHTML = `
    <div class="mt-6">
      <div class="text-sm text-gray-500 mb-2">Суммы договора</div>
      ${amountsHtml}
      <div class="mt-4 p-3 bg-gray-50 rounded">
        <div class="text-sm text-gray-500">Итого по договору</div>
        <div class="font-bold text-xl">${fmt(total)} ${doc.prepay?.currency || doc.postpay?.currency || 'RUB'}</div>
      </div>
    </div>
  `;
}

// Рендеринг наследуемых кост-центров с проверкой суммы
function renderInheritedCostCenters(doc) {
  const box = document.getElementById('auto-template');
  if (!box) return;
  if (doc.type !== 'Contract') return;

  const parent = getParentDoc(doc);
  if (!parent) return;

  const contractTotal = (doc.prepay?.amountTotal || 0) + (doc.postpay?.amountTotal || 0);
  const parentTotal = parent.totalAmount || 0;
  const isValid = contractTotal >= parentTotal;
  
  const statusColor = isValid ? 'text-green-600' : 'text-red-600';
  const statusIcon = isValid ? '✅' : '❌';
  const statusText = isValid ? 'Сумма договора соответствует заявке' : 'Сумма договора меньше суммы заявки';

  const costCentersHtml = (doc.costCenters || [])
    .map(r => `— ${r.cc}: ${fmt(r.amount || 0)} ${doc.prepay?.currency || doc.postpay?.currency || 'RUB'}`).join('<br>');

  const template = `
    <div class="mt-6 p-4 border rounded bg-gray-50">
      <div class="font-semibold mb-2">Проверка суммы и кост-центры</div>
      <div class="text-sm leading-relaxed">
        <div class="mb-3 p-2 rounded ${isValid ? 'bg-green-50' : 'bg-red-50'}">
          <span class="${statusColor} font-semibold">${statusIcon} ${statusText}</span><br>
          <small>Договор: ${fmt(contractTotal)} ${doc.prepay?.currency || doc.postpay?.currency || 'RUB'} | Заявка: ${fmt(parentTotal)} ${parent.currency || 'RUB'}</small>
        </div>
        
        <div class="mb-2">
          <strong>Наследуемые кост-центры:</strong><br>
          ${costCentersHtml || '—'}
        </div>
      </div>
    </div>
  `;

  box.insertAdjacentHTML('beforeend', template);
  box.classList.remove('hidden');
}

// Рендеринг автошаблона для Contract
function renderContractTemplate(doc) {
  const box = document.getElementById('auto-template');
  if (!box) return;
  if (doc.type !== 'Contract') return;

  const parent = getParentDoc(doc);
  const amounts = doc.amounts || {};
  const total = (amounts.prepay || 0) + (amounts.postpay || 0);
  
  let paymentText = '';
  if (doc.paymentType === 'partial') {
    paymentText = `Предоплата: ${fmt(amounts.prepay || 0)} ₽, постоплата: ${fmt(amounts.postpay || 0)} ₽`;
  } else if (doc.paymentType === 'prepay') {
    paymentText = `Предоплата: ${fmt(amounts.prepay || 0)} ₽`;
  } else if (doc.paymentType === 'postpay') {
    paymentText = `Постоплата: ${fmt(amounts.postpay || 0)} ₽`;
  }

  const template = `
    <div class="mt-6 p-4 border rounded bg-gray-50">
      <div class="font-semibold mb-2">Автосгенерированный шаблон договора</div>
      <div class="text-sm leading-relaxed">
        <strong>Договор поставки</strong><br>
        Организация: <b>${parent?.organization ?? '—'}</b><br>
        Контрагент: <b>${parent?.counterparty ?? '—'}</b><br>
        Рег. номер: <b>${doc.regNumber ?? '—'}</b><br>
        Статья бюджета: <b>${parent?.budgetArticle ?? '—'}</b><br>
        ДДС статья: <b>${doc.cashFlowArticle ?? '—'}</b><br>
        <br>
        <strong>Условия оплаты:</strong><br>
        Тип: <b>${doc.paymentType ?? '—'}</b><br>
        ${paymentText}<br>
        Срок оплаты: <b>${doc.paymentTerm ?? '—'}</b><br>
        <br>
        <strong>Подписание:</strong><br>
        Кто подписывает первым: <b>${doc.firstSigner ?? '—'}</b><br>
        Дата подписания: <b>${doc.signingDate || (doc.status === 'Подписан' ? new Date().toLocaleDateString('ru-RU') : '—')}</b><br>
        <br>
        <strong>Итого по договору: ${fmt(total)} ${doc.prepay?.currency || doc.postpay?.currency || 'RUB'}</strong>
      </div>
    </div>
  `;

  box.insertAdjacentHTML('beforeend', template);
  box.classList.remove('hidden');
}

// Рендеринг дополнительных полей для Attachment
function renderAttachmentExtras(doc) {
  const wrap = document.getElementById('app-extra');
  if (!wrap) return;
  if (doc.type !== 'Attachment') return;

  const parent = getParentDoc(doc);
  const resolved = { ...doc };
  
  // Наследуем поля от родителя Contract
  if (parent) {
    if (!resolved.organization) resolved.organization = parent.organization;
    if (!resolved.counterparty) resolved.counterparty = parent.counterparty;
    if (!resolved.budgetArticle) resolved.budgetArticle = parent.budgetArticle;
  }

  const block = `
    <div class="grid grid-cols-2 gap-6 mt-6">
      <div>
        <div class="text-sm text-gray-500">Организация ${doc.organization ? '' : '🔒'}</div>
        <div class="font-medium">${resolved.organization ?? '—'}</div>
      </div>
      <div>
        <div class="text-sm text-gray-500">Контрагент ${doc.counterparty ? '' : '🔒'}</div>
        <div class="font-medium">${resolved.counterparty ?? '—'}</div>
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

      <div class="col-span-2">
        <div class="text-sm text-gray-500">Содержание</div>
        <div class="font-medium">${doc.content ?? '—'}</div>
      </div>

      <div>
        <div class="text-sm text-gray-500">Сумма</div>
        <div class="font-medium">${doc.amount?.amountTotal ? fmt(doc.amount.amountTotal) + ' ' + (doc.amount.currency || 'RUB') : '—'}</div>
      </div>
    </div>
  `;

  wrap.insertAdjacentHTML('beforeend', block);
  wrap.classList.remove('hidden');

  // Проверка запрета подчинения к договору-оферте
  if (parent && parent.type === 'Contract' && parent.contractKind === 'offer') {
    const warningBlock = `
      <div class="mt-4 p-3 bg-red-50 border border-red-200 rounded">
        <div class="flex items-center">
          <span class="text-red-600 text-lg mr-2">⚠️</span>
          <div>
            <div class="font-semibold text-red-800">Подчинение к договору-оферте запрещено</div>
            <div class="text-sm text-red-600">По правилам системы, к договору-оферте нельзя прикреплять приложения</div>
          </div>
        </div>
      </div>
    `;
    wrap.insertAdjacentHTML('beforeend', warningBlock);
  }
}

// Рендеринг автошаблона для Attachment
function renderAttachmentTemplate(doc) {
  const box = document.getElementById('auto-template');
  if (!box) return;
  if (doc.type !== 'Attachment') return;

  const parent = getParentDoc(doc);

  const template = `
    <div class="mt-6 p-4 border rounded bg-gray-50">
      <div class="font-semibold mb-2">Автосгенерированный шаблон приложения</div>
      <div class="text-sm leading-relaxed">
        <strong>Приложение к договору ${parent?.regNumber ?? '—'}</strong><br>
        Рег. номер приложения: <b>${doc.regNumber ?? '—'}</b><br>
        Автор: <b>${doc.author ?? '—'}</b><br>
        Ответственный: <b>${doc.responsible ?? '—'}</b>, подразделение: <b>${doc.responsibleDept ?? '—'}</b><br>
        <br>
        <strong>Содержание:</strong><br>
        ${doc.content ?? '—'}
      </div>
    </div>
  `;

  box.insertAdjacentHTML('beforeend', template);
  box.classList.remove('hidden');
}

// Рендеринг дополнительных полей для Invoice
function renderInvoiceExtras(doc) {
  const wrap = document.getElementById('app-extra');
  if (!wrap) return;
  if (doc.type !== 'Invoice') return;

  const parent = getParentDoc(doc);
  const resolved = { ...doc };
  
  // Наследуем поля от родителя
  if (parent) {
    if (!resolved.organization) resolved.organization = parent.organization;
    if (!resolved.counterparty) resolved.counterparty = parent.counterparty;
  }

  const block = `
    <div class="grid grid-cols-2 gap-6 mt-6">
      <div>
        <div class="text-sm text-gray-500">Организация ${doc.organization ? '' : '🔒'}</div>
        <div class="font-medium">${resolved.organization ?? '—'}</div>
      </div>
      <div>
        <div class="text-sm text-gray-500">Контрагент ${doc.counterparty ? '' : '🔒'}</div>
        <div class="font-medium">${resolved.counterparty ?? '—'}</div>
      </div>

      <div>
        <div class="text-sm text-gray-500">Регистрационный номер</div>
        <div class="font-medium">${doc.regNumber ?? '—'}</div>
      </div>

      <div>
        <div class="text-sm text-gray-500">Тип счёта</div>
        <div class="font-medium">${doc.invoiceKind ?? '—'}</div>
      </div>

      <div>
        <div class="text-sm text-gray-500">Сумма без НДС</div>
        <div class="font-medium">${fmt(doc.sumNoVAT || 0)} ${doc.currency || 'RUB'}</div>
      </div>

      <div>
        <div class="text-sm text-gray-500">Сумма с НДС</div>
        <div class="font-medium">${fmt(doc.sumTotal || 0)} ${doc.currency || 'RUB'}</div>
      </div>

      <div>
        <div class="text-sm text-gray-500">Срок оплаты</div>
        <div class="font-medium">${doc.paymentDue ?? '—'}</div>
      </div>

      <div>
        <div class="text-sm text-gray-500">Основание</div>
        <div class="font-medium">${doc.base ?? '—'}</div>
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
    </div>
  `;

  wrap.insertAdjacentHTML('beforeend', block);
  wrap.classList.remove('hidden');
}

// Рендеринг проверки суммы для Invoice
function renderInvoiceValidation(doc) {
  const box = document.getElementById('auto-template');
  if (!box) return;
  if (doc.type !== 'Invoice') return;

  const parent = getParentDoc(doc);
  if (!parent) return;

  let isValid = true;
  let validationText = '';
  let statusColor = 'text-green-600';
  let statusIcon = '✅';

  if (parent.type === 'Contract') {
    const invoiceSum = doc.amount?.amountTotal || 0;
  const prepayAmount = parent.prepay?.amountTotal || 0;
  const postpayAmount = parent.postpay?.amountTotal || 0;
  const totalContractSum = prepayAmount + postpayAmount;
    
    // Проверка на спорный случай
    if (parent.paymentType === 'partial' && invoiceSum === totalContractSum) {
      isValid = false; // спорный случай
      statusColor = 'text-amber-600';
      statusIcon = '⚠️';
      validationText = 'Спорный случай: счёт на 100% при частичной оплате';
    } else {
      // Обычные проверки
      if (doc.paymentType === 'prepay') {
        const prepayLimit = prepayAmount;
        isValid = invoiceSum <= prepayLimit;
        validationText = `Предоплата: ${fmt(invoiceSum)} ≤ ${fmt(prepayLimit)}`;
      } else if (doc.paymentType === 'postpay') {
        const postpayLimit = postpayAmount;
        isValid = invoiceSum <= postpayLimit;
        validationText = `Постоплата: ${fmt(invoiceSum)} ≤ ${fmt(postpayLimit)}`;
      } else if (doc.paymentType === 'transfer') {
        isValid = true;
        validationText = 'Трансфер: проверка не требуется';
      }
    }
  }

  if (!isValid && statusColor !== 'text-amber-600') {
    statusColor = 'text-red-600';
    statusIcon = '❌';
  }

  const template = `
    <div class="mt-6 p-4 border rounded bg-gray-50">
      <div class="font-semibold mb-2">Проверка суммы счёта</div>
      <div class="text-sm leading-relaxed">
        <div class="mb-3 p-2 rounded ${statusColor === 'text-amber-600' ? 'bg-amber-50' : (isValid ? 'bg-green-50' : 'bg-red-50')}">
          <span class="${statusColor} font-semibold">${statusIcon} ${validationText}</span>
          ${statusColor === 'text-amber-600' ? '<br><small class="text-amber-700">Счёт выставлен на 100% при частичной оплате договора — требует уточнения правил (разделение на предоплату/постоплату?)</small>' : ''}
        </div>
        
        <div class="mb-2">
          <strong>Детали счёта:</strong><br>
          Сумма без НДС: <b>${fmt(doc.amount?.amountNoVat || 0)} ${doc.amount?.currency || 'RUB'}</b><br>
          Сумма с НДС: <b>${fmt(doc.amount?.amountTotal || 0)} ${doc.amount?.currency || 'RUB'}</b><br>
          Срок оплаты: <b>${doc.plannedPaymentDate ?? '—'}</b><br>
          Статус проверки: <b>${statusColor === 'text-amber-600' ? 'Спорный случай' : (isValid ? 'ОК' : 'Ошибка')}</b>
        </div>
      </div>
    </div>
  `;

  box.insertAdjacentHTML('beforeend', template);
  box.classList.remove('hidden');
}

// Рендеринг дополнительных полей для Closing
function renderClosingExtras(doc) {
  const wrap = document.getElementById('app-extra');
  if (!wrap) return;
  if (doc.type !== 'Closing') return;

  const parent = getParentDoc(doc);
  const resolved = { ...doc };
  
  // Наследуем поля от родителя
  if (parent) {
    if (!resolved.organization) resolved.organization = parent.organization;
    if (!resolved.counterparty) resolved.counterparty = parent.counterparty;
    if (!resolved.budgetArticle) resolved.budgetArticle = parent.budgetArticle;
    if (!resolved.cashFlowArticle) resolved.cashFlowArticle = parent.cashFlowArticle;
  }

  const block = `
    <div class="grid grid-cols-2 gap-6 mt-6">
      <div>
        <div class="text-sm text-gray-500">Организация ${doc.organization ? '' : '🔒'}</div>
        <div class="font-medium">${resolved.organization ?? '—'}</div>
      </div>
      <div>
        <div class="text-sm text-gray-500">Контрагент ${doc.counterparty ? '' : '🔒'}</div>
        <div class="font-medium">${resolved.counterparty ?? '—'}</div>
      </div>

      <div>
        <div class="text-sm text-gray-500">Статус контрагента</div>
        <div class="font-medium">${doc.counterpartyStatus ?? '—'}</div>
      </div>
      <div>
        <div class="text-sm text-gray-500">Статья бюджета ${doc.budgetArticle ? '' : '🔒'}</div>
        <div class="font-medium">${resolved.budgetArticle ?? '—'}</div>
      </div>

      <div>
        <div class="text-sm text-gray-500">Статья ДДС ${doc.cashFlowArticle ? '' : '🔒'}</div>
        <div class="font-medium">${resolved.cashFlowArticle ?? '—'}</div>
      </div>
      <div>
        <div class="text-sm text-gray-500">Оплата</div>
        <div class="font-medium">${doc.paymentMode ?? '—'}</div>
      </div>

      <div>
        <div class="text-sm text-gray-500">Сумма без НДС</div>
        <div class="font-medium">${fmt(doc.sumNoVAT || 0)} ${doc.currency || 'RUB'}</div>
      </div>
      <div>
        <div class="text-sm text-gray-500">Сумма с НДС</div>
        <div class="font-medium">${fmt(doc.sumTotal || 0)} ${doc.currency || 'RUB'}</div>
      </div>

      <div>
        <div class="text-sm text-gray-500">Регистрационный номер</div>
        <div class="font-medium">${doc.regNumber ?? '—'}</div>
      </div>
      <div>
        <div class="text-sm text-gray-500">Дата планируемого платежа</div>
        <div class="font-medium">${doc.plannedPaymentDate || '—'}</div>
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

      <div class="col-span-2">
        <div class="text-sm text-gray-500">Содержание</div>
        <div class="font-medium">${doc.content ?? '—'}</div>
      </div>
    </div>
  `;

  wrap.insertAdjacentHTML('beforeend', block);
  wrap.classList.remove('hidden');
}

// Рендеринг проверки суммы для Closing
function renderClosingValidation(doc) {
  const box = document.getElementById('auto-template');
  if (!box) return;
  if (doc.type !== 'Closing') return;

  const parent = getParentDoc(doc);
  if (!parent) return;

  let limit = 0;
  let hasLimit = false;
  let limitSource = '';

  if (parent.type === 'Contract') {
    const amounts = parent.amounts || {};
    if (parent.paymentType === 'postpay') {
      limit = amounts.postpay || 0;
      hasLimit = true;
      limitSource = 'постоплата договора';
    } else if (parent.paymentType === 'partial') {
      limit = amounts.postpay || 0;
      hasLimit = true;
      limitSource = 'постоплата договора (частичная оплата)';
    }
  } else if (parent.type === 'Attachment' || parent.type === 'Invoice') {
    limit = parent.sumTotal || 0;
    hasLimit = limit > 0;
    limitSource = `сумма ${parent.type.toLowerCase()}`;
  }

    const closingSum = doc.amount?.amountTotal || 0;
  let isValid = true;
  let statusColor = 'text-gray-600';
  let statusIcon = 'ℹ️';
  let statusText = '';

  if (hasLimit) {
    isValid = closingSum >= limit;
    statusColor = isValid ? 'text-green-600' : 'text-red-600';
    statusIcon = isValid ? '✅' : '❌';
    statusText = isValid ? 'Сумма соответствует лимиту' : 'Сумма меньше лимита';
  } else {
    statusText = 'Лимит у родителя отсутствует';
  }

  const template = `
    <div class="mt-6 p-4 border rounded bg-gray-50">
      <div class="font-semibold mb-2">Проверка суммы закрывающего документа</div>
      <div class="text-sm leading-relaxed">
        <div class="mb-3 p-2 rounded ${hasLimit ? (isValid ? 'bg-green-50' : 'bg-red-50') : 'bg-gray-50'}">
          <span class="${statusColor} font-semibold">${statusIcon} ${statusText}</span><br>
          ${hasLimit ? `<small>Закрытие: ${fmt(closingSum)} ₽ | Лимит (${limitSource}): ${fmt(limit)} ₽</small>` : '<small>Нет лимита у родителя</small>'}
        </div>
        
        <div class="mb-2">
          <strong>Детали закрытия:</strong><br>
          Сумма без НДС: <b>${fmt(doc.amount?.amountNoVat || 0)} ${doc.amount?.currency || 'RUB'}</b><br>
          Сумма с НДС: <b>${fmt(doc.amount?.amountTotal || 0)} ${doc.amount?.currency || 'RUB'}</b><br>
          Оплата: <b>${doc.paymentMode ?? '—'}</b><br>
          ${doc.plannedPaymentDate ? `Дата платежа: <b>${doc.plannedPaymentDate}</b><br>` : ''}
        </div>
      </div>
    </div>
  `;

  box.insertAdjacentHTML('beforeend', template);
  box.classList.remove('hidden');
}

// Рендеринг автошаблона для Closing
function renderClosingTemplate(doc) {
  const box = document.getElementById('auto-template');
  if (!box) return;
  if (doc.type !== 'Closing') return;

  const parent = getParentDoc(doc);

  const template = `
    <div class="mt-6 p-4 border rounded bg-gray-50">
      <div class="font-semibold mb-2">Автосгенерированный шаблон закрывающего документа</div>
      <div class="text-sm leading-relaxed">
        <strong>Акт закрытия</strong><br>
        Организация: <b>${parent?.organization ?? '—'}</b><br>
        Контрагент: <b>${parent?.counterparty ?? '—'}</b><br>
        Основание: <b>${parent?.regNumber ?? parent?.id ?? '—'} (${parent?.title ?? '—'})</b><br>
        Рег. номер акта: <b>${doc.regNumber ?? '—'}</b><br>
        <br>
        <strong>Финансовые условия:</strong><br>
        Сумма: <b>${fmt(doc.sumTotal || 0)} ${doc.currency || 'RUB'}</b><br>
        Оплата: <b>${doc.paymentMode ?? '—'}</b><br>
        ${doc.plannedPaymentDate ? `Дата планируемого платежа: <b>${doc.plannedPaymentDate}</b><br>` : ''}
        <br>
        <strong>Содержание:</strong><br>
        ${doc.content ?? '—'}
      </div>
    </div>
  `;

  box.insertAdjacentHTML('beforeend', template);
  box.classList.remove('hidden');
}

// Построение диаграммы подчинённости
function buildHierarchyMermaid(docs) {
  const hierarchy = document.getElementById('mermaid-hierarchy');
  if (!hierarchy) return;

  hierarchy.classList.remove('hidden');
  
  let mermaidCode = 'graph TD\n';
  
  docs.forEach(doc => {
    const children = doc.children || doc.relations?.children || [];
    children.forEach(childId => {
      const child = byId[childId];
      if (child) {
        // Проверка на запрещенную связь
        if (doc.type === 'Contract' && doc.contractKind === 'offer' && child.type === 'Attachment') {
          mermaidCode += `  ${doc.id}["${doc.type}: ${doc.id}"] -.->|запрещено| ${child.id}["${child.type}: ${child.id}"]\n`;
        } else {
          mermaidCode += `  ${doc.id}["${doc.type}: ${doc.id}"] --> ${child.id}["${child.type}: ${child.id}"]\n`;
        }
      }
    });
  });

  hierarchy.innerHTML = `
    <div class="mb-4">
      <h3 class="font-semibold mb-2">Схема подчинённости документов</h3>
      <div class="mermaid">${mermaidCode}</div>
    </div>
  `;

  // Инициализируем Mermaid
  if (typeof mermaid !== 'undefined') {
    mermaid.init();
  }
}

// Построение диаграммы наследования
function buildInheritanceMermaid(doc, parent) {
  const inheritance = document.getElementById('mermaid-inheritance');
  if (!inheritance) return;
  if (!parent) {
    inheritance.classList.add('hidden');
    return;
  }

  inheritance.classList.remove('hidden');
  
  let mermaidCode = 'graph LR\n';
  const inheritedFields = [];
  
  if (doc.organization === null && parent.organization) inheritedFields.push('Организация');
  if (doc.counterparty === null && parent.counterparty) inheritedFields.push('Контрагент');
  if (doc.budgetArticle === null && parent.budgetArticle) inheritedFields.push('Статья бюджета');
  if (doc.cashFlowArticle === null && parent.cashFlowArticle) inheritedFields.push('Статья ДДС');
  
  inheritedFields.forEach(field => {
    mermaidCode += `  Parent["${parent.type} ${parent.id}"] -- ${field} --> Child["${doc.type} ${doc.id}"]\n`;
  });

  if (inheritedFields.length === 0) {
    inheritance.innerHTML = `
      <div class="mb-4">
        <h3 class="font-semibold mb-2">Наследование полей</h3>
        <p class="text-gray-600">Нет наследуемых полей</p>
      </div>
    `;
    return;
  }

  inheritance.innerHTML = `
    <div class="mb-4">
      <h3 class="font-semibold mb-2">Схема наследования полей</h3>
      <div class="mermaid">${mermaidCode}</div>
    </div>
  `;

  // Инициализируем Mermaid
  if (typeof mermaid !== 'undefined') {
    mermaid.init();
  }
}

// фильтры
if ($search) $search.addEventListener("input", () => renderList($search.value, $statusFilter?.value || ""));
if ($statusFilter) $statusFilter.addEventListener("change", () => renderList($search?.value || "", $statusFilter.value));

// Нормализация старых полей к единому виду
function normalizeRelations(doc) {
  if (!doc.relations) doc.relations = { parent: "", children: [] };
  // если вдруг лежали старые поля
  if (doc.parentId && !doc.relations.parent) doc.relations.parent = doc.parentId;
  if (!Array.isArray(doc.relations.children)) doc.relations.children = [];
  // Удаляем старые поля
  delete doc.parentId;
  delete doc.children;
  return doc;
}

// Безопасное получение родителя
function getParentId(doc) {
  return doc?.relations?.parent || "";
}

function getParentDoc(doc) {
  const pid = getParentId(doc);
  return pid ? byId[pid] : null;
}

// Загрузка данных
async function loadDocuments() {
  try {
    console.log("Начинаем загрузку документов...");
    const response = await fetch('data/sample-docs.json');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    DOCS = await response.json();
    console.log("JSON загружен, документов:", DOCS.length);
    
    // Нормализуем все документы
    DOCS = DOCS.map(normalizeRelations);
    // Обновляем byId
    byId = Object.fromEntries(DOCS.map(d => [d.id, d]));
    renderList();
    console.log("Документы загружены и отрендерены:", DOCS.length);
  } catch (error) {
    console.error('Ошибка загрузки документов:', error);
    // Fallback к встроенным данным
    DOCS = [
      { id:"D-001", title:"Договор №123", type:"Договор аренды", status:"Действует",
        version:"1.0", date:"2025-09-01", author:"Иван Иванов",
        counterparty:"ООО Ромашка", projectNumber:"PRJ-2025-001",
        relations: { parent: "", children: ["D-001-1", "D-001-A"] }
      },
      { id:"D-001-1", title:"Доп. соглашение №1", type:"Доп. соглашение", status:"В работе",
        version:"1.0", date:"2025-09-02", author:null, counterparty:null, projectNumber:null,
        relations: { parent: "D-001", children: [] }
      }
    ];
    // Нормализуем fallback данные
    DOCS = DOCS.map(normalizeRelations);
    // Обновляем byId
    byId = Object.fromEntries(DOCS.map(d => [d.id, d]));
    renderList();
    console.log("Fallback данные загружены:", DOCS.length);
  }
}

// старт
document.addEventListener('DOMContentLoaded', () => {
  if (initDOMElements()) {
    loadDocuments();
  }
});

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
    id: 'application',
    text: 'Заявка на закупку: показывает кост-центры и автошаблон.',
    target: () => document.getElementById('doc-list'),
    onNext: () => openCard('APP-1001')
  },
  {
    id: 'contract',
    text: 'Договор: наследует поля от заявки, проверяет сумму (✅ 2,000,000 ≥ 2,000,000).',
    target: () => document.getElementById('doc-list'),
    onNext: () => openCard('CTR-5001')
  },
  {
    id: 'attachment',
    text: 'Приложение к договору: наследует организацию и контрагента, показывает содержание.',
    target: () => document.getElementById('doc-list'),
    onNext: () => openCard('ATT-9001')
  },
  {
    id: 'invoice',
    text: 'Счёт на предоплату: проверяет сумму (✅ 600,000 ≤ 600,000 предоплаты).',
    target: () => document.getElementById('doc-list'),
    onNext: () => openCard('INV-3001')
  },
  {
    id: 'closing1',
    text: 'Закрывающий документ: наследует поля от договора, проверяет лимит постоплаты.',
    target: () => document.getElementById('doc-list'),
    onNext: () => openCard('CLS-4001')
  },
  {
    id: 'closing2',
    text: 'Акт по трансферу: показывает случай "лимит отсутствует" (серый индикатор).',
    target: () => document.getElementById('doc-list'),
    onNext: () => openCard('CLS-4002')
  },
  {
    id: 'offer',
    text: 'Договор-оферта: обратите внимание на оранжевый бейдж "Договор-оферта".',
    target: () => document.getElementById('doc-list'),
    onNext: () => openCard('CTR-8001')
  },
  {
    id: 'forbidden',
    text: 'Приложение к оферте: красный баннер "Подчинение к договору-оферте запрещено".',
    target: () => document.getElementById('doc-list'),
    onNext: () => openCard('ATT-8001')
  },
  {
    id: 'disputed',
    text: 'Спорный случай: счёт на полную сумму при частичной оплате (янтарный индикатор).',
    target: () => document.getElementById('doc-list'),
    onNext: () => openCard('INV-7002')
  },
  {
    id: 'diagram',
    text: 'Диаграмма подчинённости: пунктирная красная связь показывает запрещенное подчинение.',
    target: () => document.getElementById('mermaid-hierarchy')
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