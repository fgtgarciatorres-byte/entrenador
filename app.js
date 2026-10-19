const demoMatches = [
  {date:'22 sep', opponent:'CB Ingenio', score:'54–42', result:'win', read:'Buena defensa tras pérdida'},
  {date:'28 sep', opponent:'CD La Aldea', score:'38–45', result:'loss', read:'Bajó la concentración al final'},
  {date:'30 sep', opponent:'CB Arucas', score:'61–49', result:'win', read:'Mejoró el rebote ofensivo'}
];
const baseCourses = [
  ['☼','1. Entender al jugador','Necesidades, pertenencia y clima seguro.','El niño necesita sentirse parte del grupo, mejorar y disfrutar. Pregunta qué necesita antes de corregir.'],
  ['◌','2. Estrés y nervios','Rutinas sencillas para competir con calma.','Practica una respiración lenta y una rutina breve antes de tiros libres. Normaliza los nervios y evita añadir presión.'],
  ['↗','3. Gestionar el error','Convertir el fallo en información útil.','Después de un error: valida la emoción, pregunta qué ha visto y concreta una próxima acción.'],
  ['♡','4. Motivación','Refuerzo específico y autonomía.','Refuerza el esfuerzo, la decisión y la mejora. Evita comparar jugadores.'],
  ['✦','5. Comunicación','Instrucciones claras en 30 segundos.','Una corrección eficaz nombra la acción, la muestra y comprueba que se ha entendido.'],
  ['⌂','6. Relación con familias','Pautas para una colaboración sana.','Habla con las familias en privado y centra la conversación en el proceso de aprendizaje.'],
  ['▣','7. Casos prácticos','Situaciones reales para entrenar mejor.','Analiza cada caso con calma y pide apoyo a coordinación si la situación supera el ámbito deportivo.']
];
const defaultState = {players:[2,4,5,8,17,32], notes:{}, matches:demoMatches, courses:[], teamName:'Canterbury School', nextOpponent:'CB Telde', dataMode:'demo'};
let state = loadState();
let selected = null;
let clubStats = null;
const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];

