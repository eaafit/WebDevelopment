// ------------------------------
// DEMO DATA (замените на API)
// ------------------------------
const notaries = [
  {
    city: "Москва",
    list: [
      { fio: "Иванова Мария Петровна", officeNo: "12", officeAddr: "г. Москва, ул. Тверская, д. 7" },
      { fio: "Сидоров Алексей Николаевич", officeNo: "31", officeAddr: "г. Москва, пр-т Мира, д. 19" },
      { fio: "Орлова Наталья Викторовна", officeNo: "18", officeAddr: "г. Москва, ул. Арбат, д. 15" },
      { fio: "Мельников Дмитрий Сергеевич", officeNo: "27", officeAddr: "г. Москва, Ленинский пр-т, д. 45" }
    ]
  },
  {
    city: "Санкт-Петербург",
    list: [
      { fio: "Петрова Анна Сергеевна", officeNo: "5", officeAddr: "г. Санкт-Петербург, Невский пр-т, д. 25" },
      { fio: "Кузнецов Илья Олегович", officeNo: "44", officeAddr: "г. Санкт-Петербург, ул. Марата, д. 10" },
      { fio: "Смирнова Ольга Андреевна", officeNo: "22", officeAddr: "г. Санкт-Петербург, Лиговский пр-т, д. 78" }
    ]
  },
  {
    city: "Казань",
    list: [
      { fio: "Галимова Эльвира Ринатовна", officeNo: "9", officeAddr: "г. Казань, ул. Баумана, д. 3" },
      { fio: "Фаттахов Рустам Ильдарович", officeNo: "14", officeAddr: "г. Казань, пр-т Ямашева, д. 22" }
    ]
  },
  {
    city: "Екатеринбург",
    list: [
      { fio: "Новикова Татьяна Игоревна", officeNo: "6", officeAddr: "г. Екатеринбург, ул. Малышева, д. 12" },
      { fio: "Белов Андрей Константинович", officeNo: "17", officeAddr: "г. Екатеринбург, ул. 8 Марта, д. 51" }
    ]
  }
];

const companies = [
  { name: 'ООО "Городская Оценка"', addr: "г. Москва, ул. Примерная, д. 1" },
  { name: 'ООО "Эксперт-Оценка"', addr: "г. Санкт-Петербург, ул. Литейная, д. 20" },
  { name: 'АО "Независимая Оценка"', addr: "г. Казань, ул. Кремлевская, д. 8" },
  { name: 'ООО "Федеральная Оценочная Компания"', addr: "г. Екатеринбург, ул. Ленина, д. 40" },
  { name: 'ООО "Профессиональная Оценка"', addr: "г. Новосибирск, Красный пр-т, д. 55" },
  { name: 'ООО "РегионЭксперт"', addr: "г. Нижний Новгород, ул. Большая Покровская, д. 19" }
];

// ------------------------------
// HELPERS
// ------------------------------
const $ = (id) => document.getElementById(id);

function pad(n){ return String(n).padStart(2,'0'); }

function todayISO(){
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}

