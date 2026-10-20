import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];
const readJson = relative => { try { return JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8')); } catch (error) { errors.push(`${relative}: JSON inválido o ausente (${error.message})`); return null; } };
const catalog = readJson('library/catalog.json');
const sources = readJson('library/sources.json');
const club = readJson('data/club-stats.json');
const rival = readJson('data/rival-scout.json');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
if (!catalog?.cards?.length) errors.push('library/catalog.json: no hay fichas');
if (!sources?.sources?.length) errors.push('library/sources.json: no hay fuentes');
const sourceIds = new Set((sources?.sources || []).map(source => source.id));
const cardIds = new Set();
for (const card of catalog?.cards || []) {
  if (!card.id || cardIds.has(card.id)) errors.push(`Ficha duplicada o sin id: ${card.id || '(vacía)'}`);
  cardIds.add(card.id);
  if (!card.title || !card.summary || !card.coachAction) errors.push(`Ficha incompleta: ${card.id}`);
  for (const sourceId of card.sourceIds || []) if (!sourceIds.has(sourceId)) errors.push(`${card.id}: fuente inexistente ${sourceId}`);
}
for (const source of sources?.sources || []) if (!source.url?.startsWith('https://')) errors.push(`Fuente sin URL segura: ${source.id}`);
if (!app.includes('./library/catalog.json')) errors.push('app.js: la biblioteca no está integrada');
if (!app.includes('renderLibrary')) errors.push('app.js: falta renderLibrary');
if (!html.includes('libraryGrid')) errors.push('index.html: falta el contenedor de biblioteca');
if (!sw.includes('./library/catalog.json') || !sw.includes('./library/validation-report.json')) errors.push('sw.js: faltan recursos de biblioteca en la caché');
try { execFileSync(process.execPath, ['--check', path.join(root, 'app.js')], { stdio: 'pipe' }); } catch { errors.push('app.js: node --check ha fallado'); }
if (!club?.team || !club?.competition || !club?.latestBoxscore) errors.push('club-stats.json: falta identidad o último boxscore');
if (!rival?.team || !rival?.competition || !rival?.coverage || !rival?.matches?.length) errors.push('rival-scout.json: falta cobertura o partido');
if (rival && club?.upcomingMatch && rival.team !== club.upcomingMatch.opponent) errors.push('El rival no coincide con el próximo partido');
if (rival && club && rival.competition.split(' · ')[0] !== club.competition) errors.push('Rival y equipo no comparten competición base');
const report = { status: errors.length ? 'FAILED' : 'PASSED', checkedAt: new Date().toISOString(), checks: { cards: catalog?.cards?.length || 0, sources: sources?.sources?.length || 0, rival: rival?.team || null, team: club?.team || null }, errors };
fs.mkdirSync(path.join(root, 'library'), { recursive: true });
fs.writeFileSync(path.join(root, 'library/validation-report.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
if (errors.length) process.exitCode = 1;
