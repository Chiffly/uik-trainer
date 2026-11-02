(() => {
  'use strict';
  const D=window.UikGameData,E=window.UikEngine,KEY='uik-counter-v4',main=document.querySelector('#main'),dialog=document.querySelector('#detail-dialog');
  const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let state=null,search='',compare='',drag=null,suppressClick=false,entering=false,lastOpener=null,renderedVisitor=null;
  try {state=E.restore(JSON.parse(localStorage.getItem(KEY)),D.visitors);}catch{$('#storage-warning').hidden=false;}
  D.setDate(state?.date||D.today());
  function save(){try{localStorage.setItem(KEY,JSON.stringify(state));}catch{$('#storage-warning').hidden=false;}}
  function announce(text){$('#announcer').textContent=text;}
  const icons={arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>',file:'<path d="M6 3h8l4 4v14H6zM14 3v5h4M9 12h6M9 16h6"/>',book:'<path d="M3 4h6l3 2 3-2h6v15h-6l-3 2-3-2H3zM12 6v15"/>',check:'<path d="m5 12 4 4L19 6"/>',close:'<path d="m6 6 12 12M6 18 18 6"/>',move:'<path d="M12 2v20M2 12h20m-13-7 3-3 3 3m-6 14 3 3 3-3M5 9l-3 3 3 3m14-6 3 3-3 3"/>',zoom:'<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6M7 10h6M10 7v6"/>'};
  const icon=n=>`<svg viewBox="0 0 24 24" aria-hidden="true">${icons[n]||''}</svg>`;
  const btn=(action,label,cls='secondary',extra='')=>`<button class="button ${cls}" data-action="${action}" ${extra}>${label}</button>`;
  const has=e=>state?.events.includes(e);
  const visitor=()=>D.visitors[state.index];
  function sprite(index,label='',cls=''){return `<span class="sprite ${cls}" style="--col:${index%4};--row:${Math.floor(index/4)}" ${label?`role="img" aria-label="${esc(label)}"`:'aria-hidden="true"'}></span>`;}
  function go(hash){if(location.hash===hash)render();else location.hash=hash;}
  function transition(action,value){const before=state;state=E.act(state,visitor(),action,value);if(before===state)return;save();renderShift();const last=state.messages.at(-1);if(last)announce(last.text);if(state.phase==='departed'){announce('Приём завершён. Решение сохранено.');window.scrollTo({top:0,behavior:'instant'});$('#next-visitor')?.focus({preventScroll:true});}}
  function home(){
    const active=state&&state.phase!=='complete';
    main.innerHTML=`<section class="welcome"><div class="welcome-copy"><h1>Ваш участок.<br>Ваша смена.</h1><p class="lead">Поздоровайтесь, попросите документ, сверьте запись в списке. У каждого из 12 посетителей — своя история.</p><div class="welcome-actions">${btn(active?'resume':'start',active?'Продолжить смену':`Играть ${icon('arrow')}`,'primary')}${state?btn('restart','Новая смена'):''}${state?.phase==='complete'?btn('results','Посмотреть разбор'):''}</div><p class="quiet">Без таймера. Решения разбираем после всей смены.</p></div><div class="welcome-scene"><img src="assets/counter-room.png" alt="Светлый избирательный участок" class="room-image">${sprite(0,'Первый посетитель','welcome-person')}<span class="welcome-speech">Здравствуйте!</span><div class="welcome-desk"></div></div></section><section class="how"><h2>Рабочий стол оживает</h2><ol><li><b>Получите документ</b><span>Он появится на столе после вашей просьбы. Откройте и рассмотрите его.</span></li><li><b>Сверьте и поговорите</b><span>Найдите избирателя в списке. Задайте вопросы и ответьте на его обращение.</span></li><li><b>Выдайте или откажите</b><span>Подписи ставятся в списке. Передайте документы кнопкой или перетаскиванием.</span></li></ol></section><p class="prototype-note">Учебная игра. Все люди, адреса и документы вымышлены. Образцы похожи по устройству на документы, но не являются их копиями.</p>`;
  }
  function paperNames(){return {register:'Список избирателей',document:visitor().document.title,helper:'Паспорт помощника',ballot:'Новый бюллетень'};}
  function available(){if(!state||state.phase!=='serving')return [];return ['register',...(has('request')&&!has('document-returned')&&(!has('cancel-spoiled')||state.intent==='decline')?['document']:[]),...(has('helper')&&!has('helper-returned')?['helper']:[]),...(state.intent==='issue'&&!has('ballot-given')?['ballot']:[])];}
  function field(label,value,key=''){return `<div class="doc-field ${compare===key&&key?'comparing':''}"><span>${label}</span><b>${esc(value)}</b></div>`;}
  function docBody(d,zoom=false){
    if(d.kind==='spoiled')return `<div class="spoiled-sheet"><div class="folded-ballot"><span>Учебный бюллетень</span><h3>Возвращён для замены</h3><p>Содержание выбора скрыто.</p><span class="fold-line"></span></div><section class="paper-procedure spoiled-actions" aria-label="Оформление испорченного бюллетеня">${procedure('spoiled-note','Сделать запись и подписать','Запись и подпись члена УИК есть')}${procedure('secretary-sign','Передать секретарю на подпись','Секретарь подписал',!has('spoiled-note')?'disabled':'')}${procedure('cancel-spoiled','Погасить бюллетень','Испорченный бюллетень погашен',!has('secretary-sign')?'disabled':'')}</section></div>`;
    return `<div class="identity ${d.kind}"><div class="identity-top"><strong>${esc(d.title)}</strong><span>УЧЕБНЫЙ ОБРАЗЕЦ</span></div><div class="identity-pages"><div class="photo-column"><div class="doc-photo">${sprite(d.portrait,'Фото владельца учебного документа')}</div><span>Личная подпись</span><b class="sample-sign">${esc(d.name.split(' ')[0])}</b></div><div class="identity-fields">${field('Фамилия, имя, отчество',d.name,'name')}${field('Дата рождения',d.birth,'birth')}${field('Реквизиты',d.number)}${field('Дата выдачи',d.issued)}${d.expires?field('Действует до',d.expires,'expires'):''}${d.category?field('Категория',d.category):''}</div></div><div class="identity-bottom">${field('Кем выдан',d.authority)}<span>Примерск · вымышленные данные · не документ</span></div></div>`;
  }
  function procedure(id,label,done,extra=''){
    const key=['record','voter-sign','member-sign','replacement-note','helper-record'].includes(id)?id+':'+state.selectedVoter:id;
    return `<button class="paper-action ${has(key)?'completed':''}" data-action="procedure" data-id="${id}" ${has(key)?'disabled':''} ${extra}>${has(key)?icon('check'):icon('file')}<span>${has(key)?done:label}</span></button>`;
  }
  function recordBody(){
    const v=visitor(),r=D.voters.find(r=>r.id===state.selectedVoter);
    if(!r)return `<form id="voter-search"><label for="surname">Найти избирателя по фамилии</label><div><input id="surname" name="surname" placeholder="Введите фамилию" autocomplete="off" value="${esc(search)}"><button type="submit" class="search-button">Найти</button></div></form><div id="voter-matches">${voterMatches()}</div>`;
    const ready=has('request')?'':'disabled';
    return `<div class="record-sheet"><button class="text-button" data-action="search-again">К поиску в списке</button>${field('Фамилия, имя, отчество',r.name,'name')}<div class="record-person">${field('Дата рождения',r.birth,'birth')}${field('Адрес',r.address)}</div>
    ${r.received?'<p class="receipt-status">Бюллетень уже получен. Реквизиты и обе подписи есть.</p>':''}
    <div class="record-entry"><span>Реквизиты документа</span>${has('record:'+r.id)?`<b>${esc(v.document.number)}</b>`:r.received?'<b>Заполнены при первой выдаче</b>':procedure('record','Внести реквизиты документа','Реквизиты внесены',ready)}</div>
    <div class="record-entry"><span>Подпись избирателя</span>${has('voter-sign:'+r.id)?`<b class="written-sign">${esc(r.name.split(' ')[0])}</b>`:r.received?'<b class="written-sign">Подпись есть</b>':procedure('voter-sign','Попросить избирателя расписаться','Избиратель расписался',!has('record:'+r.id)?'disabled':'')}</div>
    <div class="record-entry"><span>Подпись члена УИК</span>${has('member-sign:'+r.id)?'<b class="written-sign">Учебная подпись</b>':r.received?'<b class="written-sign">Подпись есть</b>':procedure('member-sign','Подписать выдачу как член УИК','Вы подписали выдачу',!has('voter-sign:'+r.id)?'disabled':'')}</div>
    ${v.replacement?`<section class="paper-procedure"><h3>Замена бюллетеня</h3>${procedure('replacement-note','Отметить выдачу взамен испорченного','Выдан бюллетень взамен испорченного',ready)}</section>`:''}
    ${v.helper?`<section class="paper-procedure"><h3>Сведения о помощнике</h3>${has('helper-record:'+r.id)?`<p class="helper-entry">${esc(v.helper.name)}<br>${esc(v.helper.number)}</p>`:`${!has('helper-check')?'<p class="record-action-hint">Сначала запросите и проверьте паспорт в разделе «Помощник».</p>':''}${procedure('helper-record','Внести ФИО и реквизиты помощника в список','Данные помощника внесены',!has('helper-check')?'disabled':'')}`}</section>`:''}</div>`;
  }
  function voterMatches(){const q=search.toLocaleLowerCase('ru').trim(),rows=D.voters.filter(r=>!q||r.name.toLocaleLowerCase('ru').includes(q));return `<p class="search-count">${q?`Найдено: ${rows.length}`:`Учебный список · ${D.voters.length} записей`}</p><div class="voter-list">${rows.map(r=>`<button data-action="select-voter" data-id="${r.id}"><b>${esc(r.name)}</b><span>${esc(r.birth)} · ${esc(r.address)}</span></button>`).join('')||`<p>Запись не найдена. Проверьте написание фамилии.</p>${btn('chair',has('chair')?'Вопрос передан председателю':'Уточнить список у председателя','secondary',has('chair')?'disabled':'')}`}</div>`;}
  function paper(id){
    const v=visitor(),open=state.opened.includes(id)||id==='ballot',name=paperNames()[id],pos=state.positions[id]||{x:id==='register'?.96:id==='ballot'?.6:.03,y:id==='register'?.6:id==='helper'?1:0};
    let body='';
    if(!open)body=`<button class="paper-cover ${id==='register'?'register-cover':''}" data-action="open-paper" data-id="${id}">${icon(id==='register'?'book':'file')}<b>${esc(name)}</b><span>Открыть ${icon('arrow')}</span></button>`;
    else if(id==='register')body=recordBody();
    else if(id==='ballot')body=`<div class="new-ballot"><strong>БЮЛЛЕТЕНЬ</strong><span>Учебный образец</span><p>${v.replacement?'Взамен испорченного':'Для личного голосования'}</p></div>`;
    else body=docBody(id==='helper'?v.helper:v.document);
    const canGive=state.intent&&id!=='register'&&!(id==='document'&&v.replacement&&state.intent==='issue');
    return `<article class="movable-paper ${id} ${open?'opened':'closed'} ${state.focusPaper===id?'front':''}" data-paper="${id}" style="--px:${pos.x};--py:${pos.y}"><div class="paper-handle"><button class="drag-handle" data-drag="${id}" aria-label="Переместить: ${esc(name)}" aria-describedby="drag-help">${icon('move')}<span>${id==='register'?'Список':id==='ballot'?'Бюллетень':id==='helper'?'Помощник':'Документ'}</span></button>${id!=='ballot'?`<button class="paper-tool" data-action="open-paper" data-id="${id}" aria-label="${open?'Свернуть':'Открыть'}: ${esc(name)}">${icon(open?'close':'book')}</button>`:''}${id!=='register'&&id!=='ballot'?`<button class="paper-tool" data-action="zoom" data-id="${id}" aria-label="Увеличить: ${esc(name)}">${icon('zoom')}</button>`:''}</div><div class="paper-content">${body}</div>${canGive?`<button class="give-paper" data-action="give" data-id="${id}">${id==='ballot'?'Передать бюллетень':'Вернуть документ'} ${icon('arrow')}</button>`:''}</article>`;
  }
  function conversation(){
    const v=visitor();
    const line=m=>m.who==='request'?
      `<div class="dialogue-request" id="visitor-question"><p><span>${esc(v.name.split(' ')[0])} · вопрос к вам</span><strong>${esc(m.text)}</strong></p><div role="group" aria-label="Ответить посетителю">${v.request.answers.map(a=>`<button class="reply-choice" data-action="answer" data-id="${a.id}" aria-pressed="${state.answers.request===a.id}">${esc(a.label)}${state.answers.request===a.id?icon('check'):''}</button>`).join('')}</div><small>${state.answers.request?'Ваш ответ записан. Его можно изменить до завершения приёма.':'Выберите реплику. Оценка — в конце смены.'}</small></div>`:
      `<p class="${m.who==='you'?'said-by-you':'said-by-visitor'}"><span>${m.who==='you'?'Вы':esc(v.name.split(' ')[0])}</span>${esc(m.text)}</p>`;
    return `<aside class="talk-panel" aria-label="Разговор с посетителем"><div class="talk-heading"><span class="avatar-crop">${sprite(v.sprite)}</span><div><h2>${esc(v.name)}</h2><span>${state.phase==='departed'?'Приём завершён':'Разговор у стойки'}</span></div></div>${state.phase==='departed'?`<p class="neutral-receipt">Вы решили: <b>${state.intent==='issue'?'выдать':'не выдать'}</b>. Оценка — после смены.</p>`:`<div class="conversation-log" aria-label="Единая лента разговора">${state.messages.length?state.messages.map(line).join(''):line({who:'visitor',text:v.greeting})}</div>${!has('greet')?btn('greet','Здравствуйте. Чем могу помочь?','primary'):!has('request')?btn('request',v.replacement?'Покажите испорченный бюллетень':'Ваш паспорт, пожалуйста','primary'):`<button class="text-button question-jump" data-action="question-jump">К вопросу посетителя${state.answers.request?' · ответ дан':''}</button><details class="ask-menu"><summary>Уточнить у посетителя <span>${v.questions.filter(q=>has('ask:'+q.id)).length} / ${v.questions.length}</span></summary>${v.questions.map(q=>`<button class="question" data-action="ask" data-id="${q.id}">${esc(q.label)} ${has('ask:'+q.id)?icon('check'):icon('arrow')}</button>`).join('')}</details>` }`}</aside>`;
  }
  function calendar(){
    const [d,m,y]=D.date.split('.'),dt=new Date(Date.UTC(+y,+m-1,+d)),month=new Intl.DateTimeFormat('ru-RU',{month:'long',timeZone:'UTC'}).format(dt),weekday=new Intl.DateTimeFormat('ru-RU',{weekday:'long',timeZone:'UTC'}).format(dt);
    return `<aside class="desk-calendar" aria-label="Календарь смены: ${D.date}"><time datetime="${y}-${m}-${d}"><b>${d}</b><span>${month} ${y}<small>${weekday}</small></span></time><span>Сегодня в смене</span></aside>`;
  }
  function workspace(){
    if(!has('request')||state.phase!=='serving')return '';
    const v=visitor();
    if(!v.helper)return '';
    return `<section class="work-actions" aria-label="Особые действия с документами">
    ${v.helper?`<div class="work-section helper-work"><h3>Помощник</h3><p>Сначала уточните статус помощника, затем получите и осмотрите его паспорт. Данные записываются в строку самого избирателя.</p><div class="action-grid">${btn('ask',has('ask:helper')?'Статус помощника уточнён':'Уточнить статус помощника','secondary','data-id="helper"')}${btn('helper',has('helper')?'Паспорт помощника получен':'Попросить паспорт помощника','secondary',has('helper')?'disabled':'')}${btn('inspect-helper',has('helper-check')?'Паспорт помощника проверен':'Осмотреть паспорт помощника','secondary',!has('helper')||has('helper-returned')?'disabled':'')}${btn('register-find','Открыть список для записи данных','secondary')}</div>${has('helper-record:'+state.selectedVoter)?`<p class="helper-entry">В список внесены: ${esc(v.helper.name)} · ${esc(v.helper.number)}</p>`:''}</div>`:''}
    </section>`;
  }
  function inspectHelper(){
    const d=visitor().helper;
    if(!d||!has('helper')||has('helper-returned'))return;
    modal('Паспорт помощника',docBody(d,true)+`<p class="inspection-note">Сверьте ФИО, фотографию и реквизиты. После осмотра подтвердите проверку; внесение данных в список — отдельное действие.</p>${btn('helper-check',has('helper-check')?'Документ проверен':'Документ проверен','primary')}`,'document-zoom');
  }
  function instruction(){if(!has('greet'))return 'Начните с приветствия.';if(!has('request'))return 'Попросите документ — он появится на столе.';if(!state.intent)return 'Сверьте документ со списком и ответьте посетителю.';if(state.intent==='decline')return 'Верните документы посетителю, чтобы завершить приём.';return 'Оформите запись в списке, передайте бюллетень и верните документы.';}
  function renderShift(){
    if(!state){home();return;}if(state.phase==='complete'){debrief();return;}
    const sameVisitor=renderedVisitor===state.index,questionOpen=sameVisitor&&!!$('.ask-menu')?.open;
    const scrolls=sameVisitor?Object.fromEntries([...document.querySelectorAll('[data-paper]')].map(p=>[p.dataset.paper,p.querySelector('.paper-content').scrollTop])):{};
    renderedVisitor=state.index;
    const v=visitor(),papers=available(),last=[...state.messages].reverse().find(m=>m.who==='visitor');
    main.innerHTML=`<section class="counter-game"><div class="shift-heading"><div><h1>За стойкой УИК</h1><span class="shift-date">Учебная дата: <b>${D.date}</b></span></div><div class="queue"><span>Посетитель <b>${state.index+1}</b> / ${D.visitors.length}</span><div class="queue-dots">${D.visitors.map((_,i)=>`<i class="${i<state.records.length?'done':i===state.index?'current':''}"></i>`).join('')}</div></div></div><div class="play-grid"><div class="counter-scene ${entering?'arriving':''} ${state.phase==='departed'?'is-departed':''}"><img src="assets/counter-room.png" alt="" class="room-image">${sprite(v.sprite,v.name,'counter-person')}${state.phase==='departed'?`<div class="visit-finished"><h2>Следующий, пожалуйста.</h2><p>Приём завершён. Решение сохранено.</p>${btn('next',state.index===D.visitors.length-1?'Завершить смену':`Пригласить следующего ${icon('arrow')}`,'primary','id="next-visitor"')}</div>`:''}</div>${conversation()}<section class="table-section" aria-label="Рабочий стол"><div class="table-toolbar"><div class="paper-tabs">${papers.map(id=>`<button data-action="focus-paper" data-id="${id}" aria-pressed="${state.focusPaper===id}">${id==='register'?'Список':id==='helper'?'Помощник':id==='ballot'?'Бюллетень':'Документ'}</button>`).join('')}</div>${papers.length?`<button class="text-button" data-action="arrange">Разложить</button>`:''}${calendar()}</div><div class="workdesk" id="workdesk"><div class="handover-zone ${state.intent?'ready':''}" aria-label="Передать посетителю"><span>${icon('arrow')} Посетителю</span><small>${state.intent?'Перетащите документ сюда':'После решения о выдаче'}</small></div>${!has('request')?'<div class="waiting-document">Здесь появится документ,<br>когда вы попросите его у посетителя.</div>':''}${papers.map(paper).join('')}</div><div class="desk-help" id="drag-help">Перетаскивайте за верхний край. С клавиатуры: стрелки на кнопке перемещения; Enter — другое место. Кнопка «Передать» заменяет перетаскивание.</div>${has('request')&&state.phase==='serving'?`<div class="compare-tools"><span>Сопоставить поля:</span><button data-action="compare" data-id="name" aria-pressed="${compare==='name'}">ФИО</button><button data-action="compare" data-id="birth" aria-pressed="${compare==='birth'}">Дата рождения</button>${v.document.expires?`<button data-action="compare" data-id="expires" aria-pressed="${compare==='expires'}">Срок действия</button>`:''}</div>`:''}${workspace()}</section><section class="decision-dock" aria-label="Решение о выдаче"><div><h2>${state.intent?`Решение: ${state.intent==='issue'?'выдать':'не выдать'}`:'Решение о бюллетене'}</h2><p>${state.phase==='departed'?'Приём завершён.':instruction()}</p></div><div class="decision-buttons">${btn('intent','Выдать','issue-button',`data-id="issue" aria-pressed="${state.intent==='issue'}" ${!has('request')||state.phase!=='serving'||has('ballot-given')||has('document-returned')?'disabled':''}`)}${btn('intent','Не выдать','decline-button',`data-id="decline" aria-pressed="${state.intent==='decline'}" ${!has('request')||state.phase!=='serving'||has('ballot-given')||has('document-returned')?'disabled':''}`)}</div></section></div><div class="shift-bottom"><span>${state.records.length} из ${D.visitors.length} приёмов завершено · сохраняется автоматически</span><button class="text-button" data-action="pause">Пауза / выйти</button></div></section>`;
    entering=false;
    if(questionOpen&&$('.ask-menu'))$('.ask-menu').open=true;
    for(const p of document.querySelectorAll('[data-paper]'))p.querySelector('.paper-content').scrollTop=scrolls[p.dataset.paper]||0;
    const log=$('.conversation-log');if(log)log.scrollTop=log.scrollHeight;
  }

  function eventLabel(e,v){
    const labels={chair:'Передали вопрос о списке председателю','helper-check':'Осмотрели паспорт помощника',greet:'Поздоровались',request:'Получили документ',list:'Открыли запись в списке',helper:'Получили документ помощника','ballot-given':'Передали бюллетень','document-returned':'Вернули документ','helper-returned':'Вернули паспорт помощника','spoiled-note':'Сделали запись и подписали испорченный бюллетень','secretary-sign':'Получили подпись секретаря','cancel-spoiled':'Погасили испорченный бюллетень'};
    if(labels[e])return labels[e];
    const [type,id]=e.split(':');
    if(type==='search')return 'Поиск в списке: '+id;
    if(type==='ask')return 'Вопрос: '+(v.questions.find(q=>q.id===id)?.label||id);
    const actions={record:'Внесли реквизиты','voter-sign':'Получили подпись избирателя','member-sign':'Подписали выдачу','replacement-note':'Отметили замену','helper-record':'Внесли данные помощника'};
    return `${actions[type]||type} · ${D.voters.find(r=>r.id===id)?.name||id}`;
  }
  function debrief(){
    const result=state&&E.results(state,D.visitors);
    if(!result){main.innerHTML=`<section class="empty-results"><h1>Разбор — после смены</h1><p>Примите всех 12 посетителей. До конца смены правильность решений не показывается.</p>${btn(state?'resume':'start',state?'Продолжить смену':'Играть','primary')}</section>`;return;}
    main.innerHTML=`<section class="debrief"><div class="results-heading"><div><h1>${result.errors?'Смена завершена.<br>Разберём решения.':'Смена без ошибок.'}</h1><p>Проверяем выдачу, ответы посетителям и записи в документах.</p></div>${btn('restart','Новая смена','primary')}</div><div class="score-strip"><div><strong>${result.perfect}<span> / ${D.visitors.length}</span></strong><span>приёмов без ошибок</span></div><div><strong>${result.decisions}<span> / ${D.visitors.length}</span></strong><span>верных решений о выдаче</span></div><div><strong>${result.errors}</strong><span>ошибки и пропущенные действия</span></div></div><p class="result-explainer">Один приём может содержать несколько ошибок. Ответ посетителю оценивается отдельно от решения о выдаче.</p><div class="review-list">${result.rows.map(({visitor:v,record:r,checks},i)=>{const errors=checks.filter(c=>!c.ok).length;return `<details class="review" ${errors?'open':''}><summary><span class="review-number">${i+1}</span><span><b>${esc(v.name)}</b><span>${esc(v.topic)}</span></span><span class="review-status ${errors?'needs-review':'good'}">${errors?`Ошибок: ${errors}`:'Без ошибок'}</span></summary><div class="review-content"><p class="chosen"><b>Вы решили:</b> ${r.decision==='issue'?'выдать':'не выдать'}.</p><p class="chosen"><b>На вопрос посетителя:</b> ${esc(v.request.answers.find(a=>a.id===r.answers.request)?.label||'Ответа не было.')}</p><ul class="checks">${checks.map(c=>`<li class="${c.ok?'good':'needs-review'}"><span>${icon(c.ok?'check':'close')}</span><div><b>${esc(c.label)} · ${c.ok?'верно':'нужно исправить'}</b><p>${esc(c.explanation)}</p></div></li>`).join('')}</ul><details class="action-history"><summary>История действий (${r.events.length})</summary><ol>${r.events.map(e=>`<li>${esc(eventLabel(e,v))}</li>`).join('')}</ol></details><a href="${v.sourceUrl}" target="_blank" rel="noopener noreferrer" class="source-link">67-ФЗ · ${esc(v.source)} ${icon('arrow')}</a></div></details>`;}).join('')}</div><p class="prototype-note">Авторский учебный прототип. Общие правила очного голосования. Нормативная сверка: 02.11.2026; перед реальным обучением нужна предметная экспертиза.</p></section>`;
  }
  function modal(title,body,cls=''){
    lastOpener=document.activeElement;
    dialog.className='detail-dialog '+cls;
    dialog.innerHTML=`<div class="dialog-heading"><h2 id="detail-title">${title}</h2><button class="icon-button" data-action="close" aria-label="Закрыть">${icon('close')}</button></div>${body}`;
    dialog.showModal();
  }
  function guide(){modal('Справочник за стойкой',`<div class="guide-content"><h3>Как работает стол</h3><p>Попросите документ. Перемещайте его за верхнюю полоску. Кнопки над столом поднимают выбранный предмет; «Разложить» возвращает предметы на места. На кнопке перемещения работают стрелки и Enter. Чтобы рассмотреть мелкие детали, нажмите лупу.</p><p>В раскрытом списке найдите фамилию и выберите запись. Реквизиты и подписи оформляются прямо в списке, у соответствующих полей. Здесь же вносятся данные помощника и отметка о замене. Запрос и осмотр паспорта помощника находятся в разделе под столом. Подписи на испорченном бюллетене и его погашение выполняются на самой бумаге. Нажатие «Выдать» кладёт бюллетень на стол; затем передайте его посетителю и верните документы. Перетаскивание в область «Посетителю» и кнопка «Передать» делают одно и то же.</p><h3>Документ и выдача</h3><p>Проверьте вид документа, принадлежность предъявителю, сведения и срок действия. Водительские права не заменяют паспорт. Действующее временное удостоверение личности на период оформления паспорта входит в предусмотренный законом перечень. Для обычного паспорта правила замены по возрасту не сводятся к одному дню рождения; в этой смене срок явно указан у временного документа.</p><p>Бюллетень выдаётся лично включённому в список избирателю по надлежащему документу. Запись оформляется реквизитами и подписями избирателя и члена УИК.</p><h3>Кабинка и помощь</h3><p>Советоваться вдвоём в кабинке нельзя. Если избиратель не может самостоятельно расписаться или заполнить бюллетень, допускается помощь другого избирателя. Помощник не должен быть членом комиссии, кандидатом, наблюдателем, уполномоченным представителем избирательного объединения, членом или уполномоченным представителем инициативной группы референдума, уполномоченным представителем по финансовым вопросам, доверенным лицом кандидата или избирательного объединения. В панели «Помощник» уточните статус, запросите паспорт, осмотрите его и подтвердите проверку. Затем внесите ФИО и реквизиты в выбранную запись списка.</p><h3>Замена</h3><p>На самом испорченном бюллетене действия доступны по порядку, поэтому погасить его до оформления подписей нельзя. Первую замену оформляют с отметкой в списке. На испорченном делают запись с подписью члена УИК и секретаря, затем погашают. Повторная замена требует решения комиссии.</p><h3>Календарь и список</h3><p>Календарь на столе показывает дату начала смены по московскому времени. При продолжении она сохраняется. Сравнивайте срок удостоверения именно с ней. Если фамилии нет в списке, проверьте написание и обратитесь к председателю для уточнения. До разрешения вопроса выдача не производится; это не окончательный отказ в праве голосовать.</p><h3>Источники</h3><p><a href="${D.law}" target="_blank" rel="noopener noreferrer">67-ФЗ, статья 64</a><br><a href="${D.documents}" target="_blank" rel="noopener noreferrer">67-ФЗ, статья 2, пункт 16</a><br><a href="https://www.rcoit.ru/education/" target="_blank" rel="noopener noreferrer">Учебные материалы РЦОИТ</a></p><p class="quiet">Сверено 02.11.2026. Игра работает локально, изменения закона автоматически не загружаются.</p></div>`);}
  function render(){if(location.hash==='#shift')renderShift();else if(['#debrief','#progress'].includes(location.hash))debrief();else home();document.querySelectorAll('[data-nav]').forEach(n=>n.setAttribute('aria-current',n.dataset.nav===(location.hash==='#debrief'?'progress':'home')?'page':'false'));}
  function start(){D.setDate(D.today());state=E.fresh(D.date);save();search='';compare='';entering=true;go('#shift');}
  function refocus(action,id){let selector=`[data-action="${action}"]${id?`[data-id="${id}"]`:''}`;const node=main.querySelector(selector);if(node&&!node.disabled)node.focus({preventScroll:true});}
  function raise(id){state.focusPaper=id;document.querySelectorAll('[data-paper]').forEach(el=>el.classList.toggle('front',el.dataset.paper===id));document.querySelectorAll('[data-action="focus-paper"]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.id===id)));save();}
  function openPaper(id){state.opened=state.opened.includes(id)?state.opened.filter(x=>x!==id):[...state.opened,id];state.focusPaper=id;save();renderShift();refocus('open-paper',id);}
  document.addEventListener('click',event=>{
    if(suppressClick){event.preventDefault();return;}
    if(event.target.closest('a.skip')){event.preventDefault();main.focus();return;}
    const target=event.target.closest('[data-action]');if(!target)return;
    const {action,id}=target.dataset;
    if(action==='start'){if(state)askRestart();else start();}
    else if(action==='restart')askRestart();
    else if(action==='confirm-restart'){dialog.close();start();}
    else if(action==='resume'){entering=true;go('#shift');}
    else if(action==='pause')go('#home');
    else if(action==='results')go('#debrief');
    else if(action==='guide')guide();
    else if(action==='close')dialog.close();
    else if(action==='about')modal('О проекте',`<p>12 вымышленных посетителей, перемещаемые документы, диалоги и разбор в конце смены. Иллюстрации созданы с помощью ИИ, документы — авторские учебные макеты.</p><p>Это не официальный продукт ЦИК и не аттестация. Данные хранятся только в этом браузере. Прогресс прошлых версий не удалён. Хостинг не требуется.</p><p>Вопрос о кабинке и решение о выдаче — разные задачи: корректный отказ в совместном проходе не означает отказ в выдаче бюллетеня.</p>`);
    else if(action==='next'&&state?.phase==='departed'){state=E.next(state,D.visitors.length);save();search='';compare='';entering=true;if(state.phase==='complete')go('#debrief');else {renderShift();window.scrollTo({top:0,behavior:'instant'});main.focus({preventScroll:true});}}
    else if(state?.phase==='serving'&&location.hash==='#shift'){
      if(['greet','request','ask','answer','helper','chair'].includes(action)){transition(action,id);if(action==='greet')refocus('request');else refocus(action,id);}
      else if(action==='select-voter'){transition('select',id);main.querySelector('[data-paper="register"] .paper-content')?.scrollTo(0,0);refocus('search-again');}
      else if(action==='procedure'){
        const zoomed=dialog.open&&!!target.closest('.spoiled-sheet');
        transition(id);
        if(zoomed){if(id==='cancel-spoiled')dialog.close();else dialog.querySelector('.spoiled-sheet').outerHTML=docBody(visitor().document,true);}
        const next={'record':'voter-sign','voter-sign':'member-sign','spoiled-note':'secretary-sign','secretary-sign':'cancel-spoiled'}[id];
        const scope=zoomed&&dialog.open?dialog:main;
        const node=next?scope.querySelector('[data-action="procedure"][data-id="'+next+'"]'):main.querySelector('[data-action="intent"]');
        if(node&&!node.disabled)node.focus();
        if(id==='cancel-spoiled')announce('Испорченный бюллетень погашен.');
      }
      else if(action==='register-find'){state.opened=[...new Set([...state.opened,'register'])];state.focusPaper='register';save();renderShift();const target=$('#surname')||main.querySelector('[data-drag="register"]');target?.focus();}
      else if(action==='question-jump'){const q=$('#visitor-question'),log=$('.conversation-log');if(q&&log){log.scrollTop=q.offsetTop;q.querySelector('button')?.focus({preventScroll:true});}}
      else if(action==='inspect-helper')inspectHelper();
      else if(action==='helper-check'){dialog.close();transition('helper-check');refocus('inspect-helper');announce('Проверка отмечена. Внесите данные помощника в выбранную запись списка.');}
      else if(action==='intent'){transition('intent',id);announce(id==='issue'?'Бюллетень на столе. Оформите запись и передайте его посетителю.':'Решение записано. Верните документ посетителю.');refocus('intent',id);}
      else if(action==='give'){transition('give',id);if(state.phase==='serving')announce('Передано. Завершите передачу остальных документов.');}
      else if(action==='open-paper')openPaper(id);
      else if(action==='focus-paper'){raise(id);main.querySelector(`[data-paper="${id}"] .drag-handle`)?.focus({preventScroll:true});}
      else if(action==='zoom'&&id==='helper')inspectHelper();
      else if(action==='zoom'){raise(id);const d=id==='helper'?visitor().helper:visitor().document;modal(esc(d.title),docBody(d,true),'document-zoom');}
      else if(action==='arrange'){state.positions={};save();renderShift();refocus('arrange');announce('Предметы разложены на исходные места.');}
      else if(action==='compare'){compare=compare===id?'':id;renderShift();refocus('compare',id);announce('Поля выделены синим для сопоставления. Совпадение оцените самостоятельно.');}
      else if(action==='search-again'){state.selectedVoter=null;save();renderShift();$('#surname')?.focus({preventScroll:true});}
    }
  });
  function askRestart(){modal('Начать новую смену?',`<p>Результат этой игровой версии будет заменён. Предыдущие версии прогресса останутся в браузере.</p><div class="button-row">${btn('close','Продолжить текущую')}${btn('confirm-restart','Начать заново','primary')}</div>`);}
  document.addEventListener('submit',event=>{if(event.target.id==='voter-search'){event.preventDefault();search=$('#surname').value;state=E.act(state,visitor(),'search',search);save();renderShift();$('#surname')?.focus({preventScroll:true});announce(D.voters.some(r=>r.name.toLocaleLowerCase('ru').includes(search.toLocaleLowerCase('ru').trim()))?'Список отфильтрован. Выберите запись избирателя.':'Запись не найдена. Проверьте фамилию или нажмите «Уточнить список у председателя» под результатами поиска.');}});
  dialog.addEventListener('close',()=>{if(lastOpener?.isConnected)lastOpener.focus({preventScroll:true});});
  // Pointer capture keeps mouse and touch drags bounded to the tabletop.
  document.addEventListener('pointerdown',event=>{
    if(event.button!==0||state?.phase!=='serving')return;
    const el=event.target.closest('[data-paper]');if(!el)return;
    raise(el.dataset.paper);
    const handle=event.target.closest('[data-drag]');if(!handle)return;
    event.preventDefault();const board=$('#workdesk').getBoundingClientRect(),rect=el.getBoundingClientRect();
    drag={id:el.dataset.paper,el,handle,pointer:event.pointerId,startX:event.clientX,startY:event.clientY,left:rect.left-board.left,top:rect.top-board.top,board,width:rect.width,height:rect.height,original:state.positions[el.dataset.paper],moved:false};
    handle.setPointerCapture(event.pointerId);el.classList.add('dragging');
  });
  document.addEventListener('pointermove',event=>{
    if(!drag||event.pointerId!==drag.pointer)return;
    const dx=event.clientX-drag.startX,dy=event.clientY-drag.startY;
    if(Math.abs(dx)+Math.abs(dy)>5)drag.moved=true;
    const x=Math.max(8,Math.min(drag.board.width-drag.width-8,drag.left+dx)),y=Math.max(8,Math.min(drag.board.height-drag.height-8,drag.top+dy));
    drag.el.style.left=x+'px';drag.el.style.top=y+'px';
    const zone=$('.handover-zone').getBoundingClientRect();$('.handover-zone').classList.toggle('over',event.clientX>=zone.left&&event.clientX<=zone.right&&event.clientY>=zone.top&&event.clientY<=zone.bottom);
  });
  function endDrag(event,cancel=false){
    if(!drag||event.pointerId!==drag.pointer)return;
    const current=drag;drag=null;current.el.classList.remove('dragging');$('.handover-zone')?.classList.remove('over');
    try{current.handle.releasePointerCapture(event.pointerId);}catch{}
    if(cancel){renderShift();announce('Перемещение отменено.');return;}
    if(current.moved){
      suppressClick=true;setTimeout(()=>{suppressClick=false;},0);
      const r=current.el.getBoundingClientRect(),b=current.board;
      state.positions[current.id]=E.position((r.left-b.left-8)/Math.max(1,b.width-r.width-16),(r.top-b.top-8)/Math.max(1,b.height-r.height-16));save();
      const zone=$('.handover-zone').getBoundingClientRect(),dropped=event.clientX>=zone.left&&event.clientX<=zone.right&&event.clientY>=zone.top&&event.clientY<=zone.bottom;
      if(dropped&&current.id!=='register'){
        if(state.intent){transition('give',current.id);if(state.phase==='serving')announce('Передача обработана. Проверьте оставшиеся предметы на столе.');}
        else {renderShift();announce('Сначала выберите «Выдать» или «Не выдать». Документ остаётся на столе.');}
      }else {renderShift();announce('Документ перемещён.');}
      main.querySelector(`[data-drag="${current.id}"]`)?.focus({preventScroll:true});
    }
  }
  document.addEventListener('pointerup',event=>endDrag(event));
  document.addEventListener('pointercancel',event=>endDrag(event,true));
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&drag){endDrag({pointerId:drag.pointer},true);return;}
    const handle=event.target.closest('[data-drag]');if(!handle||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Enter',' '].includes(event.key)||state?.phase!=='serving')return;
    event.preventDefault();const id=handle.dataset.drag,el=handle.closest('[data-paper]'),b=$('#workdesk').getBoundingClientRect(),r=el.getBoundingClientRect();let x=(r.left-b.left-8)/Math.max(1,b.width-r.width-16),y=(r.top-b.top-8)/Math.max(1,b.height-r.height-16);const step=event.shiftKey?.2:.07;
    if(event.key==='ArrowLeft')x-=step;if(event.key==='ArrowRight')x+=step;if(event.key==='ArrowUp')y-=step;if(event.key==='ArrowDown')y+=step;if(['Enter',' '].includes(event.key)){x=x>.5?0:1;y=y>.5?0:1;}
    state.positions[id]=E.position(x,y);state.focusPaper=id;save();renderShift();main.querySelector(`[data-drag="${id}"]`)?.focus({preventScroll:true});announce('Документ перемещён.');
  });
  window.addEventListener('hashchange',()=>{drag=null;render();window.scrollTo({top:0,behavior:'instant'});main.focus({preventScroll:true});});
  render();
})();