function genReqId(){
  const d = new Date();
  const base = `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  const rnd = Math.floor(Math.random()*900+100);
  return `${base}-${rnd}`;
}

function genOutNo(){
  const y = new Date().getFullYear();
  const n = Math.floor(Math.random()*9000 + 1000);
  return `№ ${y}/${n}`;
}

function escapeText(v){
  return (v ?? "").toString().trim();
}

function requiredOk(el){
  if(!el) return true;
  if(el.hasAttribute("required")){
    if(el.type === "file") return el.files && el.files.length > 0;
    return escapeText(el.value).length > 0;
  }
  return true;
}

function labelOf(el){
  const label = el.closest(".field")?.querySelector("label");
  return label ? label.textContent.replace("*","").trim() : "поле";
}

function showError(msg){
  $("successBox").style.display = "none";
  $("errorBox").textContent = msg;
  $("errorBox").style.display = msg ? "block" : "none";
}

function showSuccess(msg){
  $("errorBox").style.display = "none";
  $("successBox").textContent = msg;
  $("successBox").style.display = "block";
  setTimeout(() => $("successBox").style.display = "none", 2500);
}

function validateStep(step){
  const panel = document.querySelector(`.stepPanel[data-step="${step}"]`);
  const required = panel.querySelectorAll("[required]");

  for(const el of required){
    if(!requiredOk(el)){
      return { ok:false, message: `Заполните обязательное поле: ${labelOf(el)}` };
    }
  }

  if(step === 3){
    const cad = escapeText($("cadNo").value);
    const re = /^\d{2}:\d{2}:\d{6,7}:\d{1,6}$/;
    if(cad && !re.test(cad)){
      return { ok:false, message: "Кадастровый номер некорректный. Пример: 77:01:0004012:1234" };
    }
  }

  if(step === 5){
    const vd = $("valuationDate").value;
    const dl = $("deadline").value;
    const now = todayISO();

    if(vd && vd > now) return { ok:false, message: "Дата оценки не может быть в будущем." };
    if(dl && dl < now) return { ok:false, message: "Срок предоставления отчета не может быть в прошлом." };
  }

  return { ok:true };
}

function buildPreview(){
  const city = escapeText($("notaryCity").value);
  const fio = escapeText($("notaryFio").value);
  const officeNo = escapeText($("notaryOfficeNo").value);
  const officeAddr = escapeText($("notaryOfficeAddr").value);
  const outNo = escapeText($("outNo").value);
  const outDate = escapeText($("outDate").value);

  const comp = escapeText($("companyName").value);
  const compAddr = escapeText($("companyAddr").value);

  const objAddr = escapeText($("objAddr").value);
  const cadNo = escapeText($("cadNo").value);
  const objType = escapeText($("objType").value);

  const docType = escapeText($("docType").value);
  const docNo = escapeText($("docNo").value);
  const docDate = escapeText($("docDate").value);
  const docIssuer = escapeText($("docIssuer").value);

  const purpose = escapeText($("purpose").value);
  const valuationDate = escapeText($("valuationDate").value);
  const special = escapeText($("special").value);
  const deadline = escapeText($("deadline").value);

  const docRekv = [
    docType ? `Вид: ${docType}` : "",
    docNo ? `Номер: ${docNo}` : "",
    docDate ? `Дата: ${docDate}` : "",
    docIssuer ? `Кем выдан: ${docIssuer}` : "",
  ].filter(Boolean).join(", ");

  const specialLine = special ? special : "—";

  const text =
    `Нотариальный запрос о проведении оценки рыночной стоимости объекта недвижимости
От: Нотариус города ${city || "{Город}"} ${fio || "{Фамилия И.О.}"}, нотариальная контора № ${officeNo || "{Номер}"}, расположенная по адресу: ${officeAddr || "{Адрес нотариуса}"}
Исх. №: ${outNo || "{Номер исходящего документа}"}
Дата: ${outDate || "{Дата}"}
Кому: Руководителю
Оценочной компании "${comp || "{Название компании}"}"
${compAddr || "{Адрес компании}"}
Запрос
На основании необходимости совершения нотариального действия (${purpose || "{Цель}"}) и в соответствии со статьей 47 "Основ законодательства Российской Федерации о нотариате", прошу Вас провести оценку рыночной стоимости объекта недвижимости и предоставить в мою адрес письменный отчет об оценке, соответствующий требованиям Федерального закона от 29.07.1998 № 135-ФЗ "Об оценочной деятельности в Российской Федерации" и Федеральных стандартов оценки (ФСО).
Параметры объекта для оценки:
Адрес объекта: ${objAddr || "{Адрес объекта недвижимости}"}
Кадастровый номер: ${cadNo || "{Кадастровый номер}"}
Вид объекта: ${objType || "{Вид объекта}"}
Правоустанавливающие документы: ${docRekv || "{Реквизиты документа}"}
Цель проведения оценки: ${purpose || "{Цель оценки}"}
Дата, на которую требуется определить стоимость: ${valuationDate || "{Дата оценки}"}
Особые условия/характеристики: ${specialLine}
Отчет об оценке должен быть представлен на бумажном носителе, подписан и заверен печатью оценщика, с приложением копии квалификационного аттестата оценщика.
Срок предоставления отчета: до ${deadline || "{Дата окончания срока}"}.
Приложение:
1) Копии правоустанавливающих и правоподтверждающих документов на объект.
2) Копия технического паспорта/плана БТИ.
3) Выписка из ЕГРН.
`;

  $("preview").textContent = text;
}

// ------------------------------
// STEPS
// ------------------------------
const steps = [
  { id:1, title:"Данные нотариуса" },
  { id:2, title:"Оценочная компания" },
  { id:3, title:"Объект недвижимости" },
  { id:4, title:"Документы" },
  { id:5, title:"Детали оценки" },
];

let currentStep = 1;

function renderStepper(){
  const el = $("stepper");
  el.innerHTML = "";
  for(const s of steps){
    const btn = document.createElement("div");
    btn.className = `step ${s.id===currentStep ? "active" : ""}`;
    btn.innerHTML = `<span class="dot">${s.id}</span><span>${s.title}</span>`;
    btn.addEventListener("click", () => goToStep(s.id));
    el.appendChild(btn);
  }
}

function goToStep(step){
  if(step > currentStep){
    const v = validateStep(currentStep);
    if(!v.ok){ showError(v.message); return; }
  }

  currentStep = step;
  document.querySelectorAll(".stepPanel").forEach(p => {
    p.style.display = (Number(p.dataset.step) === currentStep) ? "block" : "none";
  });

  $("stepTitle").textContent = `Шаг ${currentStep} — ${steps.find(x=>x.id===currentStep).title}`;
  $("stepBadge").textContent = `${currentStep}/5`;

  $("btnPrev").disabled = currentStep === 1;
  $("btnNext").textContent = currentStep === 5 ? "Готово ✓" : "Далее →";

  renderStepper();
  buildPreview();
}

// ------------------------------
// INIT
// ------------------------------
const requestId = genReqId();
$("reqId").textContent = requestId;

$("outNo").value = genOutNo();
$("outDate").value = todayISO();

// cities
for(const c of notaries){
  const opt = document.createElement("option");
  opt.value = c.city;
  opt.textContent = c.city;
  $("notaryCity").appendChild(opt);
}

// companies
for(const co of companies){
  const opt = document.createElement("option");
  opt.value = co.name;
  opt.textContent = co.name;
  $("companyName").appendChild(opt);
}

// city -> notary list
$("notaryCity").addEventListener("change", () => {
  const city = $("notaryCity").value;
  const found = notaries.find(x => x.city === city);

  $("notaryFio").innerHTML = '<option value="">— выберите нотариуса —</option>';
  $("notaryFio").disabled = !found;

  $("notaryOfficeNo").value = "";
  $("notaryOfficeAddr").value = "";

  if(found){
    for(const n of found.list){
      const opt = document.createElement("option");
      opt.value = n.fio;
      opt.textContent = n.fio;
      opt.dataset.officeNo = n.officeNo;
      opt.dataset.officeAddr = n.officeAddr;
      $("notaryFio").appendChild(opt);
    }
  }

  buildPreview();
});

// notary -> office info
$("notaryFio").addEventListener("change", () => {
  const sel = $("notaryFio");
  const opt = sel.options[sel.selectedIndex];
  $("notaryOfficeNo").value = opt?.dataset?.officeNo || "";
  $("notaryOfficeAddr").value = opt?.dataset?.officeAddr || "";
  buildPreview();
});

// company -> address
$("companyName").addEventListener("change", () => {
  const name = $("companyName").value;
  const co = companies.find(x => x.name === name);
  $("companyAddr").value = co?.addr || "";
  buildPreview();
});

// file
$("docFile").addEventListener("change", () => {
  const f = $("docFile").files?.[0];
  if(!f){
    $("fileState").textContent = "Файл не выбран";
    $("fileState").style.borderColor = "rgba(255,255,255,.10)";
    buildPreview();
    return;
  }

  if(f.type !== "application/pdf"){
    $("docFile").value = "";
    $("fileState").textContent = "Только PDF";
    $("fileState").style.borderColor = "rgba(255,92,122,.55)";
    showError("Можно прикреплять только PDF файл.");
    return;
  }

  $("fileState").textContent = `Выбран: ${f.name}`;
  $("fileState").style.borderColor = "rgba(61,220,151,.45)";
  buildPreview();
});

// live preview
document.querySelectorAll("input, select, textarea").forEach(el => {
  el.addEventListener("input", buildPreview);
  el.addEventListener("change", buildPreview);
});

// nav
$("btnPrev").addEventListener("click", () => {
  if(currentStep > 1) goToStep(currentStep - 1);
});

$("btnNext").addEventListener("click", () => {
  const v = validateStep(currentStep);
  if(!v.ok){ showError(v.message); return; }

  if(currentStep < 5){
    showError("");
    goToStep(currentStep + 1);
    return;
  }

  // final validation
  for(let s=1; s<=5; s++){
    const vv = validateStep(s);
    if(!vv.ok){
      goToStep(s);
      showError(vv.message);
      return;
    }
  }

  $("status").textContent = "Готово к отправке";
  showSuccess("Форма заполнена. Можно копировать текст запроса.");
});

// draft save (localStorage)
$("btnDraft").addEventListener("click", () => {
  const data = collectForm();
  localStorage.setItem("real_estate_appraisal_request_draft", JSON.stringify(data));
  $("status").textContent = "Черновик сохранен";
  showSuccess("Черновик сохранен в браузере (localStorage).");
});

function collectForm(){
  return {
    requestId,
    notaryCity: $("notaryCity").value,
    notaryFio: $("notaryFio").value,
    notaryOfficeNo: $("notaryOfficeNo").value,
    notaryOfficeAddr: $("notaryOfficeAddr").value,
    outNo: $("outNo").value,
    outDate: $("outDate").value,

    companyName: $("companyName").value,
    companyAddr: $("companyAddr").value,

    objAddr: $("objAddr").value,
    cadNo: $("cadNo").value,
    objType: $("objType").value,

    docType: $("docType").value,
    docNo: $("docNo").value,
    docDate: $("docDate").value,
    docIssuer: $("docIssuer").value,

    purpose: $("purpose").value,
    valuationDate: $("valuationDate").value,
    deadline: $("deadline").value,
    special: $("special").value,

    savedAt: new Date().toISOString(),
  };
}

function applyDraft(d){
  if(!d) return;

  $("notaryCity").value = d.notaryCity || "";
  $("notaryCity").dispatchEvent(new Event("change"));

  setTimeout(() => {
    $("notaryFio").value = d.notaryFio || "";
    $("notaryFio").dispatchEvent(new Event("change"));
  }, 0);

  $("outNo").value = d.outNo || $("outNo").value;
  $("outDate").value = d.outDate || $("outDate").value;

  $("companyName").value = d.companyName || "";
  $("companyName").dispatchEvent(new Event("change"));

  $("objAddr").value = d.objAddr || "";
  $("cadNo").value = d.cadNo || "";
  $("objType").value = d.objType || "";

  $("docType").value = d.docType || "";
  $("docNo").value = d.docNo || "";
  $("docDate").value = d.docDate || "";
  $("docIssuer").value = d.docIssuer || "";

  $("purpose").value = d.purpose || "";
  $("valuationDate").value = d.valuationDate || "";
  $("deadline").value = d.deadline || "";
  $("special").value = d.special || "";

  buildPreview();
}

// copy
$("btnCopy").addEventListener("click", async () => {
  try{
    await navigator.clipboard.writeText($("preview").textContent);
    showSuccess("Текст запроса скопирован в буфер обмена.");
  }catch(e){
    showError("Не удалось скопировать. Скопируйте вручную из блока предпросмотра.");
  }
});

// load draft
try{
  const raw = localStorage.getItem("real_estate_appraisal_request_draft");
  if(raw){
    applyDraft(JSON.parse(raw));
    $("status").textContent = "Черновик загружен";
  }
}catch(e){}

// start
renderStepper();
goToStep(1);
buildPreview();
