window.UikEngine = (() => {
  const draft=()=>({book:'main',searchText:'',events:[],answers:{},intent:null,positions:{},selectedVoter:null,opened:[],focusPaper:'register',messages:[]});
  const fresh=(date=window.UikGameData.date,edition=0)=>({version:5,date,edition,index:0,phase:'serving',records:[],...draft()});
  function dossier(v,edition=0) {
    if(!v.review)return null;
    const step=(id,label,text)=>({id,label,text});
    let steps=[], admitted=true;
    if(v.review==='correction'){
      steps=[
        step('address','Проверить адрес участка','Границы учебной УИК № 101 · ул. Учебная, дома 8–22. Адрес в паспорте относится к этому участку.'),
        step('petition','Принять заявление об исправлении','Заявление Романова Д. И. принято. Указаны адрес и пропуск записи.'),
        step('reply','Запросить сведения через председателя','Проверка завершена. Адрес подтверждён, заявление о голосовании на другом участке отсутствует, бюллетень не выдавался.'),
        step('decision','Получить решение УИК','Решение УИК · устранить пропуск и включить Дениса Романова в список. Строка доступна для оформления выдачи.')
      ];
    } else if(v.review==='chosen'){
      admitted=edition%2===0;
      steps=[step('notice','Сверить уведомление с участком','Уведомление УЧ-147 · Корнеева Елена Олеговна · выбранный участок № 101, Ярославль.'),
        step('registry','Проверить реестр неучтённых заявлений',admitted?'Записи УЧ-147 в реестре неучтённых заявлений нет.':'УЧ-147 есть в реестре неучтённых заявлений. Причина: заявление аннулировано.')];
      if(admitted)steps.push(step('reply','Запросить проверку через ТИК','Ответ ТИК · заявление на этот участок подтверждено. Сведения ошибочно пропущены в дополнительном листе.'));
      steps.push(step('decision','Получить решение УИК',admitted?'УИК решила включить Елену Корнееву в список на выбранном участке. Строка добавлена.':'УИК отказала во включении по аннулированному заявлению. Заверенная копия решения готова.'));
    } else if(v.review==='home'){
      admitted=edition%3===0;
      const report=['Бюллетень в Угличе не выдавался. Участок по месту нахождения готов оформить исключение.','По данным УИК Углича, бюллетень на выборах губернатора уже получен.','До окончания голосования ответ с выбранного участка не поступил.'][edition%3];
      steps=[step('registry','Открыть реестр исключений','Наумов Олег Львович · исключён по заявлению. Выбранный участок в Угличе.'),
        step('petition','Принять бумажное заявление','Наумов подписал личное заявление о включении в список по месту жительства.'),
        step('reply','Проверить выдачу на выбранном участке',report),
        step('decision','Получить решение УИК',admitted?'УИК оформили включение по месту жительства и исключение по месту нахождения. Новая строка доступна.':'УИК отказала во включении по месту жительства. Причина указана в решении.')];
    }
    if(!admitted)steps.push(step('copy','Вручить заверенную копию','Копия вручена. Решение можно обжаловать в вышестоящую комиссию или суд.'));
    return {admitted,steps};
  }
  function entryAvailable(s,v){
    return v.inList!==false || !!(v.review && dossier(v,s.edition).admitted && s.events.includes('case:decision'));
  }
  const add=(s,event)=>s.phase==='serving'&&!s.events.includes(event)?{...s,events:[...s.events,event]}:s;
  const message=(s,who,text)=>({...s,messages:[...s.messages,{who,text}]});
  function act(s,v,action,value){
    if(s.phase!=='serving')return s;
    const has=e=>s.events.includes(e);
    if(action==='case-step' && v.review && has('request')){
      const steps=dossier(v,s.edition).steps;
      const nextStep=steps.find(step=>!has('case:'+step.id));
      const surname=v.document.name.split(' ')[0].toLocaleLowerCase('ru');
      if(!has('search:'+surname) && !s.events.some(e=>e.startsWith('search:')&&e.slice(7).includes(surname)))return s;
      if(value!==nextStep?.id)return s;
      return add(s,'case:'+value);
    }
    if(action==='certificate' && v.certificate && s.selectedVoter===v.id)return add(s,'certificate');
    if(action==='choose-helper' && v.helper && s.answers.request===v.request.correct && !has('choose-helper'))
      return message(add(s,'choose-helper'),'visitor','Тогда я выберу мою дочь Марию. Она рядом.');
    if(action==='greet'&&!has('greet'))return message(message(add(s,'greet'),'you','Здравствуйте. Чем могу помочь?'),'visitor',v.intro);
    if(action==='request'&&has('greet')&&!has('request'))return message(message(message({...add(s,'request'),opened:[...s.opened,'document'],focusPaper:'document'},'you',v.replacement?'Покажите испорченный бюллетень, пожалуйста.':'Ваш паспорт, пожалуйста.'),'visitor',v.handover),'request',v.request.text);
    if(action==='ask'&&has('request')){const q=v.questions.find(q=>q.id===value);if(!q)return s;return message(message(add(s,'ask:'+value),'you',q.label),'visitor',q.answer);}
    if(action==='answer'&&has('request')&&v.request.answers.some(a=>a.id===value))return {...s,answers:{...s.answers,request:value}};
    if(action==='helper'&&v.helper&&has('choose-helper')&&has('ask:helper')&&!has('helper'))return message({...add(s,'helper'),opened:[...new Set([...s.opened,'helper'])],focusPaper:'helper'},'visitor','Дочь передала свой паспорт. Вот он.');
    if(action==='helper-check'&&v.helper&&has('helper')&&!has('helper-returned'))return add(s,'helper-check');
    if(action==='search'&&has('request'))return add(s,'search:'+String(value).trim().toLocaleLowerCase('ru'));
    if(action==='chair'&&has('request'))return message(message(add(s,'chair'),'you','Обратимся к председателю, чтобы уточнить список и основания включения.'),'visitor','Хорошо, подойду к председателю с паспортом.');
    if(action==='select'&&has('request')){
      const target=window.UikGameData.visitors.find(person=>person.id===value);
      if(!target || !(target.inList!==false || (v.id===value && entryAvailable(s,v))))return s;
      return {...add(s,'list'),selectedVoter:value};
    }
    if(['record','voter-sign','member-sign','replacement-note','helper-record'].includes(action)&&has('request')&&s.selectedVoter){
      if(action==='helper-record'&&(!v.helper||!has('helper-check')))return s;
      if(action==='replacement-note'&&!v.replacement)return s;
      if(action==='voter-sign'&&!has('record:'+s.selectedVoter))return s;
      if(action==='member-sign'&&!has('voter-sign:'+s.selectedVoter))return s;
      let next=add(s,action+':'+s.selectedVoter);
      if(action==='voter-sign')next=message(message(next,'you','Проверьте запись и распишитесь в получении бюллетеня.'),'visitor',v.id==='relative'?'Хорошо, я за жену распишусь.':'Всё верно, расписываюсь.');
      return next;
    }
    if(['spoiled-note','secretary-sign','cancel-spoiled'].includes(action)&&v.replacement&&has('request')){
      if(action==='secretary-sign'&&!has('spoiled-note'))return s;
      if(action==='cancel-spoiled'&&(!has('spoiled-note')||!has('secretary-sign')))return s;
      return add(s,action);
    }
    if(action==='intent'&&has('request')&&['issue','decline'].includes(value)&&!has('ballot-given')&&!has('document-returned')){
      if(v.review&&!dossier(v,s.edition).steps.every(step=>has('case:'+step.id)))return s;
      return {...s,intent:value,focusPaper:value==='issue'?'ballot':'document'};
    }
    if(action==='give'&&s.intent){
      if(value==='ballot'&&s.intent==='issue')s=add(s,'ballot-given');
      else if(value==='document'&&(!v.replacement||s.intent==='decline'))s=add(s,'document-returned');
      else if(value==='helper'&&has('helper'))s=add(s,'helper-returned');
      else return s;
      const done=(s.intent==='decline'||s.events.includes('ballot-given'))&&(v.replacement&&s.intent==='issue'||s.events.includes('document-returned'))&&(!s.events.includes('helper')||s.events.includes('helper-returned'));
      if(done)return {...s,phase:'departed',records:[...s.records,{id:v.id,edition:s.edition,decision:s.intent,events:[...s.events],answers:{...s.answers},selectedVoter:s.selectedVoter,messages:s.messages}]};
      return s;
    }
    return s;
  }
  function next(s,total){if(s.phase!=='departed')return s;return s.index===total-1?{...s,phase:'complete'}:{...s,index:s.index+1,phase:'serving',...draft()};}
  function evaluate(r,v){
    const has=e=>r.events.includes(e),checks=[];
    const check=(label,ok,explanation)=>checks.push({label,ok,explanation});
    const outcomes={ordinary:'При подходящем паспорте и включении в список бюллетень выдаётся.',licence:'Водительское удостоверение не заменяет паспорт для голосования.',relative:'Документ принадлежит супруге. Голосовать и получать бюллетень за неё нельзя.',temporary:'Срок временного удостоверения истёк 31.10.2026. Учебная дата — 01.11.2026, другого действующего документа нет.',spoiled:'При первом обращении испорченный бюллетень можно заменить.',together:'Вопрос о совместном проходе в кабинку не отменяет право Андрея получить свой бюллетень.',assistance:'Необходимость помощи сама по себе не является основанием отказать в выдаче.'};
    const review=dossier(v,r.edition);
    const expected=review?(review.admitted?'issue':'decline'):v.expected;
    const decisionText=review?review.steps.find(step=>step.id==='decision').text:v.outcome;
    check('Решение о выдаче',r.decision===expected,decisionText||outcomes[v.id]||outcomes.ordinary);
    check('Ответ посетителю',r.answers.request===v.request.correct,v.request.explanation);
    if(r.decision==='issue'){
      check('Запись в списке',r.selectedVoter===v.id,'Оформлять выдачу следует в записи того избирателя, которому выдаётся бюллетень.');
      if(v.replacement){
        check('Отметка о замене',has('replacement-note:'+v.id),'Найдите запись избирателя в списке, затем прямо в списке нажмите «Отметить выдачу взамен испорченного».');
        check('Оформление испорченного',has('spoiled-note')&&has('secretary-sign'),'На испорченном бюллетене сделайте запись и подпишите её, затем передайте секретарю на подпись.');
        check('Погашение',has('cancel-spoiled'),'После обеих подписей нажмите «Погасить бюллетень» на самом испорченном бюллетене.');
      }else{
        check('Реквизиты документа',has('record:'+v.id),'В выбранной записи должны быть реквизиты предъявленного документа.');
        check('Подпись избирателя',has('voter-sign:'+v.id),'Избиратель проверяет запись и расписывается в получении.');
        check('Подпись члена УИК',has('member-sign:'+v.id),'Член УИК, выдавший бюллетень, также расписывается в списке.');
      }
    }else check('Отсутствие ложной отметки',!r.events.some(e=>/^(voter-sign|member-sign|replacement-note):/.test(e)||['spoiled-note','secretary-sign','cancel-spoiled'].includes(e)),'Если бюллетень не выдан, подписи о получении и замену не оформляют.');
    if(v.helper){
      check('Выбор помощника',has('choose-helper'),'Избиратель выбирает дочь после вашего ответа на предложение наблюдателя.');
      check('Статус помощника',has('ask:helper'),'Уточните, не относится ли помощник к запрещённым категориям.');
      check('Документ помощника',has('helper')&&has('helper-check'),'В панели «Помощник» запросите паспорт, откройте «Осмотреть паспорт помощника» и после проверки нажмите «Документ проверен».');
      check('Запись помощника',has('helper-record:'+v.id),'Выберите запись избирателя в списке. Прямо в выбранной записи нажмите «Внести ФИО и реквизиты помощника в список».');
    }
    if(review)for(const step of review.steps)check(step.label,has('case:'+step.id),step.text);
    if(v.requiredQuestion){
      const q=v.questions.find(item=>item.id===v.requiredQuestion);
      check('Уточнение обстоятельств',has('ask:'+q.id),q.label+' '+q.answer);
    }
    if(v.certificate)check('Проверка свидетельства',has('certificate'),'Откройте свидетельство из строки с особой отметкой и сверьте дату регистрации с контрольной датой.');
    return checks;
  }
  function results(s,visitors){if(s.phase!=='complete'||s.records.length!==visitors.length)return null;const rows=s.records.map((r,i)=>({record:r,visitor:visitors[i],checks:evaluate(r,visitors[i])}));return {rows,perfect:rows.filter(r=>r.checks.every(c=>c.ok)).length,errors:rows.reduce((n,r)=>n+r.checks.filter(c=>!c.ok).length,0),decisions:rows.filter(r=>r.checks[0].ok).length};}
  function restore(s,visitors){
    if(!s||s.version!==5||!Number.isInteger(s.edition)||s.edition<0||typeof s.date!=='string'||!/^\d{2}\.\d{2}\.\d{4}$/.test(s.date)||!Number.isInteger(s.index)||s.index<0||s.index>=visitors.length||!['serving','departed','complete'].includes(s.phase)||!Array.isArray(s.events)||!s.events.every(e=>typeof e==='string')||!Array.isArray(s.records)||s.records.length!==(s.phase==='serving'?s.index:s.index+1)||s.phase==='complete'&&s.index!==visitors.length-1)return null;
    if(!s.answers||typeof s.answers!=='object'||!Array.isArray(s.messages)||!Array.isArray(s.opened)||!s.positions||typeof s.positions!=='object'||![null,'issue','decline'].includes(s.intent))return null;
    if(s.records.some((r,i)=>!r||r.id!==visitors[i].id||!['issue','decline'].includes(r.decision)||!Array.isArray(r.events)||!r.events.every(e=>typeof e==='string')||!r.answers||!Array.isArray(r.messages)))return null;
    return s;
  }
  const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));
  const position=(x,y)=>({x:clamp(Number(x)||0,0,1),y:clamp(Number(y)||0,0,1)});
  return {fresh,add,message,act,next,evaluate,results,restore,position,dossier,entryAvailable};
})();
