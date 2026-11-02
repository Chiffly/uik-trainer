window.UikEngine = (() => {
  const draft=()=>({events:[],answers:{},intent:null,positions:{},selectedVoter:null,opened:[],focusPaper:'register',messages:[]});
  const fresh=(date=window.UikGameData.date)=>({version:4,date,index:0,phase:'serving',records:[],...draft()});
  const add=(s,event)=>s.phase==='serving'&&!s.events.includes(event)?{...s,events:[...s.events,event]}:s;
  const message=(s,who,text)=>({...s,messages:[...s.messages,{who,text}]});
  function act(s,v,action,value){
    if(s.phase!=='serving')return s;
    const has=e=>s.events.includes(e);
    if(action==='greet'&&!has('greet'))return message(message(add(s,'greet'),'you','Здравствуйте. Чем могу помочь?'),'visitor',v.intro);
    if(action==='request'&&has('greet')&&!has('request'))return message(message(message({...add(s,'request'),opened:[...s.opened,'document'],focusPaper:'document'},'you',v.replacement?'Покажите испорченный бюллетень, пожалуйста.':'Ваш паспорт, пожалуйста.'),'visitor',v.handover),'request',v.request.text);
    if(action==='ask'&&has('request')){const q=v.questions.find(q=>q.id===value);if(!q)return s;return message(message(add(s,'ask:'+value),'you',q.label),'visitor',q.answer);}
    if(action==='answer'&&has('request')&&v.request.answers.some(a=>a.id===value))return {...s,answers:{...s.answers,request:value}};
    if(action==='helper'&&v.helper&&has('request'))return message({...add(s,'helper'),opened:[...new Set([...s.opened,'helper'])],focusPaper:'helper'},'visitor','Дочь передала свой паспорт. Вот он.');
    if(action==='helper-check'&&v.helper&&has('helper')&&!has('helper-returned'))return add(s,'helper-check');
    if(action==='search'&&has('request'))return add(s,'search:'+String(value).trim().toLocaleLowerCase('ru'));
    if(action==='chair'&&has('request'))return message(message(add(s,'chair'),'you','Обратимся к председателю, чтобы уточнить список и основания включения.'),'visitor','Хорошо, подойду к председателю с паспортом.');
    if(action==='select'&&has('request'))return {...add(s,'list'),selectedVoter:value};
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
    if(action==='intent'&&has('request')&&['issue','decline'].includes(value)&&!has('ballot-given')&&!has('document-returned'))return {...s,intent:value,focusPaper:value==='issue'?'ballot':'document'};
    if(action==='give'&&s.intent){
      if(value==='ballot'&&s.intent==='issue')s=add(s,'ballot-given');
      else if(value==='document'&&(!v.replacement||s.intent==='decline'))s=add(s,'document-returned');
      else if(value==='helper'&&has('helper'))s=add(s,'helper-returned');
      else return s;
      const done=(s.intent==='decline'||s.events.includes('ballot-given'))&&(v.replacement&&s.intent==='issue'||s.events.includes('document-returned'))&&(!s.events.includes('helper')||s.events.includes('helper-returned'));
      if(done)return {...s,phase:'departed',records:[...s.records,{id:v.id,decision:s.intent,events:[...s.events],answers:{...s.answers},selectedVoter:s.selectedVoter,messages:s.messages}]};
      return s;
    }
    return s;
  }
  function next(s,total){if(s.phase!=='departed')return s;return s.index===total-1?{...s,phase:'complete'}:{...s,index:s.index+1,phase:'serving',...draft()};}
  function evaluate(r,v){
    const has=e=>r.events.includes(e),checks=[];
    const check=(label,ok,explanation)=>checks.push({label,ok,explanation});
    const outcomes={ordinary:'При подходящем паспорте и включении в список бюллетень выдаётся.',licence:'Водительское удостоверение не заменяет паспорт для голосования.',relative:'Документ принадлежит супруге. Голосовать и получать бюллетень за неё нельзя.',temporary:'Срок временного удостоверения истёк 31.10.2026. Учебная дата — 01.11.2026, другого действующего документа нет.',spoiled:'При первом обращении испорченный бюллетень можно заменить.',together:'Вопрос о совместном проходе в кабинку не отменяет право Андрея получить свой бюллетень.',assistance:'Необходимость помощи сама по себе не является основанием отказать в выдаче.'};
    check('Решение о выдаче',r.decision===v.expected,v.outcome||outcomes[v.id]||outcomes.ordinary);
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
    if(v.helper&&r.answers.request==='a'){
      check('Статус помощника',has('ask:helper'),'Уточните, не относится ли помощник к запрещённым категориям.');
      check('Документ помощника',has('helper')&&has('helper-check'),'В панели «Помощник» запросите паспорт, откройте «Осмотреть паспорт помощника» и после проверки нажмите «Документ проверен».');
      check('Запись помощника',has('helper-record:'+v.id),'Выберите запись избирателя в списке. Прямо в выбранной записи нажмите «Внести ФИО и реквизиты помощника в список».');
    }
    if(v.inList===false){check('Поиск в списке',r.events.some(e=>e.startsWith('search:')&&e.slice(7).includes(v.document.name.split(' ')[0].toLocaleLowerCase('ru'))),'Введите фамилию из паспорта в поиске списка и нажмите «Найти».');check('Уточнение списка',has('chair'),'При отсутствии записи используйте «Уточнить список у председателя». Это учебная передача вопроса комиссии, а не окончательный отказ в праве голосовать.');}
    return checks;
  }
  function results(s,visitors){if(s.phase!=='complete'||s.records.length!==visitors.length)return null;const rows=s.records.map((r,i)=>({record:r,visitor:visitors[i],checks:evaluate(r,visitors[i])}));return {rows,perfect:rows.filter(r=>r.checks.every(c=>c.ok)).length,errors:rows.reduce((n,r)=>n+r.checks.filter(c=>!c.ok).length,0),decisions:rows.filter(r=>r.checks[0].ok).length};}
  function restore(s,visitors){
    if(!s||s.version!==4||typeof s.date!=='string'||!/^\d{2}\.\d{2}\.\d{4}$/.test(s.date)||!Number.isInteger(s.index)||s.index<0||s.index>=visitors.length||!['serving','departed','complete'].includes(s.phase)||!Array.isArray(s.events)||!s.events.every(e=>typeof e==='string')||!Array.isArray(s.records)||s.records.length!==(s.phase==='serving'?s.index:s.index+1)||s.phase==='complete'&&s.index!==visitors.length-1)return null;
    if(!s.answers||typeof s.answers!=='object'||!Array.isArray(s.messages)||!Array.isArray(s.opened)||!s.positions||typeof s.positions!=='object'||![null,'issue','decline'].includes(s.intent))return null;
    if(s.records.some((r,i)=>!r||r.id!==visitors[i].id||!['issue','decline'].includes(r.decision)||!Array.isArray(r.events)||!r.events.every(e=>typeof e==='string')||!r.answers||!Array.isArray(r.messages)))return null;
    return s;
  }
  const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));
  const position=(x,y)=>({x:clamp(Number(x)||0,0,1),y:clamp(Number(y)||0,0,1)});
  return {fresh,add,message,act,next,evaluate,results,restore,position};
})();
