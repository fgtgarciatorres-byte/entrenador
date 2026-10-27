/* Cancha + Entrenador Suplente: club workflow and ChatGPT audio monitor. */
(() => {
  'use strict';
  window.canchaUnifiedActive = true;

  const KEY = 'canchaUnified-v1';
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const stamp = () => new Date().toLocaleString('es-ES', {dateStyle:'short', timeStyle:'short'});
  const blankState = {team:'Canterbury School', category:'Cadete A Femenina · Competición Autonómica · FCB 2026/27', coach:'Entrenador/a', nextOpponent:'Cajasiete Fundación CB Canarias', nextMatchDate:'2026-11-01', reports:[], sessionNotes:[], escalations:[], players:{}, reviewedCourses:[]};
  let app = readState();
  let pilot = null;
  let rivalScout = null;
  let recognition = null;
  let capture = null;
  let audioContext = null;
  let animation = 0;
  let lastAnswer = null;

  function readState(){
    try { return {...blankState, ...(JSON.parse(localStorage.getItem(KEY) || 'null') || {})}; }
    catch { return {...blankState}; }
  }
  function persist(){ localStorage.setItem(KEY, JSON.stringify(app)); }
  function toastPlus(message){
    const node = $('#assistantHint');
    if (node) node.textContent = message;
  }
  function addVoiceControls(){
    const card = $('.voice-card');
    if (!card || $('#shareChatAudio')) return;
    card.insertAdjacentHTML('beforeend', `<details class="chat-audio-controls"><summary>Monitor externo de audio (opcional)</summary><div class="chat-audio-inner"><button class="outline-btn" id="shareChatAudio" type="button">Compartir audio de otra pestaña</button><button class="outline-btn" id="stopChatAudio" type="button" disabled>Detener audio</button><div class="audio-monitor" id="audioMonitor" aria-label="Indicador de nivel de audio"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div><small id="chatAudioStatus">Solo se usa si ya tienes audio abierto en otra pestaña.</small></div></details>`);
    $('#shareChatAudio').onclick = startChatAudio;
    $('#stopChatAudio').onclick = stopChatAudio;
  }
  function mount(){
    if ($('#chatgptBtn')) { $('#chatgptBtn').textContent = 'Copiar contexto'; $('#chatgptBtn').title = 'Opcional: copiar los datos para usarlos en otro agente. No se abre otra página.'; }
    if ($('#copyPrompt')) $('#copyPrompt').textContent = 'Copiar contexto del equipo';
    if ($('#saveSessionNote')) $('#saveSessionNote').textContent = 'Guardar nota en Cancha';
    if ($('#notesMount h3')) $('#notesMount h3').textContent = 'Nota de sesión redactada por Cancha';
    if ($('#notesMount article p')) $('#notesMount article p').textContent = 'Cancha puede generar una propuesta desde la consulta y los datos locales. Revísala antes de guardarla o compartirla.';
    if ($('#copyNoteFormat')) $('#copyNoteFormat').textContent = 'Copiar plantilla (opcional)';
    $('#view-equipo .team-layout')?.insertAdjacentHTML('afterend', `<article class="panel player-fiche-panel"><div class="panel-title"><div><span class="eyebrow">SEGUIMIENTO INDIVIDUAL</span><h3>Ficha por dorsal</h3></div><span class="tag">Revisión del entrenador</span></div><div class="unified-form"><label>Dorsal <select id="ficheDorsal"><option value="">Selecciona dorsal</option></select></label><label>Objetivo individual <input id="ficheGoal" placeholder="Conducta o habilidad entrenable"></label><label class="wide">Dato u observación que lo sustenta <textarea id="ficheObservation" placeholder="Fecha, partido o situación observable"></textarea></label><label class="wide">Recomendación del agente revisada <textarea id="ficheRecommendation" placeholder="Tarea, conversación y cómo revisar si ayuda"></textarea></label><div class="wide form-actions"><button id="savePlayerFiche" class="primary-btn" type="button">Guardar ficha</button><button id="exportPlayerFiches" class="outline-btn" type="button">Exportar fichas</button></div></div><div id="playerFicheList" class="compact-list"></div></article>`);
    $('#view-analisis .table-panel')?.insertAdjacentHTML('afterend', `<article class="panel weekly-report-panel"><div class="panel-title"><div><span class="eyebrow">BORRADOR PARA REVISIÓN</span><h3>Preparación semanal</h3></div><span class="tag">Con datos disponibles</span></div><div class="unified-form weekly-controls"><label>Próximo rival <input id="nextRivalInput" placeholder="Pendiente de confirmar"></label><label>Fecha <input id="nextRivalDate" type="date"></label><div class="form-actions"><button class="primary-btn" id="saveNextMatch" type="button">Guardar partido</button><button class="outline-btn" id="makeWeeklyReport" type="button">Generar borrador</button></div></div><div id="weeklyReport" class="weekly-report-body"><p class="empty-state">Completa el rival y la fecha desde el calendario oficial para preparar el informe.</p></div></article>`);
    $('#matchFormMount').innerHTML = `<div class="unified-grid"><article class="panel"><h3>Datos del encuentro</h3><div class="unified-form">
      <label>Fecha <input id="matchDate" type="date"></label><label>Rival <input id="matchOpponent" placeholder="Nombre del equipo rival"></label>
      <label>Competición y jornada <input id="matchCompetition" value="Cadete Femenina Autonómica"></label><label>Localía <select id="matchVenue"><option>Local</option><option>Visitante</option></select></label>
      <label>Marcador final <input id="matchScore" placeholder="Ej. 64-52"></label><label>Parciales <input id="matchQuarters" placeholder="Ej. 18-12 / 14-16 / …"></label>
      <label class="wide">Observaciones del partido <textarea id="matchObservation" placeholder="Hechos observables: defensa rival, pérdidas, rebote, decisiones que funcionaron…"></textarea></label>
      <label class="wide">Estadísticas del equipo <textarea id="matchTeamStats" placeholder="Tiros, pérdidas, rebotes, faltas u otros datos disponibles"></textarea></label>
      <label class="wide">Estadísticas o patrones del rival <textarea id="matchOpponentStats" placeholder="Indica la fuente o marca que son observaciones propias"></textarea></label>
      <label class="wide">Adjuntar CSV, texto o JSON <input id="matchFile" type="file" accept=".csv,.txt,.json,.md"></label>
      <div class="wide form-actions"><button class="primary-btn" id="saveMatchReport" type="button">Guardar parte</button><button class="outline-btn" id="exportMatchReports" type="button">Exportar partes</button></div>
    </div><p class="privacy-note">Se guardan en este navegador. No añadas nombres ni información familiar o clínica de menores.</p></article><article class="panel"><h3>Partes guardados</h3><div id="matchReportList" class="compact-list"></div></article></div>`;
    $('#notesMount').innerHTML = `<div class="unified-grid"><article class="panel"><h3>Nota redactada por ChatGPT</h3><p>Pide a ChatGPT una nota estructurada al terminar una consulta; pega el borrador aquí y revísalo antes de guardarlo.</p><div class="unified-form">
      <label>Título <input id="sessionTitle" placeholder="Situación o acuerdo"></label><label>Tipo <select id="sessionType"><option value="entrenamiento">Entrenamiento</option><option value="clima">Clima y convivencia</option><option value="formacion">Necesidad de formación</option><option value="proteccion">Protección y buen trato</option><option value="especialista">Valorar apoyo especializado</option><option value="familias">Comunicación con familias</option></select></label>
      <label>Prioridad <select id="sessionPriority"><option value="baja">Baja</option><option value="media">Media</option><option value="alta">Alta · revisión prioritaria</option></select></label>
      <label class="wide">Nota y siguiente acción <textarea id="sessionBody" placeholder="Hecho observable:\nPauta acordada:\nPróxima comprobación:\nFuente o base:"></textarea></label>
      <label class="wide check-row"><input id="escalateSession" type="checkbox"> Compartir resumen con coordinación</label>
      <div class="wide form-actions"><button class="primary-btn" id="saveSessionNote" type="button">Guardar nota revisada</button><button class="outline-btn" id="copyNoteFormat" type="button">Copiar formato para ChatGPT</button></div>
    </div></article><article class="panel"><h3>Historial de notas</h3><div id="sessionNoteList" class="compact-list"></div></article></div>`;
    $('#managerMount').innerHTML = `<div class="metrics-strip"><div class="metric"><span>Elevaciones abiertas</span><strong id="escalationCount">0</strong></div><div class="metric"><span>Formación solicitada</span><strong id="formationCount">0</strong></div><div class="metric"><span>Apoyo especializado a valorar</span><strong id="specialistCount">0</strong></div></div><article class="panel"><h3>Notas compartidas por el entrenador</h3><p>El registro ayuda a priorizar formación y apoyo. No diagnostica ni sustituye los protocolos del club.</p><div id="escalationList" class="compact-list"></div></article>`;
    $('#sourcesMount').innerHTML = `<div class="unified-grid"><article class="panel source-card"><h3>Competición y resultados</h3><p>Fuente estadística principal del piloto. Confirma categoría, grupo, fecha de consulta y si el acta está completa.</p><a href="https://gesdeportiva.fcbaloncesto.es/competiciones-6/FederacionCanaria" target="_blank" rel="noreferrer">Abrir Gesdeportiva FCB ↗</a><p class="source-state" id="gesdeportivaStatus">Datos locales de Canterbury cargados; consulta automática de Gesdeportiva pendiente.</p></article><article class="panel source-card"><h3>Normativa FCB</h3><p>Verifica la temporada y la competición. Si el documento aplicable no está disponible, el agente debe indicarlo.</p><a href="https://fcbaloncesto.es/normativa-competicion/" target="_blank" rel="noreferrer">Normativa de competición ↗</a></article><article class="panel source-card"><h3>Metodología de baloncesto</h3><p>Usa principios WABC/FIBA como referencias de enseñanza. Ajusta las tareas a la edad y a lo entrenado.</p><a href="https://about.fiba.basketball/en/wabc-documents" target="_blank" rel="noreferrer">Documentos WABC/FIBA ↗</a></article><article class="panel source-card"><h3>Psicología y comunicación</h3><p>Orientación educativa, no terapia. Prioriza bienestar, pertenencia y buen trato; consulta a coordinación ante riesgos.</p><a href="./docs/FUENTES_PSICOLOGIA_DEPORTIVA.md" target="_blank" rel="noreferrer">Dossier de psicología del proyecto ↗</a><a href="./docs/FUENTES_COMUNICACION_FAMILIAS.md" target="_blank" rel="noreferrer">Dossier de comunicación con familias ↗</a></article></div><article class="panel"><h3>Criterios del agente</h3><ul class="criteria-list"><li>Separa dato registrado, patrón, hipótesis y recomendación.</li><li>Cita fuente, fecha y cobertura; no inventa resultados ni normativa.</li><li>Analiza equipos rivales con datos públicos y suficientes; no etiqueta menores.</li><li>Las estrategias se entrenan antes de recomendarlas para el partido.</li><li>Ofrece apoyo educativo y comunicación respetuosa; no diagnostica ni hace terapia.</li><li>Ante posible violencia, abuso, discriminación o riesgo, prioriza el protocolo de protección del club.</li></ul></article>`;
    $('#sourcesMount').insertAdjacentHTML('beforeend', `<article class="panel source-card"><h3>Dossieres y criterios integrados</h3><a href="./docs/FUENTES_ESTRATEGIA_BALONCESTO.md" target="_blank" rel="noreferrer">Estrategia de baloncesto ↗</a><a href="./docs/FUENTES_FCB.md" target="_blank" rel="noreferrer">Normativa FCB ↗</a><a href="./docs/FUENTES_PSICOLOGIA_DEPORTIVA.md" target="_blank" rel="noreferrer">Psicología deportiva ↗</a><a href="./docs/FUENTES_COMUNICACION_FAMILIAS.md" target="_blank" rel="noreferrer">Comunicación con familias ↗</a><a href="./docs/CRITERIOS_AGENTE.md" target="_blank" rel="noreferrer">Instrucciones completas del agente ↗</a></article>`);
    const reportInput = $('#matchFile');
    $('#saveMatchReport').onclick = saveMatchReport;
    $('#exportMatchReports').onclick = exportReports;
    $('#saveSessionNote').onclick = saveSessionNote;
    $('#savePlayerFiche').onclick = savePlayerFiche;
    $('#exportPlayerFiches').onclick = exportPlayerFiches;
    $('#saveNextMatch').onclick = saveNextMatch;
    $('#makeWeeklyReport').textContent = 'Actualizar informe';
    $('#makeWeeklyReport').onclick = makeWeeklyReport;
    $('#copyNoteFormat').onclick = async () => { await copyText(noteTemplate()); toastPlus('Formato de nota copiado'); };
    $('#exportData').onclick = exportAll;
    $('#importData').onchange = importAll;
    $('#resetData').textContent = 'Restaurar copia de seguridad';
    $('#resetData').onclick = restoreBackup;
    if ($('#chatgptBtn')) $('#chatgptBtn').onclick = () => sendToChatGPT('');
    $('#copyPrompt').onclick = () => sendToChatGPT('');
    $('#sendPrompt').onclick = () => answerInApp($('#promptInput').value.trim());
    $('#promptInput').onkeydown = e => { if (e.key === 'Enter') answerInApp($('#promptInput').value.trim()); };
    $('#closeAssistantAnswer').onclick = () => { $('#assistantAnswer').hidden = true; };
    $('#saveAnswerNote').onclick = saveAnswerAsNote;
    $('#copyAnswerContext').onclick = () => sendToChatGPT($('#promptInput').value.trim());
    $('#voiceBtn').onclick = listenAndSend;
    $('#voiceBtn2').onclick = listenAndSend;
    $$('[data-prompt]').forEach(button => button.onclick = () => answerInApp(button.dataset.prompt));
    $$('[data-view-target]').forEach(button => button.onclick = () => navigatePlus(button.dataset.viewTarget));
    $$('[data-view]').forEach(button => button.onclick = () => navigatePlus(button.dataset.view));
    if (reportInput) reportInput.value = '';
    addVoiceControls();
    loadPilotData();
    renderAll();
  }
  async function loadPilotData(){
    try {
      const response = await fetch('./data/club-stats.json?refresh=20261030', {cache:'no-store'});
      if (!response.ok) throw new Error('No se pudo leer el archivo local');
      pilot = await response.json();
      app.team = pilot.team || blankState.team;
      app.category = pilot.competition || blankState.category;
      if (pilot.nextMatch) {
        app.nextOpponent = pilot.nextMatch.opponent;
        app.nextMatchDate = pilot.nextMatch.date;
      }
      state.teamName = app.team;
      state.nextOpponent = app.nextOpponent;
      const dorsals = [...new Set((pilot.playerSignals || []).map(p => Number(p.dorsal)).filter(n => n > 0))].sort((a,b)=>a-b);
      if (dorsals.length) state.players = dorsals;
      state.matches = (pilot.documentedMatches || []).map((m, i) => ({date:m.date || `Acta detallada ${i + 1}`,opponent:m.opponent,score:`${m.for}–${m.against}`,result:m.result,read:m.source ? `Estadística local importada · ${m.source}` : 'Estadística local importada; fecha exacta pendiente de asociar.'}));
      save();
      renderMatches();
      renderRoster();
      renderClubStats();
      const source = $('#dataSource');
      if (source) source.textContent = `Fuente local: ${pilot.sourceFiles?.join(', ')} · clasificación ${pilot.classification?.played ?? '—'} partidos · acta detallada ${pilot.documentedMatches?.length ?? 0} partidos · confirmar vigencia`;
      const status = $('#gesdeportivaStatus');
      if (status) status.textContent = `Datos cargados de archivos locales (${pilot.documentedMatches?.length ?? 0} actas detalladas). Gesdeportiva se consulta manualmente; no hay sincronización automática.`;
    } catch (error) {
      pilot = null;
      const status = $('#dataSource');
      if (status) status.textContent = 'Sin datos locales. Importa resultados del equipo y comprueba la fuente.';
    }
    try {
      const response = await fetch('./data/cajasiete-scout.json?refresh=20261037', {cache:'no-store'});
      if (response.ok) rivalScout = await response.json();
    } catch { rivalScout = null; }
    if (rivalScout) app.nextOpponent = rivalScout.team;
    const rivalPlans = $('#trainingPlans');
    if (rivalScout && rivalPlans) rivalPlans.innerHTML = (rivalScout.trainingPlan || []).map(p => `<article class="training-plan"><div class="training-plan-top"><h4>${esc(p.title)}</h4><span>${esc(p.duration)}</span></div><p>${esc(p.evidence)}</p><ul>${p.blocks.map(b=>`<li>${esc(b)}</li>`).join('')}</ul></article>`).join('');
    const scope = $('#trainingScope'); if (scope && rivalScout) scope.textContent = `${rivalScout.team} · ${rivalScout.matches.length} actas locales · datos colectivos incompletos`;
    if (rivalScout) {
      const source = $('#dataSource');
      if (source) source.textContent += rivalScout.matches.length ? ` · Rival: ${rivalScout.team}, ${rivalScout.matches.length} acta(s) disponible(s).` : ` · Rival: ${rivalScout.team}; sin acta estadística cargada.`;
      persist();
    }
    renderAll();
    makeWeeklyReport();
  }
  function navigatePlus(view){
    $$('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.view === view));
    $$('.view').forEach(v => v.classList.toggle('active', v.id === `view-${view}`));
    const titles = {inicio:'Panel del entrenador',equipo:'Seguimiento por dorsal',analisis:'Evolución y preparación semanal',partido:'Parte de partido',notas:'Notas de sesión',gestor:'Coordinación del club',formacion:'Formación para entrenadores',fuentes:'Fuentes y criterios'};
    $('#pageTitle').textContent = titles[view] || titles.inicio;
    window.scrollTo({top:0,behavior:'smooth'});
    if (view === 'notas') renderNotes();
    if (view === 'gestor') renderManager();
    if (view === 'partido') renderReports();
  }
  function noteTemplate(){
    return `Al terminar esta consulta, devuelve una nota breve para guardar en Cancha. No incluyas nombres completos ni datos clínicos.\n\nNOTA DE SESIÓN\nTítulo: [situación]\nTipo: [entrenamiento | clima | formación | protección | especialista | familias]\nPrioridad: [baja | media | alta]\nHecho observable: [hecho, sin diagnóstico]\nPauta acordada: [acción]\nPróxima comprobación: [qué y cuándo]\nFuente o base: [dato, observación o recurso]\n\nSi aparece riesgo para un menor, indica que debe activarse el protocolo de protección del club.`;
  }
  function contextForChatGPT(question=''){
    const matches = (state.matches || []).map(m => `${m.date} · ${m.opponent} · ${m.score} · ${m.read}`).join('\n') || 'No hay partes de partido registrados.';
    const reports = app.reports.map(r => `${r.date} · ${r.opponent} · ${r.score || 'sin marcador'} · ${r.observation || 'sin observaciones'}`).join('\n') || 'Sin observaciones propias guardadas.';
    const notes = app.sessionNotes.slice(0,12).map(n => `${n.date} · ${n.type}/${n.priority} · ${n.title}: ${n.body}`).join('\n') || 'Sin notas de sesión.';
    const playerLines = Object.entries(app.players).map(([d,p]) => `Dorsal #${d}: ${p.goal || 'sin objetivo'}; observación: ${p.observation || 'sin observación'}; recomendación revisada: ${p.recommendation || 'pendiente'}`).join('\n') || 'Sin seguimiento individual.';
    const rivalContext = rivalScout ? `\nSCOUTING ${rivalScout.team}: ${rivalScout.matches.map(r=>`${r.date || 'fecha no indicada'} · ${r.opponent} ${r.teamPoints}-${r.opponentPoints}`).join('; ')}. Referencias anotadoras del acta: ${rivalScout.signalsToVerify.map(s=>`#${s.dorsal} ${s.points} puntos`).join(', ')}. Rebotes, asistencias, recuperaciones y pérdidas no disponibles; los porcentajes de tiro de campo son incompletos. Fuentes: ${rivalScout.sourceFiles.join(', ')}.` : '\nSin datos de scouting del rival.';
    const statContext = (pilot ? `\nDatos de equipo disponibles: clasificación ${pilot.classification?.rank ?? '—'}º, ${pilot.classification?.wins ?? '—'} victorias, ${pilot.classification?.losses ?? '—'} derrotas, ${pilot.classification?.played ?? '—'} partidos. Hay ${pilot.documentedMatches?.length ?? 0} partidos con estadísticas detalladas. No extrapoles las señales individuales a una valoración permanente.` : '') + rivalContext;
    return `Eres el asistente de Cancha para el equipo ${app.team}, ${app.category}. Habla en español claro, con acciones concretas y adecuadas a la edad.\n\nCRITERIOS DE TRABAJO\n- Distingue dato comprobado, patrón, hipótesis y recomendación. Cita origen, fecha y límites de la muestra.\n- Revisa evolución del equipo, rivales y próximo partido cuando haya datos; nunca inventes estadísticas, actas ni normativa.\n- Propón tareas de entrenamiento para conceptos ya enseñados o que se puedan practicar antes del partido.\n- Usa normas oficiales FCB de la temporada y categoría. Si no tienes el documento aplicable, dilo.\n- Para jugadores propios usa únicamente dorsales y observaciones/estadísticas necesarias. No etiquetes ni diagnostiques menores. Para rivales prioriza patrones colectivos y datos públicos.\n- Ofrece pautas educativas de psicología deportiva y comunicación con familias; no hagas terapia. Ante posible abuso, violencia, discriminación o riesgo, prioriza el protocolo de protección del club y la persona delegada.\n- Cuando una consulta genere una pauta o acuerdo, termina con el bloque NOTA DE SESIÓN listo para que el entrenador lo revise y guarde.\n\nEQUIPO: ${app.team}\nCATEGORÍA: ${app.category}\nPRÓXIMO RIVAL: ${app.nextOpponent || 'pendiente de confirmar'}\nFECHA PRÓXIMO PARTIDO: ${app.nextMatchDate || 'pendiente de confirmar'}\n\nRESULTADOS ESTADÍSTICOS CARGADOS:\n${matches}${statContext}\n\nPARTES Y OBSERVACIONES DEL ENTRENADOR:\n${reports}\n\nNOTAS DE SESIÓN:\n${notes}\n\nSEGUIMIENTO INDIVIDUAL:\n${playerLines}\n\n${question ? `CONSULTA DEL ENTRENADOR:\n${question}` : 'Prepara un análisis de situación y pregunta por los datos que falten.'}`;
  }
  async function copyText(text){
    try { await navigator.clipboard.writeText(text); return true; }
    catch {
      const field = document.createElement('textarea'); field.value = text; field.style.position='fixed'; field.style.opacity='0'; document.body.appendChild(field); field.select();
      const ok = document.execCommand('copy'); field.remove(); return ok;
    }
  }
  async function sendToChatGPT(question=''){
    const text = contextForChatGPT(question || $('#promptInput').value.trim());
    const copied = await copyText(text);
    toastPlus(copied ? 'Contexto copiado. Esta acción no abre otra página.' : 'No se pudo copiar; revisa los permisos del portapapeles.');
  }
  function answerInApp(question=''){
    const q=question.trim();
    if(!q){toastPlus('Escribe una consulta para el equipo.');return;}
    $('#promptInput').value=q;
    const plan=rivalScout?.trainingPlan||[];
    const own=pilot?.documentedMatches||[];
    const ownAvg=own.length?Math.round(own.reduce((n,m)=>n+m.for,0)/own.length):null;
    const terms=q.toLocaleLowerCase('es');
    let title='Lectura de los datos del equipo';
    let intro=`${app.team}: ${pilot?.classification?.wins??'—'} victorias y ${pilot?.classification?.losses??'—'} derrotas en ${pilot?.classification?.played??'—'} partidos de clasificación. Hay ${own.length} actas detalladas${ownAvg!==null?`; promedio anotado en esas actas: ${ownAvg}`:''}.`;
    let plans=[];
    if(/entren|plan|prepar|partido|rival|felipe|estrateg|defen|rebote|presi/.test(terms)){
      title=`Preparación para ${app.nextOpponent||'el próximo partido'}`;
      if(rivalScout){
        intro=`${rivalScout.team}: ${rivalScout.matches.map(m=>`${m.opponent} ${m.teamPoints}-${m.opponentPoints}`).join(' · ')}. En el acta disponible, los dorsales ${rivalScout.signalsToVerify.map(s=>`#${s.dorsal} anotó ${s.points}`).join(', ')}. Rebotes, asistencias y pérdidas no están disponibles; los porcentajes de tiro de campo son incompletos.`;
        plans=plan;
      }
    } else if(/padre|madre|famil|minut|titular|queja|expectat/.test(terms)){
      title='Pauta para hablar con la familia';
      intro='Propón una conversación privada y breve. Escucha primero la preocupación, concreta los criterios generales de participación y centra la respuesta en objetivos entrenables. No compares a menores ni prometas minutos. Acuerda un siguiente paso y una fecha para revisarlo.';
    } else if(/ansied|frustr|desmotiv|desplaz|acos|maltrato|triste|psicol/.test(terms)){
      title='Pauta educativa para el entrenador';
      intro='Describe lo que has observado y cuándo ocurre; habla con la jugadora en privado, escucha sin diagnosticar y acuerda una conducta pequeña que podáis revisar. Si aparece riesgo, violencia, acoso o malestar persistente, activa el protocolo del club y consulta a la persona responsable.';
    }
    const plansHtml=plans.map(p=>`<li><b>${esc(p.title)} · ${esc(p.duration)}:</b> ${esc(p.evidence)}<ul>${p.blocks.map(b=>`<li>${esc(b)}</li>`).join('')}</ul></li>`).join('');
    const limits=rivalScout?`${rivalScout.matches.length} partidos únicos de la fuente local. Los campos de rebotes, asistencias y pérdidas del rival están incompletos; confirma acta, fecha y categoría antes de usar una conclusión.`:'El scouting detallado del rival no está cargado.';
    $('#assistantAnswerBody').innerHTML=`<h3>${esc(title)}</h3><p>${esc(intro)}</p>${plansHtml?`<p><b>Tareas para repartir en las sesiones de la semana:</b></p><ul>${plansHtml}</ul>`:''}<p class="privacy-note"><b>Límites:</b> ${esc(limits)} Esto es una propuesta automática basada en los archivos locales; no consulta un modelo ChatGPT ni sustituye la revisión del entrenador.</p>`;
    $('#assistantAnswer').hidden=false;
    lastAnswer={title,body:`Consulta: ${q}\n\n${intro}\n\n${plans.map(p=>`${p.title} (${p.duration}): ${p.evidence}\n${p.blocks.join('\n')}`).join('\n\n')}\n\nLímites: ${limits}`,type:/padre|madre|famil|minut/.test(terms)?'familias':/ansied|frustr|desmotiv|desplaz|acos|maltrato|triste|psicol/.test(terms)?'clima':'entrenamiento'};
    toastPlus('Respuesta preparada dentro de Cancha.');
  }
  function saveAnswerAsNote(){
    if(!lastAnswer)return;
    app.sessionNotes.unshift({title:lastAnswer.title,type:lastAnswer.type,priority:'media',body:lastAnswer.body,date:stamp(),escalated:false,draftedBy:'Cancha · reglas y datos locales'});
    persist();renderNotes();renderManager();toastPlus('Nota guardada en este dispositivo.');
  }
  function listenAndSend(){
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) { $('#voiceStatus').textContent='Este navegador no ofrece dictado. Escribe la consulta para recibir una respuesta aquí.'; return; }
    try {
      recognition?.abort(); recognition = new Recognition(); recognition.lang='es-ES'; recognition.interimResults=false; recognition.maxAlternatives=1;
      $('#voiceStatus').textContent='Escuchando tu consulta…';
      recognition.onresult = event => { const heard = event.results[0][0].transcript; $('#promptInput').value=heard; answerInApp(heard); };
      recognition.onerror = event => { $('#voiceStatus').textContent=`No se pudo dictar (${event.error}). Escribe la consulta; Cancha no abrirá otra página.`; };
      recognition.onend = () => { if ($('#voiceStatus').textContent === 'Escuchando tu consulta…') $('#voiceStatus').textContent='Dictado finalizado'; };
      recognition.start();
    } catch { toastPlus('No se pudo iniciar el micrófono. Revisa permiso y conexión segura (localhost/HTTPS).'); }
  }
  async function startChatAudio(){
    if (!navigator.mediaDevices?.getDisplayMedia) { $('#chatAudioStatus').textContent='Este navegador no admite compartir audio de pestaña o pantalla.'; return; }
    stopChatAudio();
    try {
      capture = await navigator.mediaDevices.getDisplayMedia({video:{frameRate:1},audio:true});
      const audioTracks = capture.getAudioTracks();
      capture.getVideoTracks().forEach(track => track.stop());
      if (!audioTracks.length) { capture.getTracks().forEach(track => track.stop()); capture=null; $('#chatAudioStatus').textContent='No llegó audio. Repite y activa «Compartir audio» en la pestaña de ChatGPT.'; return; }
      audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(new MediaStream(audioTracks));
      const analyser = audioContext.createAnalyser(); analyser.fftSize=64; source.connect(analyser);
      const values = new Uint8Array(analyser.frequencyBinCount); const bars=$$('#audioMonitor i');
      const draw = () => { analyser.getByteFrequencyData(values); bars.forEach((bar,i)=>bar.style.height=`${5+Math.round((values[i]||0)/255*27)}px`); animation=requestAnimationFrame(draw); };
      draw();
      $('#chatAudioStatus').textContent='Audio compartido. Mantén esta pestaña abierta mientras hablas con ChatGPT.';
      $('#shareChatAudio').disabled=true; $('#stopChatAudio').disabled=false;
      audioTracks[0].addEventListener('ended', stopChatAudio, {once:true});
    } catch (error) {
      capture?.getTracks().forEach(track=>track.stop()); capture=null;
      $('#chatAudioStatus').textContent = error?.name === 'NotAllowedError' ? 'No se concedió compartir audio.' : 'No se pudo iniciar el audio compartido.';
    }
  }
  function stopChatAudio(){
    cancelAnimationFrame(animation); animation=0;
    capture?.getTracks().forEach(track=>track.stop()); capture=null;
    if(audioContext){audioContext.close().catch(()=>{});audioContext=null;}
    $$('#audioMonitor i').forEach(bar=>bar.style.height='5px');
    const share=$('#shareChatAudio'); const stop=$('#stopChatAudio');
    if(share) share.disabled=false; if(stop) stop.disabled=true;
    const status=$('#chatAudioStatus'); if(status) status.textContent='Audio detenido. Pulsa para volver a compartirlo.';
  }
  function saveMatchReport(){
    const file=$('#matchFile').files?.[0];
    const save = text => {
      const item={date:$('#matchDate').value || 'fecha no indicada',opponent:$('#matchOpponent').value.trim(),competition:$('#matchCompetition').value.trim(),venue:$('#matchVenue').value,score:$('#matchScore').value.trim(),quarters:$('#matchQuarters').value.trim(),observation:$('#matchObservation').value.trim(),teamStats:$('#matchTeamStats').value.trim(),opponentStats:$('#matchOpponentStats').value.trim(),fileName:file?.name || '',fileText:text || '',source:file?'archivo del entrenador':'observación del entrenador',savedAt:stamp()};
      if(!item.opponent){toastPlus('Indica el rival antes de guardar');return;}
      app.reports.unshift(item); persist(); renderReports(); $('#matchOpponent').value=''; $('#matchScore').value=''; $('#matchQuarters').value=''; $('#matchObservation').value=''; $('#matchTeamStats').value=''; $('#matchOpponentStats').value=''; $('#matchFile').value=''; toastPlus('Parte guardado para la próxima revisión.');
    };
    if(file && /\.(csv|txt|json|md)$/i.test(file.name)) file.text().then(t=>save(t.slice(0,16000))).catch(()=>save('')); else save('');
  }
  function renderReports(){
    const box=$('#matchReportList'); if(!box)return;
    if(!app.reports.length){box.innerHTML='<p class="empty-state">Todavía no hay partes del entrenador.</p>';return;}
    box.innerHTML=app.reports.map((r,i)=>`<article class="saved-item"><div><strong>${esc(r.date)} · ${esc(r.opponent)}</strong><small>${esc(r.score||'Marcador pendiente')} · ${esc(r.competition)} · ${esc(r.source)}</small><p>${esc(r.observation||'Sin observaciones')}</p>${r.fileName?`<small>Adjunto: ${esc(r.fileName)}${r.fileText?' (texto leído)':' (no analizado automáticamente)'}</small>`:''}</div><button class="text-btn" data-remove-report="${i}" type="button">Quitar</button></article>`).join('');
    $$('[data-remove-report]').forEach(b=>b.onclick=()=>{app.reports.splice(Number(b.dataset.removeReport),1);persist();renderReports();});
  }
  function saveSessionNote(){
    const item={title:$('#sessionTitle').value.trim()||'Nota de sesión',type:$('#sessionType').value,priority:$('#sessionPriority').value,body:$('#sessionBody').value.trim(),date:stamp(),escalated:$('#escalateSession').checked};
    if(!item.body){toastPlus('Pega o escribe la nota antes de guardarla');return;}
    app.sessionNotes.unshift(item); if(item.escalated) app.escalations.unshift({...item});
    persist(); $('#sessionTitle').value=''; $('#sessionBody').value=''; $('#escalateSession').checked=false; renderNotes(); renderManager(); toastPlus(item.escalated?'Nota guardada y compartida con coordinación.':'Nota revisada y guardada.');
  }
  function renderNotes(){
    const box=$('#sessionNoteList'); if(!box)return;
    box.innerHTML=app.sessionNotes.length?app.sessionNotes.map(n=>`<article class="saved-item"><div><strong>${esc(n.title)}</strong><small>${esc(n.date)} · ${esc(n.type)} · prioridad ${esc(n.priority)}${n.escalated?' · compartida':''}</small><p>${esc(n.body).replace(/\n/g,'<br>')}</p></div></article>`).join(''):'<p class="empty-state">Aún no hay notas guardadas.</p>';
  }
  function renderManager(){
    const box=$('#escalationList'); if(!box)return;
    const active=app.escalations.filter(n=>!n.reviewed);
    $('#escalationCount').textContent=String(active.length);
    $('#formationCount').textContent=String(active.filter(n=>n.type==='formacion').length);
    $('#specialistCount').textContent=String(active.filter(n=>n.type==='especialista').length);
    box.innerHTML=active.length?active.map((n,i)=>`<article class="saved-item"><div><strong>${esc(n.title)}</strong><small>${esc(n.date)} · ${esc(n.type)} · prioridad ${esc(n.priority)}</small><p>${esc(n.body).replace(/\n/g,'<br>')}</p></div><button class="text-btn" data-review-escalation="${i}" type="button">Marcar revisada</button></article>`).join(''):'<p class="empty-state">No hay notas compartidas pendientes.</p>';
    $$('[data-review-escalation]').forEach(b=>b.onclick=()=>{active[Number(b.dataset.reviewEscalation)].reviewed=true;persist();renderManager();});
  }
  function renderAll(){
    if(!app.team)app.team=blankState.team;
    const team=$('#teamLabel'); if(team)team.textContent=`${app.team} · ${app.category}`;
    const coach=$('.coach-card strong'); if(coach)coach.textContent=app.coach;
    renderReports(); renderNotes(); renderManager();
    const today=$('#matchDate'); if(today && !today.value)today.value=new Date().toISOString().slice(0,10);
    if($('#nextOpponent'))$('#nextOpponent').textContent=app.nextOpponent||'Por confirmar';
    if($('#opponentName'))$('#opponentName').textContent=app.nextOpponent||'Pendiente de confirmar';
    const read=$('#seasonRead'); if(read && pilot)read.textContent=`Muestra ${pilot.documentedMatches?.length||0} actas`;
    const rec=$('#recommendationTitle'); if(rec)rec.textContent=rivalScout?`Preparar el partido contra ${rivalScout.team}`:(app.nextOpponent?'Preparar el partido siguiente':'Completar datos del próximo rival');
    const recText=$('#recommendationText'); if(recText)recText.textContent=rivalScout?(rivalScout.matches.length?`${rivalScout.team}: ${rivalScout.matches.length} partidos locales cargados. Trabaja referencias anotadoras, rebote, balance y cuidado del balón; confirma el comportamiento en pista.`:`No hay acta estadística cargada de ${rivalScout.team}. Practica comunicación defensiva, rebote, balance y cuidado del balón; el scouting se completará cuando exista una fuente verificable.`):(app.nextOpponent?'Revisa los resultados disponibles y confirma el plan con el cuerpo técnico.':'No hay próximo rival verificado. Añádelo tras consultar el calendario oficial.');
    const opponentPanel=$('.opponent-panel');
    if(opponentPanel && rivalScout){const signal=$('.opponent-score strong',opponentPanel);if(signal)signal.textContent=rivalScout.matches.length?'Actas locales limitadas':'Scouting pendiente';const summary=$('p',opponentPanel);if(summary)summary.textContent=rivalScout.matches.length?`${rivalScout.team}: ${rivalScout.matches.length} partidos locales cargados. Usa los dorsales como referencias de observación, no como emparejamientos cerrados.`:`${rivalScout.team}: calendario confirmado, pero no hay acta ni estadísticas verificables en la carpeta.`;const action=$('button[data-prompt]',opponentPanel);if(action)action.dataset.prompt=`Prepara el partido contra ${rivalScout.team} con los datos disponibles y sus limitaciones.`;}
    const matchMetric=$('#matchCount'); if(matchMetric && pilot?.classification)matchMetric.textContent=`${pilot.classification.played}*`;
    const statLabels=$$('.stats-row .metric');
    if(statLabels[0]){ $('span',statLabels[0]).textContent='Partidos en clasificación'; $('small',statLabels[0]).textContent=pilot?`${pilot.documentedMatches?.length||0} con acta detallada`:'Datos locales pendientes'; }
    const attendance=$('#attendance'); if(attendance)attendance.textContent='—';
    if(statLabels[1]){ $('span',statLabels[1]).textContent='Asistencia'; $('small',statLabels[1]).textContent='Sin datos cargados'; }
    if(statLabels[2] && pilot?.classification){ $('#streak').textContent=`${pilot.classification.wins}–${pilot.classification.losses}`; $('span',statLabels[2]).textContent='Balance oficial'; $('small',statLabels[2]).textContent='Clasificación local importada'; }
    if(statLabels[3]){ $('span',statLabels[3]).textContent='Próximo rival'; }
    const date=$('#nextDate'); if(date)date.textContent=app.nextMatchDate||'Fecha por confirmar';
    const rivalInput=$('#nextRivalInput'); if(rivalInput)rivalInput.value=app.nextOpponent || '';
    const rivalDate=$('#nextRivalDate'); if(rivalDate)rivalDate.value=app.nextMatchDate || '';
    const select=$('#ficheDorsal'); if(select){ const selected=select.value; select.innerHTML='<option value="">Selecciona dorsal</option>'+((state.players||[]).map(n=>`<option value="${Number(n)}">Dorsal #${Number(n)}</option>`).join('')); if(selected)select.value=selected; }
    renderPlayerFiches();
  }
  function exportAll(){
    const snapshot={version:1,team:app.team,category:app.category,coach:app.coach,nextOpponent:app.nextOpponent,nextMatchDate:app.nextMatchDate,reports:app.reports,sessionNotes:app.sessionNotes,escalations:app.escalations,players:app.players,reviewedCourses:app.reviewedCourses};
    download('cancha-copia.json',JSON.stringify(snapshot,null,2),'application/json'); toastPlus('Copia de seguridad descargada.');
  }
  function importAll(event){
    const file=event.target.files?.[0]; if(!file)return;
    file.text().then(text=>{try{const data=JSON.parse(text);app={...blankState,...data};persist();renderAll();toastPlus('Copia restaurada.');}catch{toastPlus('El archivo no es una copia válida.');}}).finally(()=>event.target.value='');
  }
  function restoreBackup(){
    if(!confirm('Se restaurarán los partidos de demostración de Cancha. Las notas y fichas guardadas se conservarán.'))return;
    if(pilot){state.matches=(pilot.documentedMatches||[]).map((m,i)=>({date:`Acta detallada ${i+1}`,opponent:m.opponent,score:`${m.for}–${m.against}`,result:m.result,read:'Estadística local importada; fecha por confirmar.'}));renderMatches();}
    toastPlus('Datos de resultados restaurados desde el archivo local.');
  }
  function exportReports(){
    if(!app.reports.length){toastPlus('No hay partes para exportar.');return;}
    download('partes_canterbury.json',JSON.stringify(app.reports,null,2),'application/json');
  }
  function savePlayerFiche(){
    const dorsal=$('#ficheDorsal').value; if(!dorsal){toastPlus('Selecciona un dorsal.');return;}
    app.players[dorsal]={goal:$('#ficheGoal').value.trim(),observation:$('#ficheObservation').value.trim(),recommendation:$('#ficheRecommendation').value.trim(),updated:stamp()};
    persist(); renderPlayerFiches(); toastPlus(`Ficha del dorsal #${dorsal} guardada.`);
  }
  function renderPlayerFiches(){
    const box=$('#playerFicheList'); if(!box)return;
    const entries=Object.entries(app.players);
    box.innerHTML=entries.length?entries.map(([d,p])=>`<article class="saved-item"><div><strong>Dorsal #${esc(d)}</strong><small>Actualizada ${esc(p.updated||'')}</small><p><b>Objetivo:</b> ${esc(p.goal||'pendiente')}<br><b>Dato:</b> ${esc(p.observation||'pendiente')}<br><b>Recomendación:</b> ${esc(p.recommendation||'pendiente')}</p></div><button class="text-btn" type="button" data-edit-fiche="${esc(d)}">Editar</button></article>`).join(''):'<p class="empty-state">Aún no hay fichas individuales.</p>';
    $$('[data-edit-fiche]').forEach(b=>b.onclick=()=>{const d=b.dataset.editFiche,p=app.players[d];$('#ficheDorsal').value=d;$('#ficheGoal').value=p.goal||'';$('#ficheObservation').value=p.observation||'';$('#ficheRecommendation').value=p.recommendation||'';});
  }
  function exportPlayerFiches(){
    if(!Object.keys(app.players).length){toastPlus('No hay fichas para exportar.');return;}
    download('seguimiento_por_dorsal_canterbury.json',JSON.stringify({team:app.team,category:app.category,players:app.players},null,2),'application/json');
  }
  function saveNextMatch(){
    app.nextOpponent=$('#nextRivalInput').value.trim(); app.nextMatchDate=$('#nextRivalDate').value; persist(); renderAll(); makeWeeklyReport(); toastPlus('Informe actualizado con el rival y la fecha guardados.');
  }
  function makeWeeklyReport(){
    const report=$('#weeklyReport'); if(!report)return;
    const opponent=app.nextOpponent||$('#nextRivalInput').value.trim();
    if(!opponent){report.innerHTML='<p class="empty-state">Indica el rival tras comprobar el calendario oficial. No se generará scouting sin rival identificado.</p>';return;}
    const detailed=pilot?.documentedMatches||[];
    const avgFor=detailed.length?Math.round(detailed.reduce((s,m)=>s+m.for,0)/detailed.length):null;
    const avgAgainst=detailed.length?Math.round(detailed.reduce((s,m)=>s+m.against,0)/detailed.length):null;
    const turnovers=detailed.map(m=>m.team?.turnovers).filter(Number.isFinite);
    const avgTurnovers=turnovers.length?Math.round(turnovers.reduce((a,b)=>a+b,0)/turnovers.length):null;
    const latest=app.reports[0];
    const tasks=[];
    if(avgTurnovers!==null && avgTurnovers>=15)tasks.push('Practicar recepción, pase de seguridad y decisión bajo presión; el promedio de pérdidas procede de actas detalladas y la muestra es pequeña.');
    if(detailed.some(m=>m.team?.freeAttempts>0 && m.team.freeMade/m.team.freeAttempts<0.5))tasks.push('Incluir rutina breve de tiros libres y registrar intentos y aciertos; los datos disponibles son limitados.');
    tasks.push('Incorporar una tarea del entrenador conectada con lo practicado, y observar comunicación, balance defensivo y rebote.');
    const strategy=rivalScout?.matchStrategy;
    const strategyBlock=strategy?`<section class="match-strategy"><h4>Estrategia de enfrentamiento</h4><p><b>Objetivo:</b> ${esc(strategy.objective)}</p><p><b>Comparativa:</b></p><ul>${strategy.comparison.map(esc).map(t=>`<li>${t}</li>`).join('')}</ul><p><b>Inicio del partido:</b></p><ul>${strategy.openingPlan.map(esc).map(t=>`<li>${t}</li>`).join('')}</ul><p><b>Ajustes si ocurre:</b></p><ul>${strategy.ifThen.map(esc).map(t=>`<li>${t}</li>`).join('')}</ul><p><b>Observar y registrar:</b></p><ul>${strategy.observe.map(esc).map(t=>`<li>${t}</li>`).join('')}</ul><small>${esc(strategy.limits)}</small></section>`:'';
    const venue=pilot?.nextMatch?.venue ? ` · ${pilot.nextMatch.venue}` : '';
     report.innerHTML=`<h4>${esc(app.team)} · ${esc(opponent)} · ${esc(app.nextMatchDate||'fecha pendiente')}${esc(venue)}</h4><p><b>Datos propios:</b> clasificación ${pilot?.classification?`${pilot.classification.wins}-${pilot.classification.losses} en ${pilot.classification.played} partidos`:'pendiente'}; ${detailed.length} actas con estadísticas detalladas${avgFor!==null?`; promedio en esas actas ${avgFor} a favor y ${avgAgainst} en contra`:''}${avgTurnovers!==null?`; ${avgTurnovers} pérdidas por partido en la muestra`:''}.</p><p><b>Rival:</b> sin resultados recientes ni patrones verificados cargados en esta ficha. No se atribuyen fortalezas o debilidades.</p><p><b>Parte más reciente:</b> ${latest?`${esc(latest.opponent)}, ${esc(latest.score||'marcador pendiente')}. ${esc(latest.observation||'Sin observaciones registradas.')}`:'no hay parte propio guardado.'}</p><p><b>Prioridades de entrenamiento:</b></p><ul>${tasks.map(t=>`<li>${esc(t)}</li>`).join('')}</ul>${strategyBlock}<p><b>Comprobaciones antes del partido:</b> confirmar fecha y categoría en la fuente oficial; revisar la normativa de temporada aplicable; elegir solo estrategias practicadas.</p><small>Este borrador usa los archivos estadísticos locales de Canterbury. Clasificación: ${pilot?.classification?.played ?? '—'} partidos; estadísticas detalladas: ${detailed.length} actas. Los campos colectivos incompletos se mantienen como límites de la muestra.</small><div class="form-actions"><button class="outline-btn" type="button" id="copyWeeklyReport">Copiar informe para ChatGPT</button></div>`;
    if (rivalScout) {
      const rivalResult=rivalScout.matches.length ? rivalScout.matches.map(r=>`${esc(r.date || 'fecha no indicada')} · ${esc(r.opponent)} ${r.teamPoints}-${r.opponentPoints}`).join(' · ') : 'sin acta estadística disponible';
      const rivalSignals=rivalScout.signalsToVerify.length ? `Referencias a observar: ${rivalScout.signalsToVerify.map(s=>`#${s.dorsal} (${s.points} puntos)`).join(', ')}.` : 'No hay referencias individuales verificadas.';
      report.innerHTML = report.innerHTML.replace('<p><b>Rival:</b> sin resultados recientes ni patrones verificados cargados en esta ficha. No se atribuyen fortalezas o debilidades.</p>', `<p><b>Estado del rival:</b> ${esc(rivalScout.team)} · ${rivalResult}. ${rivalSignals} No se atribuyen fortalezas o debilidades sin acta.</p><ul>${rivalScout.trainingPlan.map(p=>`<li><b>${esc(p.title)} (${esc(p.duration)}):</b> ${esc(p.evidence)} ${p.blocks.map(esc).join('; ')}</li>`).join('')}</ul>`);
      report.innerHTML = report.innerHTML.replace('El análisis del rival requiere resultados o acta verificables.', 'El marcador y los dorsales anotadores están documentados. El análisis colectivo sigue limitado porque el acta no aporta varios campos estadísticos.');
    }
    $('#copyWeeklyReport').textContent='Copiar informe';
    $('#copyWeeklyReport').onclick=async()=>{const copied=await copyText(report.innerText);toastPlus(copied?'Informe copiado. Cancha permanece abierta.':'No se pudo copiar el informe.');};
  }
  function download(name,content,type){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([content],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500);}

  mount();
})();