function loadState(){
  try { return {...defaultState, ...(JSON.parse(localStorage.getItem('canchaState') || 'null') || {})}; }
  catch { return {...defaultState}; }
}
function save(){ localStorage.setItem('canchaState', JSON.stringify(state)); }
function allCourses(){ return [...baseCourses, ...(state.courses || [])]; }
function numbers(match){ return (match.score || '0–0').replace('–','-').split('-').map(v => Number(v.trim()) || 0); }
function seasonStats(){
  const matches = state.matches || [];
  const wins = matches.filter(m => m.result === 'win').length;
  const scored = matches.map(m => numbers(m)[0]);
  const conceded = matches.map(m => numbers(m)[1]);
  const avgFor = scored.length ? Math.round(scored.reduce((a,b)=>a+b,0)/scored.length) : 0;
  const avgMargin = scored.length ? Math.round(scored.reduce((sum,v,i)=>sum+v-(conceded[i]||0),0)/scored.length) : 0;
  return {wins, avgFor, avgMargin, matches:matches.length};
}
function renderMatches(){
  const stats = seasonStats();
  $('#matchCount').textContent = stats.matches;
  $('#winCount').textContent = stats.wins;
  $('#avgFor').textContent = stats.avgFor;
  $('#avgMargin').textContent = `${stats.avgMargin >= 0 ? '+' : ''}${stats.avgMargin}`;
  $('#streak').textContent = `${stats.wins}–${Math.max(0,stats.matches-stats.wins)}`;
  $('#nextOpponent').textContent = state.nextOpponent || 'Por definir';
  $('#opponentName').textContent = state.nextOpponent || 'Por definir';
  $('#seasonRead').textContent = stats.avgMargin >= 8 ? 'Defensa estable' : stats.avgMargin >= 0 ? 'Crecimiento útil' : 'Reforzar concentración';
  $('#matchTable').innerHTML = (state.matches || []).map(m => `<tr><td>${escapeHtml(m.date)}</td><td>${escapeHtml(m.opponent)}</td><td class="result-${m.result}">${escapeHtml(m.score)}</td><td>${escapeHtml(m.read)}</td></tr>`).join('');
  $('#bars').innerHTML = (state.matches || []).map(m => `<div class="bar" style="height:${Math.max(35, numbers(m)[0]*2.1)}px"><em>${numbers(m)[0]}</em></div>`).join('');
  $('#chartLabels').innerHTML = (state.matches || []).map(m => `<span>${escapeHtml(m.date)}</span>`).join('');
}
function renderClubStats(){
  if(!clubStats) return;
  const source=$('#dataSource');
  if(source) source.textContent=`Fuente oficial y archivos locales: ${clubStats.team} · ${clubStats.competition} · actualizado ${clubStats.lastUpdated} · ${clubStats.documentedMatches.length} actas detalladas + último resultado oficial · solo dorsales en el análisis`;
  const scope=$('#trainingScope');
  if(scope) scope.textContent=`${clubStats.documentedMatches.length} actas + último resultado oficial`;
  if(clubStats.upcomingMatch && (!state.nextOpponent || state.nextOpponent === defaultState.nextOpponent || state.dataMode === 'demo')){
    state.nextOpponent=clubStats.upcomingMatch.opponent;
    state.dataMode='official';
    save();
    renderMatches();
  }
  const plans=$('#trainingPlans');
  if(plans) plans.innerHTML=(clubStats.trainingPlans || []).map(plan=>`<article class="training-plan"><div class="training-plan-top"><h4>${escapeHtml(plan.title)}</h4><span>${escapeHtml(plan.duration)}</span></div><p>${escapeHtml(plan.why)}</p><ul>${plan.blocks.map(block=>`<li>${escapeHtml(block)}</li>`).join('')}</ul></article>`).join('');
}
async function loadClubStats(){
  try {
    const response=await fetch('./data/club-stats.json', {cache:'no-store'});
    if(!response.ok) throw new Error('stats');
    clubStats=await response.json();
    const officialMatches=[
      ...(clubStats.documentedMatches || []).map((match,index)=>({date:`Acta detallada ${index + 1}`, opponent:match.opponent, score:`${match.for}–${match.against}`, result:match.result, read:'Estadística de Canterbury importada desde la carpeta estadisticas.'})),
      ...(clubStats.latestResult ? [{date:clubStats.latestResult.date, opponent:clubStats.latestResult.opponent, score:`${clubStats.latestResult.for}–${clubStats.latestResult.against}`, result:clubStats.latestResult.result, read:'Resultado oficial verificado en Gesdeportiva; sin boxscore detallado.'}] : [])
    ];
    const demoOpponents=new Set(demoMatches.map(match=>match.opponent));
    const hasOnlyDemoMatches=(state.matches || []).length===demoMatches.length && (state.matches || []).every(match=>demoOpponents.has(match.opponent));
    if(state.dataMode === 'demo' || hasOnlyDemoMatches){
      state.matches=officialMatches;
      state.dataMode='official';
      state.teamName=clubStats.team;
      if(clubStats.upcomingMatch) state.nextOpponent=clubStats.upcomingMatch.opponent;
      save();
      renderMatches();
    }
    renderClubStats();
  }
  catch { const source=$('#dataSource'); if(source) source.textContent='Fuente externa no disponible. Puedes cargar un CSV de temporada.'; }
}
function renderRoster(){
  $('#roster').innerHTML = (state.players || []).map(n => `<div class="player-card ${selected===n?'selected':''}" data-player="${n}"><div class="jersey">#${n}</div><div class="player-status">${state.notes[n]?'Nota guardada':'Sin nota todavía'}</div></div>`).join('');
  $$('.player-card').forEach(card => card.onclick = () => selectPlayer(Number(card.dataset.player)));
}
function selectPlayer(n){ selected=n; $('#selectedPlayer').textContent=`Dorsal #${n}`; $('#playerNote').value=state.notes[n] || ''; renderRoster(); }
function renderCourses(){
  $('#courseGrid').innerHTML = allCourses().map((course,i) => `<article class="course-card"><div class="course-icon">${escapeHtml(course[0] || '▤')}</div><h3>${escapeHtml(course[1])}</h3><p>${escapeHtml(course[2])}</p><button data-course="${i}">${i<2?'Continuar capítulo':'Abrir capítulo'} →</button></article>`).join('');
  $$('.course-card button').forEach(button => button.onclick = () => showCourse(Number(button.dataset.course)));
}
function navigate(view){
  $$('.nav-item').forEach(nav => nav.classList.toggle('active', nav.dataset.view===view));
  $$('.view').forEach(panel => panel.classList.toggle('active', panel.id==='view-'+view));
  const titles={inicio:'Buenos días, entrenador/a',equipo:'Tu equipo, dorsal a dorsal',analisis:'Cómo está evolucionando el equipo',formacion:'Aprender para entrenar mejor'};
  $('#pageTitle').textContent=titles[view] || titles.inicio;
  window.scrollTo({top:0,behavior:'smooth'});
}
function showCourse(index){
  const course = allCourses()[index];
  $('#modalContent').innerHTML = `<span class="eyebrow">FORMACIÓN DEL CLUB</span><h2>${escapeHtml(course[1])}</h2><p>${escapeHtml(course[3] || course[2])}</p><p><strong>Aplicación para el próximo entreno:</strong></p><ul><li>Explica el objetivo en una frase.</li><li>Practica la conducta en una situación sencilla.</li><li>Cierra preguntando qué han aprendido.</li></ul><button class="primary-btn" id="doneCourse">Marcar como revisado</button>`;
  $('#modal').classList.remove('hidden');
  $('#doneCourse').onclick=()=>{ $('#modal').classList.add('hidden'); $('#assistantHint').textContent='Capítulo revisado'; };
}
function responseFor(prompt){
  const text=prompt.toLowerCase();
  if(text.includes('frustr') || text.includes('estrés') || text.includes('nerv')) return {title:'Pauta para trabajar la frustración',body:'Empieza validando la emoción: «Entiendo que te enfade». Después pide una acción concreta: respirar, mirar y volver a defender. Refuerza la respuesta al error, no solo el acierto.'};
  if(text.includes('presión') || text.includes('plan') || text.includes('entren')){
    const latest=clubStats?.latestResult;
    const next=clubStats?.upcomingMatch?.opponent || state.nextOpponent || 'el próximo rival';
    return {title:`Preparación Canterbury · ${next}`,body:`Canterbury llega con ${clubStats?.classification?.wins ?? seasonStats().wins} victorias en ${clubStats?.classification?.played ?? seasonStats().matches} partidos. El último resultado fue ${latest ? `${latest.for}–${latest.against} ante ${latest.opponent}` : 'el partido más reciente disponible'}. Diseña la sesión sobre ese contexto: 10 min de activación y comunicación; 20 min de decisiones con marcador ajustado; 15 min de rebote y balance; 10 min de tiros libres bajo presión; 5 min para cerrar con una consigna colectiva.`};
  }
  const latest=clubStats?.latestResult;
  return {title:'Prioridades para Canterbury',body:`${clubStats?.team || 'Canterbury School'} tiene ${clubStats?.classification?.wins ?? seasonStats().wins} victorias y ${clubStats?.classification?.losses ?? Math.max(0,seasonStats().matches-seasonStats().wins)} derrotas en ${clubStats?.classification?.played ?? seasonStats().matches} partidos oficiales. ${latest ? `El último partido terminó ${latest.for}–${latest.against} ante ${latest.opponent}.` : ''} Prioridad 1: mantener la concentración en las posesiones finales. Prioridad 2: trabajar el rebote y la comunicación defensiva.`};
}
function assistantPrompt(prompt){
  $('#promptInput').value=prompt; $('#assistantHint').textContent='Preparando recomendación…';
  setTimeout(()=>{ const response=showResponse(prompt); speak(response.body); $('#assistantHint').textContent='Lista para conversar'; },350);
}
function showResponse(prompt){
  const response=responseFor(prompt);
  $('#modalContent').innerHTML=`<span class="eyebrow">CANCHA · RECOMENDACIÓN</span><h2>${response.title}</h2><p>${response.body}</p><p class="privacy-note">Orientación deportiva y educativa. Si aparece un problema de salud mental o seguridad, deriva a la familia y a un profesional cualificado.</p>`;
  $('#modal').classList.remove('hidden');
  return response;
}
function speak(text){ if('speechSynthesis' in window){ speechSynthesis.cancel(); const utterance=new SpeechSynthesisUtterance(text); utterance.lang='es-ES'; speechSynthesis.speak(utterance); } }
function listen(){
  if(!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)){ $('#voiceStatus').textContent='Usa Chrome o Edge para activar la voz.'; return; }
  const Recognition=window.SpeechRecognition || window.webkitSpeechRecognition; const recognition=new Recognition(); recognition.lang='es-ES'; recognition.interimResults=false;
  recognition.onstart=()=>{ $('#voiceStatus').textContent='Escuchando…'; $('#assistantHint').textContent='Te escucho'; };
  recognition.onresult=event=>{ const transcript=event.results[0][0].transcript; $('#promptInput').value=transcript; assistantPrompt(transcript); };
  recognition.onerror=()=>{ $('#voiceStatus').textContent='No se pudo usar el micrófono. Revisa el permiso del navegador.'; };
  recognition.onend=()=>{ $('#voiceStatus').textContent='El navegador pedirá permiso la primera vez.'; };
  recognition.start();
}
function escapeHtml(value){ return String(value ?? '').replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char])); }
function download(name, content, type){ const link=document.createElement('a'); link.href=URL.createObjectURL(new Blob([content],{type})); link.download=name; link.click(); setTimeout(()=>URL.revokeObjectURL(link.href),500); }
function contextForChatGPT(){
  const notes=Object.entries(state.notes).map(([d,n])=>`Dorsal #${d}: ${n}`).join('\n') || 'No hay notas de jugadores.';
  const results=(state.matches||[]).map(m=>`${m.date} · ${m.opponent} · ${m.score} · ${m.read}`).join('\n');
  const scout=clubStats ? `\nFuente de scouting: ${clubStats.team}, ${clubStats.competition}. Clasificación: ${clubStats.classification.rank}º con ${clubStats.classification.wins}-${clubStats.classification.losses} en ${clubStats.classification.played} partidos. Último resultado oficial: ${clubStats.latestResult?.for}-${clubStats.latestResult?.against} ante ${clubStats.latestResult?.opponent}. Próximo rival: ${clubStats.upcomingMatch?.opponent}. Hay ${clubStats.documentedMatches.length} partidos con boxscore detallado. Usa solo dorsales y evita nombres.` : '';
  return `Modo entrenador. Club Santa Brígida. Responde en español, con pautas breves y prácticas para baloncesto infantil. Prioriza motivación, gestión del estrés, dinámicas de grupo y aprendizaje. No hagas intervención clínica.\n\nPróximo rival: ${state.nextOpponent}\nPartidos:\n${results}\nNotas por dorsal:\n${notes}${scout}\n\nConsulta del entrenador: ${$('#promptInput').value || 'Dame dos prioridades para el próximo entrenamiento.'}`;
}
async function copyText(text){ try { await navigator.clipboard.writeText(text); return true; } catch { return false; } }
function parseCsv(text){
  return text.split(/\r?\n/).filter(Boolean).slice(1).map(row=>{
    const cells=row.split(','); const score=(cells[2]||'0-0').replace('–','-'); const [forPts,againstPts]=score.split('-').map(v=>Number(v)||0);
    return {date:cells[0]||'',opponent:cells[1]||'',score:`${forPts}–${againstPts}`,result:forPts>=againstPts?'win':'loss',read:cells.slice(3).join(',')||'Importado desde CSV'};
  });
}
function readCourseFile(file){
  const reader=new FileReader(); reader.onload=()=>{
    let course;
    if(file.name.toLowerCase().endsWith('.json')){ try { const data=JSON.parse(reader.result); course=Array.isArray(data)?data[0]:data; } catch { course=null; } }
    if(!course) course=['▤',file.name.replace(/\.[^.]+$/,''),'Material cargado por el club.',String(reader.result).slice(0,1200)];
    const normalized=Array.isArray(course)?course:['▤',course.title||file.name,course.summary||'Material cargado por el club.',course.content||''];
    state.courses.push(normalized); save(); renderCourses(); $('#assistantHint').textContent='Material del club añadido';
  }; reader.readAsText(file);
}
$$('.nav-item').forEach(nav=>nav.onclick=()=>navigate(nav.dataset.view));
$$('[data-view-target]').forEach(button=>button.onclick=()=>navigate(button.dataset.viewTarget));
$$('[data-prompt]').forEach(button=>button.onclick=()=>assistantPrompt(button.dataset.prompt));
$('#sendPrompt').onclick=()=>{const value=$('#promptInput').value.trim(); if(value) assistantPrompt(value);};
$('#promptInput').onkeydown=event=>{if(event.key==='Enter')$('#sendPrompt').click();};
$('#voiceBtn').onclick=listen; $('#voiceBtn2').onclick=listen;
$('#closeModal').onclick=()=>$('#modal').classList.add('hidden'); $('#modal').onclick=event=>{if(event.target.id==='modal')$('#modal').classList.add('hidden');};
$('#saveNote').onclick=()=>{if(selected){state.notes[selected]=$('#playerNote').value.trim();save();renderRoster();$('#assistantHint').textContent='Nota guardada en el dorsal #'+selected;}};
$('#addPlayer').onclick=()=>{const number=Number(prompt('Dorsal del nuevo jugador (1–99):'));if(number>0&&number<100&&!state.players.includes(number)){state.players.push(number);state.players.sort((a,b)=>a-b);save();renderRoster();}};
$('#resetData').textContent='Restaurar datos oficiales';
$('#resetData').onclick=()=>{state.dataMode='demo';loadClubStats();$('#assistantHint').textContent='Datos oficiales de Canterbury restaurados';};
$('#csvInput').onchange=event=>{const file=event.target.files[0];if(!file)return;const reader=new FileReader();reader.onload=()=>{state.matches=parseCsv(reader.result);save();renderMatches();$('#assistantHint').textContent='Partidos importados';};reader.readAsText(file);};
$('#courseInput').onchange=event=>{const file=event.target.files[0];if(file)readCourseFile(file);};
$('#exportData').onclick=()=>{download('cancha-copia.json',JSON.stringify(state,null,2),'application/json');$('#assistantHint').textContent='Copia guardada';};
$('#importData').onchange=event=>{const file=event.target.files[0];if(!file)return;const reader=new FileReader();reader.onload=()=>{try{state={...defaultState,...JSON.parse(reader.result)};save();renderMatches();renderRoster();renderCourses();$('#assistantHint').textContent='Copia recuperada';}catch{$('#assistantHint').textContent='La copia no es válida';}};reader.readAsText(file);};
$('#chatgptBtn').onclick=async()=>{await copyText(contextForChatGPT());window.open('https://chatgpt.com/','_blank');$('#assistantHint').textContent='Contexto copiado. Pégalo en ChatGPT';};
$('#copyPrompt').onclick=async()=>{await copyText(contextForChatGPT());$('#assistantHint').textContent='Contexto completo copiado';};
$('#editCoach').onclick=()=>{const name=prompt('Nombre visible del entrenador:','Entrenador/a');if(name)document.querySelector('.coach-card strong').textContent=name;};
let deferredInstallPrompt;
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();deferredInstallPrompt=event;$('#installBtn').hidden=false;});
$('#installBtn').onclick=async()=>{if(deferredInstallPrompt){deferredInstallPrompt.prompt();await deferredInstallPrompt.userChoice;deferredInstallPrompt=null;}else{$('#assistantHint').textContent='En iPhone: Compartir → Añadir a pantalla de inicio';}};
if('serviceWorker' in navigator) window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
renderMatches(); renderRoster(); renderCourses(); loadClubStats();
