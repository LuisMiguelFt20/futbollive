import express from 'express';

import cors from 'cors';

import 'dotenv/config';

import fs from 'node:fs';

import path from 'node:path';

import { fileURLToPath } from 'node:url';



const app = express();

app.use(cors());

app.use(express.json());

const PORT = Number(process.env.PORT || 3001);

const SPORT_API = 'https://v3.football.api-sports.io';

const FOOTBALL_DATA_API = 'https://api.football-data.org/v4';

const BSD_API = 'https://sports.bzzoiro.com/api/v2';

// En Render: FOOTBALL_PRIMARY_DISABLED=true utiliza BSD sin llamar a la cuenta suspendida.

const PRIMARY_DISABLED = process.env.FOOTBALL_PRIMARY_DISABLED === 'true';

// Identificadores API-Football -> football-data.org para tablas actuales.

const FOOTBALL_DATA_CODES = new Map([[39,'PL'],[140,'PD'],[78,'BL1'],[135,'SA'],[61,'FL1']]);

const TZ = 'America/Lima';

// El dashboard de API-Sports reinicia la cuota a las 00:00 UTC (19:00 Perú).

const providerQuotaDay = () => new Date().toISOString().slice(0,10);

function nextQuotaResetUTC(){const d=new Date();return new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()+1)).toISOString();}

const ROOT = path.dirname(fileURLToPath(import.meta.url));

const RUNTIME = path.join(ROOT, '.runtime');

const STATE_FILE = path.join(RUNTIME, 'state.json');

const DAILY_LIMIT = Math.min(90, Math.max(10, Number(process.env.FOOTBALL_DAILY_BUDGET || 75)));

// La cuota predeterminada de YouTube separa 100 búsquedas/día: usamos menos por seguridad.

const YOUTUBE_SEARCH_LIMIT = Math.min(90, Math.max(1, Number(process.env.YOUTUBE_DAILY_SEARCH_BUDGET || 35)));

const LEAGUES = [

  { id:39, name:'Premier League', country:'Inglaterra', flag:'🇬🇧', seasonType:'cross', color:'#a83fe8' },

  { id:140, name:'LaLiga', country:'España', flag:'🇪🇸', seasonType:'cross', color:'#ed4747' },

  { id:78, name:'Bundesliga', country:'Alemania', flag:'🇩🇪', seasonType:'cross', color:'#e63d4b' },

  { id:135, name:'Serie A', country:'Italia', flag:'🇮🇹', seasonType:'cross', color:'#4c9cf9' },

  { id:61, name:'Ligue 1', country:'Francia', flag:'🇫🇷', seasonType:'cross', color:'#7aaaf3' },

  { id:2, name:'Champions League', country:'Europa', flag:'🇪🇺', seasonType:'cross', color:'#4164ff' },

  { id:3, name:'Europa League', country:'Europa', flag:'🇪🇺', seasonType:'cross', color:'#f7a543' },

  { id:13, name:'Copa Libertadores', country:'Sudamérica', flag:'🌎', seasonType:'calendar', color:'#dcaf49' },

  { id:281, name:'Liga 1 Perú', country:'Perú', flag:'🇵🇪', seasonType:'calendar', color:'#ed535d' }

];



const pad = n => String(n).padStart(2, '0');

function peruDate(input = new Date()) {

  return new Intl.DateTimeFormat('en-CA', {timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).format(input);

}

function parseDay(s) { return new Date(`${s}T12:00:00Z`); }

function plusDays(date, days) { const d = parseDay(date); d.setUTCDate(d.getUTCDate()+days); return d.toISOString().slice(0,10); }

function currentWindow(){return peruDate();}

function validDay(s){return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(parseDay(s).getTime()) && parseDay(s).toISOString().slice(0,10)===s;}

function getWindow(req){

  // Ventana móvil fija: HOY y MAÑANA, zona horaria de Perú.

  // El parámetro start se conserva por compatibilidad, pero solo se admiten hoy y mañana.

  const start=currentWindow();

  return {start,end:plusDays(start,1),days:[start,plusDays(start,1)]};

}

function statusType(code){if(['1H','HT','2H','ET','BT','P','INT','LIVE'].includes(code))return 'live';if(['FT','AET','PEN'].includes(code))return 'finished';if(['NS','TBD'].includes(code))return 'upcoming';return 'other';}

function fixture(x){ const f=x.fixture||{}, t=x.teams||{}, l=x.league||{}, s=f.status||{}; const type=statusType(s.short);return {

  id:f.id, date:f.date, timestamp:f.timestamp, status:s.short||'?', statusText:s.long||'', minute:s.elapsed ?? null,

  type, live:type==='live', finished:type==='finished', upcoming:type==='upcoming',

  home:t.home?.name||'Local', away:t.away?.name||'Visitante', homeId:t.home?.id, awayId:t.away?.id,

  homeLogo:t.home?.logo||null,awayLogo:t.away?.logo||null,

  score:x.goals?.home!=null&&x.goals?.away!=null?`${x.goals.home} - ${x.goals.away}`:'vs',

  homeGoals:x.goals?.home??null, awayGoals:x.goals?.away??null,

  league:l.name||'Liga', leagueId:l.id||null, leagueLogo:l.logo||null, country:l.country||'', season:l.season,

  round:l.round||'', venue:f.venue?.name||'', referee:f.referee||'', provider:'api-football',

  events:Array.isArray(x.events)?x.events.filter(e=>e.type==='Goal').slice(0,10).map(e=>({minute:e.time?.elapsed,team:e.team?.name,player:e.player?.name,detail:e.detail})):[]

};}

function standings(x){const root=x.response?.[0]?.league;return {league:root?.name||'',logo:root?.logo||null,season:root?.season||null,groups:(root?.standings||[]).map((g,i)=>({title:g[0]?.group||`Grupo ${i+1}`,rows:g.map(r=>({rank:r.rank,teamId:r.team?.id,team:r.team?.name,logo:r.team?.logo,played:r.all?.played,win:r.all?.win,draw:r.all?.draw,lose:r.all?.lose,goalsFor:r.all?.goals?.for,goalsAgainst:r.all?.goals?.against,goalDiff:r.goalsDiff,points:r.points,form:r.form||'',description:r.description||''}))}))};}



function transformFootballDataStandings(raw){

  const tables=Array.isArray(raw.standings)?raw.standings:[];

  // En campeonatos de liga se obtiene TOTAL + HOME + AWAY: solo mostrar TOTAL.

  const total=tables.filter(x=>x.type==='TOTAL');

  const chosen=total.length?total:tables.filter(x=>x.type!=='HOME'&&x.type!=='AWAY');

  const groups=chosen.map((entry,i)=>({

    title:entry.group ? entry.group.replace(/_/g,' ') : 'Clasificación general',

    rows:(entry.table||[]).map(row=>({

      rank:row.position,

      teamId:null,  // IDs de football-data.org != IDs de API-Football.

      providerTeamId:row.team?.id??null,

      team:row.team?.shortName||row.team?.name||'Equipo',

      logo:row.team?.crest||null,

      played:row.playedGames??0,

      win:row.won??0,

      draw:row.draw??0,

      lose:row.lost??0,

      goalsFor:row.goalsFor??0,

      goalsAgainst:row.goalsAgainst??0,

      goalDiff:row.goalDifference??0,

      points:row.points??0,

      form:row.form||'',

      description:''

    }))

  }));

  const seasonStart=raw.season?.startDate?.slice(0,4)||null;

  const seasonEnd=raw.season?.endDate?.slice(0,4)||null;

  return {

    league:raw.competition?.name||'',

    logo:raw.competition?.emblem||null,

    competitionCode:raw.competition?.code||'',

    season:seasonStart?Number(seasonStart):null,

    seasonLabel:seasonStart?(seasonEnd&&seasonEnd!==seasonStart?`${seasonStart}/${seasonEnd}`:seasonStart):'Temporada actual',

    updatedAt:new Date().toISOString(),

    groups,

    items:groups[0]?.rows||[],

    source:'football-data.org'

  };

}





// ============================================================================

// BSD (Bzzoiro Sports Data) — respaldo gratuito de partidos.

// Los IDs de BSD son distintos de los de API-Football: nunca mezclarlos.

// https://sports.bzzoiro.com/docs/football/events/

// ============================================================================

function bsdNormalized(value){

  return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')

    .toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();

}

const BSD_LEAGUE_ALIASES=new Map([

  [39,['premier league','english premier league']],

  [140,['la liga','laliga','primera division','la liga ea sports']],

  [78,['bundesliga']],

  [135,['serie a']],

  [61,['ligue 1']],

  [2,['uefa champions league','champions league']],

  [3,['uefa europa league','europa league']],

  [13,['copa libertadores','conmebol libertadores']],

  [281,['liga 1 peru','liga 1','primera division peru']]

]);

const COUNTRY_ALIAS={39:['england','inglaterra'],140:['spain','espana'],78:['germany','alemania'],135:['italy','italia'],61:['france','francia'],2:[],3:[],13:[],281:['peru']};

function bsdCountryString(value){return typeof value==='string'?value:(value?.name||value?.country||'');}

function resolveBSDLeague(name,country){

  const n=bsdNormalized(name),c=bsdNormalized(bsdCountryString(country));

  if(!n)return null;

  for(const [id,aliases] of BSD_LEAGUE_ALIASES){

    if(!aliases.includes(n))continue;

    const countries=COUNTRY_ALIAS[id]||[];

    // Evitar confundir Serie A de Brasil con Serie A de Italia, por ejemplo.

    if(countries.length&&c&&!countries.some(x=>c.includes(x)))continue;

    if(countries.length&&!c&&[135,281].includes(id))continue;

    return id;

  }

  return null;

}

function bsdTimestamp(x){

  const raw=x.event_date||x.date||x.kickoff||x.start_time||x.time?.kickoff_at||x.kickoff_at||null;

  return raw&&Number.isFinite(Date.parse(raw))?new Date(raw).toISOString():null;

}

function bsdGame(x,leagueIndex=new Map(),fromLiveFeed=false){

  const rawLeagueId=Number(x.league_id||x.league?.id)||null;

  const leagueInfo=leagueIndex.get(rawLeagueId)||{};

  const name=x.league_name||x.league?.name||leagueInfo.name||'Competición';

  const country=x.country||x.league_country||x.league?.country||leagueInfo.country||'';

  const leagueId=resolveBSDLeague(name,country);

  const league=LEAGUES.find(l=>l.id===leagueId);

  const status=bsdNormalized(x.status||x.time?.status||'');

  // /events/live/ solo devuelve encuentros en juego, incluso cuando el estado

  // no está presente en la raíz de la respuesta compacta.

  const type=fromLiveFeed||status==='live'?'live':status==='finished'?'finished':status==='upcoming'?'upcoming':'other';

  const date=bsdTimestamp(x);

  const home=x.home_team?.name||x.home_team_name||(typeof x.home_team==='string'?x.home_team:null)||x.home?.name||'Local';

  const away=x.away_team?.name||x.away_team_name||(typeof x.away_team==='string'?x.away_team:null)||x.away?.name||'Visitante';

  const homeGoals=x.home_score??x.score?.home??null;

  const awayGoals=x.away_score??x.score?.away??null;

  const minute=x.current_minute??x.minute??x.time?.minute??null;

  const eventId=x.id??x.event_id??null;

  const id=eventId==null?null:`bsd-${eventId}`;

  return {

    id,date,timestamp:date?Math.floor(Date.parse(date)/1000):0,

    status:type==='live'?'LIVE':type==='finished'?'FT':type==='upcoming'?'NS':(x.status||'?'),

    statusText:String(x.status||x.time?.status||'En vivo'),minute,

    type,live:type==='live',finished:type==='finished',upcoming:type==='upcoming',

    home:String(home),away:String(away),

    // Prohibido enviar IDs de otro proveedor a /api/futbol/equipo/:id.

    homeId:null,awayId:null,bsdHomeId:x.home_team_id??x.home?.id??null,bsdAwayId:x.away_team_id??x.away?.id??null,

    homeLogo:x.home_team_logo||x.home_logo||x.home?.logo||x.home_team?.logo||null,

    awayLogo:x.away_team_logo||x.away_logo||x.away?.logo||x.away_team?.logo||null,

    score:homeGoals!=null&&awayGoals!=null?`${homeGoals} - ${awayGoals}`:'vs',

    homeGoals,awayGoals,league:league?.name||name,leagueId,bsdLeagueId:rawLeagueId,

    leagueLogo:leagueInfo.logo||x.league?.logo||null,country:bsdCountryString(country),

    season:x.season_id||null,round:x.round||'',venue:x.venue?.name||x.venue||'',referee:'',

    events:[],provider:'bsd'

  };

}

async function bsdRequest(endpoint,ttl=10*60_000){

  if(!configured('BZZOIRO_API_KEY'))throw new ApiFailure('Falta BZZOIRO_API_KEY en backend/.env',503);

  return remember(`bsd:${endpoint}`,ttl,async()=>{

    const response=await fetch(BSD_API+endpoint,{

      headers:{Authorization:`Token ${process.env.BZZOIRO_API_KEY}`},

      signal:AbortSignal.timeout(14000)

    });

    const data=await response.json().catch(()=>({}));

    if(!response.ok||data.error===true){

      const detail=data.detail||data.message||`BSD HTTP ${response.status}`;

      throw new ApiFailure(`BSD: ${detail}`,response.status===429?429:502);

    }

    return data;

  });

}

function bsdItems(data){

  if(Array.isArray(data))return data;

  if(Array.isArray(data.results))return data.results;

  if(Array.isArray(data.events))return data.events;

  return [];

}

async function bsdLeagues(){

  // El listado de ligas es pequeño y cambia poco; reutilizarlo por un día.

  try{

    const r=await bsdRequest('/leagues/?limit=200',24*3600_000);

    const index=new Map();

    for(const league of bsdItems(r.value)){

      if(league.id!=null)index.set(Number(league.id),{

        name:league.name||league.league_name||'',

        country:bsdCountryString(league.country||league.country_name||''),

        logo:league.logo||null

      });

    }

    return index;

  }catch(error){

    console.warn('BSD: no se pudo leer índice de ligas:',error.message);

    return new Map();

  }

}

async function bsdFixtures(start,end){

  // BSD filtra por fecha UTC; Perú es UTC-5. Incluir el día posterior en UTC

  // y filtrar luego por fecha LOCAL para no perder partidos nocturnos de mañana.

  const until=plusDays(end,1);

  const r=await remember(`bsd:fixtures:window:${start}:${end}`,10*60_000,async()=>{

    const index=await bsdLeagues();

    let rows=[];

    for(let page=0;page<4;page++){

      const params=new URLSearchParams({date_from:start,date_to:until,limit:'200',offset:String(page*200)});

      const out=await bsdRequest(`/events/?${params}`,10*60_000);

      const part=bsdItems(out.value);

      rows.push(...part);

      // El proveedor pagina los eventos; nunca asumir que hay solo una página.

      if(!out.value.next||part.length===0)break;

      if(page===3)console.warn('BSD: truncado después de 800 eventos; limita por liga si es necesario.');

    }

    return rows.map(x=>bsdGame(x,index)).filter(g=>g.id&&g.date&&

      peruDate(new Date(g.date))>=start&&peruDate(new Date(g.date))<=end);

  });

  return r;

}

async function bsdLive(){

  const [index,r]=await Promise.all([bsdLeagues(),bsdRequest('/events/live/',3*60_000)]);

  return {items:bsdItems(r.value).map(x=>bsdGame(x,index,true)).filter(x=>x.id),

    stale:r.stale,saved:r.saved,warning:r.warning||null};

}

async function dailyFixtures(day,ttl,{preferBSD=false}={}){

  const end=plusDays(peruDate(),1);

  let primaryError=null,stalePrimary=null;

  if(!preferBSD&&!PRIMARY_DISABLED&&configured('FOOTBALL_API_KEY')){

    try{

      const r=await sport(`/fixtures?date=${day}&timezone=America%2FLima`,ttl);

      if(!r.stale)return {items:(r.value.response||[]).map(fixture),source:'api-football',stale:false,saved:r.saved};

      // Una copia antigua NO sustituye a una consulta reciente del respaldo.

      stalePrimary={items:(r.value.response||[]).map(fixture),source:'api-football',stale:true,saved:r.saved,warning:r.warning};

      primaryError=r.warning||'Datos antiguos de API-Football';

    }catch(e){primaryError=e.message;}

  }

  if(configured('BZZOIRO_API_KEY')){

    try{

      const r=await bsdFixtures(peruDate(),end);

      return {items:r.value.filter(g=>peruDate(new Date(g.date))===day),source:'bsd',stale:r.stale,

        saved:r.saved,warning:primaryError?`Respaldo BSD activado: ${primaryError}`:(r.warning||null)};

    }catch(e){

      if(stalePrimary)return {...stalePrimary,warning:`BSD no disponible: ${e.message}. Se conserva última respuesta de API-Football.`};

      throw new ApiFailure(`API-Football: ${primaryError||'sin clave'}; BSD: ${e.message}`,e.status||502);

    }

  }

  if(stalePrimary)return stalePrimary;

  throw new ApiFailure(primaryError||'Configura FOOTBALL_API_KEY o BZZOIRO_API_KEY en backend/.env',503);

}

// Persist successful responses and a conservative local request budget between server restarts.

let state={day:providerQuotaDay(),used:0,cache:{}};

try{const old=JSON.parse(fs.readFileSync(STATE_FILE,'utf8'));if(old && typeof old==='object') state={...state,...old};}catch{}

const inflight = new Map();

function save(){fs.mkdirSync(RUNTIME,{recursive:true});const now=Date.now();state.cache=Object.fromEntries(Object.entries(state.cache||{}).filter(([k,v])=>v && (v.expires>now || (v.saved||0)>now-86400000)).slice(-110));fs.writeFileSync(STATE_FILE,JSON.stringify(state));}

function daily(){if(state.day!==providerQuotaDay()){state.day=providerQuotaDay();state.used=0;save();}}

class ApiFailure extends Error{constructor(message,status=502){super(message);this.status=status;}}

async function httpJson(url,headers={}){

  const r=await fetch(url,{headers,signal:AbortSignal.timeout(14000)});

  const payload=await r.json().catch(()=>({}));

  if(!r.ok)throw new ApiFailure(`Proveedor HTTP ${r.status}: ${payload.message||(typeof payload.error==='string'?payload.error:payload.error?.message)||'solicitud rechazada'}`,r.status===429?429:502);

  if(payload.errors && ((Array.isArray(payload.errors)&&payload.errors.length)||(!Array.isArray(payload.errors)&&Object.keys(payload.errors).length)))throw new ApiFailure(`Servicio externo: ${JSON.stringify(payload.errors)}`);

  if(payload.status==='error')throw new ApiFailure(payload.message||'Error externo');

  return payload;

}

async function remember(key,ttl,fn,{budget=false,staleOnError=true}={}){

  const found=state.cache[key];if(found?.expires>Date.now())return {value:found.value,stale:false,saved:found.saved};

  if(inflight.has(key))return inflight.get(key);

  const p=(async()=>{

    try{

      if(budget){daily();if(state.used>=DAILY_LIMIT){if(found)return {value:found.value,stale:true,saved:found.saved,warning:'Presupuesto diario agotado; se muestran datos guardados hasta que vuelva la cuota.'};throw new ApiFailure('Se agotó el presupuesto preventivo de API-Football. Se reinicia a las 00:00 UTC (19:00 de Perú); las otras APIs siguen funcionando.',429);}

        state.used++;save();}

      const value=await fn();const saved=Date.now();state.cache[key]={value,expires:saved+ttl,saved};save();return {value,stale:false,saved};

    }catch(e){if(found && staleOnError)return {value:found.value,stale:true,saved:found.saved,warning:e.message};throw e;}

  })();inflight.set(key,p);try{return await p}finally{inflight.delete(key)}

}

const auth=()=>({'x-apisports-key':process.env.FOOTBALL_API_KEY});

const footballDataAuth=()=>({'X-Auth-Token':process.env.FOOTBALL_DATA_TOKEN});

const dataRequests=[];

async function footballDataStandings(league,season){

  const code=FOOTBALL_DATA_CODES.get(league);

  if(!code)throw new ApiFailure('football-data.org no cubre las tablas de esta competición.',400);

  const seasonQuery=season?`?season=${season}`:'';

  const endpoint=`/competitions/${code}/standings${seasonQuery}`;

  return remember(`football-data:${endpoint}`,45*60_000,async()=>{

    // Tope de seguridad por proceso: menos de 10 solicitudes/minuto del plan gratuito.

    const now=Date.now();

    while(dataRequests.length&&now-dataRequests[0]>=60_000)dataRequests.shift();

    if(dataRequests.length>=8)throw new ApiFailure('Límite preventivo de football-data.org: vuelve a consultar en un minuto.',429);

    dataRequests.push(now);

    return httpJson(FOOTBALL_DATA_API+endpoint,footballDataAuth());

  },{staleOnError:true});

}



// El contador se guarda en .runtime para no reiniciarlo al reiniciar Node.js.

// YouTube cuenta las búsquedas por día en horario del Pacífico.

const youtubeDay = () => new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());

function youtubeBudget(){

  const today=youtubeDay();

  if(!state.youtubeSearch || state.youtubeSearch.day!==today){

    state.youtubeSearch={day:today,used:0};save();

  }

  return state.youtubeSearch;

}

function useYoutubeSearch(){

  const b=youtubeBudget();

  if(b.used>=YOUTUBE_SEARCH_LIMIT)throw new ApiFailure('Se alcanzó el presupuesto diario preventivo de búsquedas en YouTube. Intenta más tarde.',429);

  b.used++;save();

}

const configured=(name)=>Boolean(process.env[name]?.trim());



// Corregir discrepancias entre el contador local y el consumo REAL del proveedor.

// API-Football GET /status es gratuito y no se descuenta de las 100 solicitudes/día.

// Se consulta como máximo una vez cada 2 minutos y también antes de bloquear nuevas consultas.

let lastFootballQuotaSync=0;

let footballQuotaSyncPromise=null;

let footballQuotaSyncError=null;

async function syncFootballQuota(){

  if(!configured('FOOTBALL_API_KEY'))return;

  if(Date.now()-lastFootballQuotaSync<2*60_000)return;

  if(footballQuotaSyncPromise)return footballQuotaSyncPromise;

  footballQuotaSyncPromise=(async()=>{

    try{

      const r=await fetch(`${SPORT_API}/status`,{

        headers:auth(),signal:AbortSignal.timeout(10000)

      });

      if(!r.ok)throw new Error(`API-Football /status HTTP ${r.status}`);

      const data=await r.json();

      if(data.errors && Object.keys(data.errors).length)

        throw new Error(`API-Football /status: ${JSON.stringify(data.errors)}`);

      const official=Number(data.response?.requests?.current);

      if(!Number.isInteger(official)||official<0)

        throw new Error('API-Football /status no devolvió un contador válido');

      daily();

      state.used=official;

      save(); // Conservar estado y respuestas cacheadas.

      footballQuotaSyncError=null;

    }catch(error){

      // Si falla /status, NO desbloquear a ciegas: seguimos con el contador local.

      footballQuotaSyncError=error.message;

      console.warn('No se pudo sincronizar la cuota real:',error.message);

    }finally{

      lastFootballQuotaSync=Date.now();

    }

  })();

  try{return await footballQuotaSyncPromise}finally{footballQuotaSyncPromise=null}

}

async function sport(endpoint,ttl,{staleOnError=true}={}){

  await syncFootballQuota();

  return remember('sport:'+endpoint,ttl,()=>httpJson(SPORT_API+endpoint,auth()),{budget:true,staleOnError});

}

function apiError(res,e){res.status(e.status||502).json({error:e.message,items:[],source:'error'});}

function demoResponse(res,items,meta={}){res.json({items,source:'demo',demo:true,...meta});}

function disabled(res,key){if(!configured(key)){res.status(200).json({items:[],demo:true,source:'demo',notice:`Configura ${key} en backend/.env para datos reales.`});return true;}return false;}



// A deliberately clearly labelled DEMO: no fabricated live scores, no fake news headlines.

const EXAMPLES=[

{id:1,leagueId:39,league:'Premier League',home:'Liverpool',away:'Arsenal',homeId:101,awayId:102,score:'2 - 1',homeGoals:2,awayGoals:1,type:'finished',status:'FT',homeLogo:null,awayLogo:null,minute:null},

{id:2,leagueId:140,league:'LaLiga',home:'Real Madrid',away:'Barcelona',homeId:103,awayId:104,score:'vs',type:'upcoming',status:'NS',homeLogo:null,awayLogo:null,minute:null},

{id:3,leagueId:78,league:'Bundesliga',home:'Bayern Múnich',away:'Borussia Dortmund',homeId:105,awayId:106,score:'0 - 0',type:'finished',status:'FT',homeLogo:null,awayLogo:null,minute:null},

{id:4,leagueId:135,league:'Serie A',home:'Inter',away:'Juventus',homeId:107,awayId:108,score:'vs',type:'upcoming',status:'NS',homeLogo:null,awayLogo:null,minute:null}

];

const DEMO_NEWS=[{title:'Activa NewsAPI para consultar noticias verificables',description:'Las noticias se filtrarán por competición y fecha dentro de hoy y mañana.',source:'Guía FutbolLive',url:null,publishedAt:null,image:null,demo:true}];

const DEMO_VIDEOS=[{id:null,title:'Conecta YouTube Data API para ver videos de la liga seleccionada',thumbnail:null,publishedAt:null,channel:'Demostración',demo:true}];

function demoMatches(start,leagueId){return EXAMPLES.filter(x=>!leagueId||x.leagueId===leagueId).map((x,i)=>({...x,date:plusDays(start,i%2)+'T17:00:00-05:00'}));}

const DEMO_TABLE=[['Liverpool',21,14,4,3,46],['Arsenal',21,13,5,3,44],['Manchester City',21,12,4,5,40],['Chelsea',21,11,4,6,37],['Tottenham',21,10,5,6,35]].map((v,i)=>({rank:i+1,team:v[0],played:v[1],win:v[2],draw:v[3],lose:v[4],points:v[5],goalDiff:0,logo:null}));



app.get('/api/health',async(req,res)=>{await syncFootballQuota();daily();res.json({

  ok:true,service:'FutbolLive',

  configured:{football:configured('FOOTBALL_API_KEY'),bsd:configured('BZZOIRO_API_KEY'),news:configured('NEWS_API_KEY'),gnews:configured('GNEWS_API_KEY'),gnewsEducationApproved:process.env.GNEWS_EDUCATION_APPROVED==='true',youtube:configured('YOUTUBE_API_KEY'),footballData:configured('FOOTBALL_DATA_TOKEN')},

  footballBudget:{used:state.used,limit:DAILY_LIMIT,remaining:Math.max(0,DAILY_LIMIT-state.used),resetAtUTC:nextQuotaResetUTC(),verifiedWithProvider:!PRIMARY_DISABLED && !footballQuotaSyncError && lastFootballQuotaSync>0,syncWarning:PRIMARY_DISABLED?null:(footballQuotaSyncError||null)},

  windowDays:2,weekDays:2,

  classificationProvider:configured('FOOTBALL_DATA_TOKEN')?'football-data.org para 5 ligas europeas':'API-Football (sujeta a su plan)',

  matchProviders:{primary:PRIMARY_DISABLED?'BSD':'API-Football',fallback:'BSD',fallbackEnabled:configured('BZZOIRO_API_KEY'),footballPrimaryDisabled:PRIMARY_DISABLED},

  youtubeSearchBudget:{used:youtubeBudget().used,limit:YOUTUBE_SEARCH_LIMIT,remaining:Math.max(0,YOUTUBE_SEARCH_LIMIT-youtubeBudget().used)},

  today:peruDate(),tomorrow:plusDays(peruDate(),1)

});});

app.get('/api/football-data/estado',(req,res)=>res.json({configured:configured('FOOTBALL_DATA_TOKEN'),provider:'football-data.org',competitions:[...FOOTBALL_DATA_CODES].map(([leagueId,code])=>({leagueId,code}))}));

app.get('/api/bsd/prueba',async(req,res)=>{

  if(!configured('BZZOIRO_API_KEY'))return res.status(400).json({ok:false,configured:false,message:'Configura BZZOIRO_API_KEY en backend/.env'});

  try{

    const r=await bsdRequest('/events/live/',3*60_000);

    return res.json({ok:true,configured:true,provider:'BSD',liveEvents:bsdItems(r.value).length,cached:r.stale===false&&r.saved<Date.now()-3000,checkedAt:new Date().toISOString()});

  }catch(e){return res.status(e.status||502).json({ok:false,configured:true,provider:'BSD',error:e.message});}

});

app.get('/api/ligas',(req,res)=>res.json({items:LEAGUES}));



// Hoy y mañana, siempre en hora peruana. Mantener la ruta /semana para compatibilidad.

const twoDayFixturesHandler=async(req,res)=>{

 try{

  const {start,end,days}=getWindow(req),id=Number(req.query.league)||null;

  const provider=String(req.query.provider||'auto');

  if(!['auto','bsd'].includes(provider))return res.status(400).json({items:[],error:'Proveedor no admitido: usa auto o bsd'});

  if(provider==='auto'&&!configured('FOOTBALL_API_KEY')&&!configured('BZZOIRO_API_KEY'))return demoResponse(res,demoMatches(start,id),{start,end,days});

  const answers=await Promise.all(days.map(async day=>{

    try{

      const ttl=day===peruDate()?45*60_000:4*3600_000;

      const r=await dailyFixtures(day,ttl,{preferBSD:provider==='bsd'});

      return {day,...r};

    }catch(e){return {day,items:[],error:e.message};}

  }));

  const items=answers.flatMap(x=>x.items).filter(x=>!id||x.leagueId===id)

    .sort((a,b)=>(a.timestamp||0)-(b.timestamp||0));

  const providers=[...new Set(answers.filter(x=>x.source).map(x=>x.source))];

  const source=providers.length===1?providers[0]:providers.length>1?'mixed':'error';

  const errors=answers.filter(x=>x.error).map(x=>`${x.day}: ${x.error}`);

  res.json({items,start,end,days,source,providers,stale:answers.some(x=>x.stale),

    partial:errors.length>0,errors,warnings:answers.filter(x=>x.warning).map(x=>`${x.day}: ${x.warning}`),

    lastFetched:Math.max(0,...answers.map(x=>x.saved||0))});

 }catch(e){apiError(res,e)}

};

app.get('/api/futbol/dos-dias',twoDayFixturesHandler);

app.get('/api/futbol/semana',twoDayFixturesHandler);

// Backward compatibility with the original FutbolLive prototype.

app.get('/api/futbol/partidos',async(req,res)=>{

 try{

  const date=validDay(req.query.date)?req.query.date:peruDate();

  if(date!==peruDate()&&date!==plusDays(peruDate(),1))return res.status(400).json({error:'Solo se consultan hoy y mañana (hora Perú).',items:[]});

  if(!configured('FOOTBALL_API_KEY')&&!configured('BZZOIRO_API_KEY'))return demoResponse(res,demoMatches(addDateFallback(date),null),{date});

  const r=await dailyFixtures(date,date===peruDate()?45*60_000:4*3600_000,{preferBSD:req.query.provider==='bsd'});

  const filter=String(req.query.estado||'all');

  const items=r.items.filter(f=>filter==='all'||f.type===filter);

  res.json({items,date,source:r.source,stale:r.stale,lastFetched:r.saved,warning:r.warning||null});

 }catch(e){apiError(res,e)}

});

function addDateFallback(day){return plusDays(day,-1)}

// Live-specific endpoint makes a single call for all leagues; uses adaptive server TTL to save quota.

app.get('/api/futbol/en-vivo',async(req,res)=>{

 try{

  if(!configured('FOOTBALL_API_KEY')&&!configured('BZZOIRO_API_KEY'))return demoResponse(res,[],{notice:'Configura al menos una API de partidos.'});

  const leagueId=Number(req.query.league)||null;

  let primaryError=null,old=null;

  if(req.query.provider!=='bsd'&&!PRIMARY_DISABLED&&configured('FOOTBALL_API_KEY')){

    try{

      const recent=state.cache['sport:/fixtures?live=all']?.value?.response||[];

      const ttl=recent.length?15*60_000:60*60_000;

      const r=await sport('/fixtures?live=all',ttl);

      const items=(r.value.response||[]).map(fixture).filter(x=>x.live&&(!leagueId||x.leagueId===leagueId));

      if(!r.stale)return res.json({items,total:items.length,source:'api-football',stale:false,lastFetched:r.saved,refreshMinutes:ttl/60_000});

      old={items,total:items.length,source:'api-football',stale:true,lastFetched:r.saved,warning:r.warning};

      primaryError=r.warning||'caché antigua';

    }catch(e){primaryError=e.message;}

  }

  if(configured('BZZOIRO_API_KEY')){

    try{

      const r=await bsdLive();

      const items=r.items.filter(x=>!leagueId||x.leagueId===leagueId);

      return res.json({items,total:items.length,source:'bsd',stale:r.stale,lastFetched:r.saved,refreshMinutes:3,

        warning:primaryError?`Respaldo BSD activado: ${primaryError}`:r.warning||null});

    }catch(e){if(old)return res.json({...old,warning:`BSD falló: ${e.message}`});throw new ApiFailure(`API-Football: ${primaryError||'no configurada'}; BSD: ${e.message}`,e.status||502);}

  }

  if(old)return res.json(old);

  throw new ApiFailure(primaryError||'No hay proveedor para partidos en vivo',503);

 }catch(e){apiError(res,e)}

});

// Compatibilidad: React consulta la misma ruta, pero obtiene tablas ACTUALES

// desde football-data.org para las cinco ligas con cobertura gratis.

async function classificationHandler(req,res){

 try{

  const league=Number(req.query.league||39);

  const conf=LEAGUES.find(l=>l.id===league);

  if(!conf)return res.status(400).json({error:'Liga no admitida'});

  const code=FOOTBALL_DATA_CODES.get(league);

  const seasonParam=String(req.query.season||'').trim();

  const now=new Date();const currentYear=Number(peruDate(now).slice(0,4));

  if(seasonParam&&(!/^\d{4}$/.test(seasonParam)||Number(seasonParam)<2010||Number(seasonParam)>currentYear+1))return res.status(400).json({error:'Temporada inválida'});

  const season=seasonParam?Number(seasonParam):null;

  if(code&&configured('FOOTBALL_DATA_TOKEN')){

    // Sin ?season se pide explícitamente la temporada ACTUAL del proveedor.

    const result=await footballDataStandings(league,season);

    return res.json({...transformFootballDataStandings(result.value),stale:result.stale,lastFetched:result.saved,warning:result.warning||null});

  }

  // Se mantiene API-Football para copas/ligas no cubiertas por la cuarta API.

  if(!configured('FOOTBALL_API_KEY'))return res.json({groups:[{title:'Ejemplo de tabla · demostración',rows:league===39?DEMO_TABLE:[]}],items:league===39?DEMO_TABLE:[],demo:true,source:'demo',notice:code?'Configura FOOTBALL_DATA_TOKEN para ver posiciones actuales.':'No hay proveedor configurado.'});

  const year=currentYear,month=Number(peruDate(now).slice(5,7));

  const selectedSeason=season||(conf.seasonType==='cross'?(month>=7?year:year-1):year);

  const r=await sport(`/standings?league=${league}&season=${selectedSeason}`,6*3600_000);

  const result=standings(r.value);

  res.json({...result,items:result.groups[0]?.rows||[],season:selectedSeason,source:'api-football',stale:r.stale,warning:r.warning||null,notice:'Clasificación desde API-Football; su plan puede limitar las temporadas.'});

 }catch(e){apiError(res,e)}

}

app.get('/api/futbol/clasificacion',classificationHandler);

app.get('/api/football-data/clasificacion',classificationHandler);

app.get('/api/futbol/equipo/:id',async(req,res)=>{

 try{const id=Number(req.params.id);if(!Number.isInteger(id)||id<=0)return res.status(400).json({error:'Equipo inválido'});

 if(disabled(res,'FOOTBALL_API_KEY'))return;

 const r=await sport(`/teams?id=${id}`,24*3600_000);

 const x=r.value.response?.[0];res.json({team:x?.team||null,venue:x?.venue||null,source:'api-football',stale:r.stale});

 }catch(e){apiError(res,e)}

});



function mediaWindow(req){const {start,end}=getWindow(req);const now=peruDate();return {start,end,until:end>now?now:end,valid:start<=now};}

function mediaTopic(req){const league=LEAGUES.find(x=>x.id===Number(req.query.league));return (league?.name||String(req.query.q||'fútbol soccer').slice(0,80)).replace(/[<>]/g,'');}

// NewsAPI Developer publica noticias \~24h tarde. Seleccionamos DOS días

// de noticias realmente accesibles (entre hace 72 y hace 24 horas).

// El calendario HOY/MAÑANA aplica a PARTIDOS y VIDEOS, no a noticias atrasadas.

app.get('/api/noticias',async(req,res)=>{

 try{

  // GNews educativo: permitido para proyectos académicos NO comerciales tras aprobación.

  // La clave queda exclusivamente en Render/Node, nunca en React o Vercel.

  const production=process.env.NODE_ENV==='production';

  const gnewsReady=configured('GNEWS_API_KEY') && (!production || process.env.GNEWS_EDUCATION_APPROVED==='true');

  if(gnewsReady){

    const typed=String(req.query.q||'').replace(/[\x00-\x1f]/g,' ').trim().slice(0,90);

    const league=LEAGUES.find(x=>x.id===Number(req.query.league));

    const query=typed || (league ? league.name : 'fútbol');

    const from=new Date(Date.now()-48*3600_000).toISOString();

    const to=new Date().toISOString();

    const url=new URL('https://gnews.io/api/v4/search');

    // 10 artículos por consulta funciona también con la modalidad gratuita de prueba.

    for(const [k,v] of Object.entries({q:query,lang:'es',max:'10',from,to,sortby:'publishedAt',nullable:'description,image'}))url.searchParams.set(k,v);

    const bucket=Math.floor(Date.now()/(30*60_000));

    const r=await remember('gnews:'+query.toLowerCase()+':'+bucket,30*60_000,()=>httpJson(url,{'X-Api-Key':process.env.GNEWS_API_KEY}),{staleOnError:true});

    const items=(r.value.articles||[]).filter(x=>x.title && /^https?:\/\//i.test(x.url||''))

      .map(x=>({title:x.title,description:x.description||'',image:x.image||null,source:x.source?.name||'Medio',url:x.url,publishedAt:x.publishedAt}));

    return res.json({items,source:'gnews',from,to,query,stale:r.stale,notice:'Noticias en español de las últimas 48 horas. La disponibilidad y el retraso dependen del plan GNews.'});

  }

  if(production && process.env.NEWS_PUBLIC_ENABLED!=='true')

    return res.json({items:[],source:'unavailable',notice:'Para activar noticias públicas, solicita acceso académico de GNews, configura GNEWS_API_KEY y GNEWS_EDUCATION_APPROVED=true en Render. NewsAPI Developer no permite producción.'});

  // NewsAPI Developer solo autoriza desarrollo: no consultarla desde un sitio público.

  // Activa NEWS_PUBLIC_ENABLED=true únicamente con una licencia que permita producción.

  if(process.env.NODE_ENV==='production' && process.env.NEWS_PUBLIC_ENABLED!=='true')

    return res.json({items:[],source:'unavailable',notice:'Noticias no habilitadas en publicación pública: NewsAPI Developer es solo para desarrollo. Requiere plan autorizado u otra fuente con licencia compatible.'});

  if(!configured('NEWS_API_KEY'))return demoResponse(res,DEMO_NEWS);

  const topic=mediaTopic(req);

  const endTimestamp=Date.now()-24*3600_000;

  const startTimestamp=endTimestamp-48*3600_000;

  const from=new Date(startTimestamp).toISOString();

  const to=new Date(endTimestamp).toISOString();

  const search=`(${topic}) AND (fútbol OR football OR soccer OR liga OR partido)`;

  const url=new URL('https://newsapi.org/v2/everything');

  for(const [key,value] of Object.entries({q:search,from,to,pageSize:'24',sortBy:'publishedAt',language:'es'}))url.searchParams.set(key,value);

  const r=await remember('news:'+topic+':'+new Date(endTimestamp).toISOString().slice(0,13),60*60_000,()=>httpJson(url,{'X-Api-Key':process.env.NEWS_API_KEY}));

  const items=(r.value.articles||[]).filter(a=>a.title&&a.url&&!a.title.includes('[Removed]'))

   .map(a=>({title:a.title,description:a.description||'',image:a.urlToImage||null,source:a.source?.name||'Medio',url:a.url,publishedAt:a.publishedAt}));

  res.json({items,source:'newsapi',from,to,stale:r.stale,notice:'Noticias de los últimos dos días disponibles. NewsAPI Developer entrega artículos con unas 24 h de retraso; no son noticias en tiempo real.'});

 }catch(e){apiError(res,e)}

});

// ================================================================

// RESÚMENES DE ENCUENTROS: no son videos genéricos sobre las ligas.

// Pasos: partidos reales de hoy/mañana -> finalizados -> búsqueda

// específica por rivales -> verificar título y fecha -> mostrar.

// ================================================================

function normalizeFootballText(value){

  return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')

    .replace(/&amp;/gi,' and ').replace(/&#39;|&apos;/gi,"'")

    .toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();

}

function teamAliases(name){

  const n=normalizeFootballText(name);

  const aliases=[n,n.replace(/\b(fc|cf|sc|ac|afc|club|football|de|del|the)\b/g,' ').replace(/\s+/g,' ').trim()];

  const special={

    'manchester united':['man united','man utd','manchester utd'],

    'manchester city':['man city'],

    'tottenham hotspur':['tottenham','spurs'],

    'newcastle united':['newcastle'],

    'west ham united':['west ham'],

    'leeds united':['leeds'],

    'nottingham forest':['forest'],

    'brighton and hove albion':['brighton'],

    'wolverhampton wanderers':['wolves','wolverhampton'],

    'leicester city':['leicester'],

    'paris saint germain':['psg','paris sg'],

    'internazionale':['inter milan','inter'],

    'inter milan':['internazionale'],

    'ac milan':['milan'],

    'bayern munich':['bayern munchen','bayern'],

    'bayern munchen':['bayern munich','bayern'],

    'atletico madrid':['atletico de madrid'],

    'athletic club':['athletic bilbao'],

    'borussia dortmund':['dortmund'],

    'bayer 04 leverkusen':['bayer leverkusen','leverkusen'],

    'real sociedad':['la real'],

    'olympique de marseille':['marseille'],

    'olympique lyonnais':['lyon'],

    'sporting cp':['sporting portugal'],

    'rb leipzig':['leipzig']

  };

  for(const [key,extra] of Object.entries(special))if(n===key||aliases.includes(key))aliases.push(...extra);

  // Evitar coincidencias demasiado genéricas como FC, City, United, SC, W.

  return [...new Set(aliases)].filter(x=>x&&x.length>=4&&!['united','city','sporting','real','club'].includes(x));

}

function containsTeam(title,name){

  const t=' '+normalizeFootballText(title)+' ';

  return teamAliases(name).some(a=>t.includes(' '+a+' '));

}

const HIGHLIGHT_TERMS=/\b(resumen|resumos?|resumo|highlights?|goles|goals?|gols?|mejores momentos|melhores momentos|zusammenfassung|resume|resum[eé]|extended highlights|short highlights)\b/i;

const EXCLUDE_VIDEO_TERMS=/\b(previa|preview|predicci[oó]n|prediction|pron[oó]stico|reaction|reacci[oó]n|stream|directo|en vivo|live stream|watchalong|simulation|simulaci[oó]n|efootball|fc 26|fifa 26|pes 2026|full match|partido completo|extended full game)\b/i;

function videoIsMatchSummary(item,game,windowEnd){

  const snippet=item.snippet||{};

  const title=normalizeFootballText(snippet.title);

  if(!title||!HIGHLIGHT_TERMS.test(title)||EXCLUDE_VIDEO_TERMS.test(title))return false;

  if(!containsTeam(title,game.home)||!containsTeam(title,game.away))return false;

  const published=Date.parse(snippet.publishedAt||'');

  const kickoff=Date.parse(game.date||'');

  if(!Number.isFinite(published)||!Number.isFinite(kickoff))return false;

  // Publicado después del partido (no una previa) y dentro de hoy/mañana.

  return published>=kickoff+70*60_000 && published<=Math.min(Date.now(),windowEnd);

}

function youtubeItem(item,game){return {

  id:item.id?.videoId||null,title:item.snippet?.title||'',description:item.snippet?.description||'',

  thumbnail:item.snippet?.thumbnails?.high?.url||item.snippet?.thumbnails?.medium?.url||null,

  publishedAt:item.snippet?.publishedAt||null,channel:item.snippet?.channelTitle||'YouTube',

  fixtureId:game.id,home:game.home,away:game.away,score:game.score,

  league:game.league,leagueId:game.leagueId,matchDate:game.date

};}

async function searchHighlightsForFixture(game,windowEnd){

  const cacheKey=`youtube:match-highlights:v2:${game.id}:${peruDate()}`;

  return remember(cacheKey,2*3600_000,async()=>{

    useYoutubeSearch();

    const url=new URL('https://www.googleapis.com/youtube/v3/search');

    for(const [key,value] of Object.entries({

      part:'snippet',type:'video',videoEmbeddable:'true',maxResults:'18',order:'relevance',

      q:`${game.home} ${game.away} highlights resumen goles`,

      publishedAfter:new Date(Date.parse(game.date)+70*60_000).toISOString(),

      publishedBefore:new Date(Math.min(Date.now(),windowEnd)).toISOString(),

      key:process.env.YOUTUBE_API_KEY

    }))url.searchParams.set(key,value);

    const result=await httpJson(url);

    return (result.items||[]).filter(x=>x.id?.videoId&&videoIsMatchSummary(x,game,windowEnd))

      .slice(0,2).map(x=>youtubeItem(x,game));

  },{staleOnError:true});

}

app.get('/api/videos',async(req,res)=>{

 try{

  if(!configured('YOUTUBE_API_KEY'))return demoResponse(res,DEMO_VIDEOS);

  if(!configured('FOOTBALL_API_KEY')&&!configured('BZZOIRO_API_KEY'))return res.json({items:[],source:'youtube',notice:'Para verificar los resúmenes hace falta API-Football o BSD.'});

  const {start,end,days}=getWindow(req);

  const selectedLeague=Number(req.query.league)||null;

  if(selectedLeague&&!LEAGUES.some(l=>l.id===selectedLeague))return res.status(400).json({items:[],error:'Liga no admitida'});

  const requestedDay=String(req.query.day||'all');

  if(requestedDay!=='all'&&!days.includes(requestedDay))return res.status(400).json({items:[],error:'Selecciona hoy o mañana'});

  const lastPublication=Date.parse(end+'T23:59:59-05:00');

  // Dos fechas exclusivamente. Aprovecha la caché de partidos que usa la página.

  const fixtureDays=await Promise.all(days.filter(day=>requestedDay==='all'||requestedDay===day).map(async day=>{

    try{

      const ttl=day===peruDate()?12*60_000:4*3600_000;

      const r=await dailyFixtures(day,ttl);

      return {items:r.items,warning:r.warning||null};

    }catch(e){return {items:[],error:e.message};}

  }));

  const fixtureErrors=fixtureDays.filter(r=>r.error).map(r=>r.error);

  // En 'Todas las ligas' se admiten también los partidos BSD que no tienen
  // equivalente entre las ligas destacadas de API-Football (leagueId=null).
  // Cuando se selecciona una liga concreta, se respeta exclusivamente esa liga.
  const finished=[...new Map(fixtureDays
    .flatMap(d=>d.items)
    .filter(g=>g && (g.finished === true || g.type === 'finished' || ['FT','AET','PEN'].includes(g.status)))
    .filter(g=>!selectedLeague || g.leagueId === selectedLeague)
    .filter(g=>g.id && g.home && g.away && Number.isFinite(Date.parse(g.date||'')))
    .map(g=>[String(g.id),g])).values()]
    .sort((a,b)=>(b.timestamp||0)-(a.timestamp||0));

  // Lotes de cinco encuentros. El siguiente lote solo se consulta al pulsar 'Siguientes'.

  const offsetRaw=Number(req.query.offset||0);

  const offset=Number.isInteger(offsetRaw)&&offsetRaw>=0&&offsetRaw<=100?offsetRaw:0;

  const candidates=finished.slice(offset,offset+5);

  const results=[];const warnings=[];

  // En secuencia para respetar mejor las cuotas del proveedor.

  for(const game of candidates){

    try{const r=await searchHighlightsForFixture(game,lastPublication);results.push(...r.value);if(r.warning)warnings.push(r.warning);}

    catch(e){warnings.push(e.message);if(e.status===429)break;}

  }

  const uniques=[...new Map(results.map(v=>[v.id,v])).values()];

  const count=uniques.length;

  let notice;

  if(!finished.length)notice=fixtureErrors.length?'No se pudieron obtener todos los partidos para validar videos.':'No hay partidos finalizados de esta liga en hoy y mañana. Los pendientes o en vivo aún no tienen resúmenes finales.';

  else if(!count)notice='Todavía no encontramos resúmenes que coincidan con ambos equipos de los encuentros revisados. No mostraremos videos de otras fechas ni de otros partidos.';

  else notice='Se muestran únicamente resúmenes cuyo título coincide con ambos equipos de un partido finalizado de hoy o mañana. Los videos son publicados por canales de YouTube; revisa su fuente.';

  res.json({items:uniques,source:'youtube',start,end,day:requestedDay,leagueId:selectedLeague,

    finishedMatches:finished.length,checkedMatches:candidates.length,matchedVideos:count,

    offset,hasMore:finished.length>offset+5,nextOffset:finished.length>offset+5?offset+5:null,

    partial:Boolean(warnings.length||fixtureErrors.length),warnings:[...fixtureErrors,...warnings].slice(0,3),notice,

    youtubeSearchBudget:{used:youtubeBudget().used,limit:YOUTUBE_SEARCH_LIMIT}});

 }catch(e){apiError(res,e)}

});



// Explicit demo endpoints: never substitute these silently for failed live results.

app.get('/api/demo/:part',(req,res)=>{const {start,end}=getWindow(req);const league=Number(req.query.league)||null;

 if(req.params.part==='semana'||req.params.part==='dos-dias')return demoResponse(res,demoMatches(start,league),{start,end,days:[start,end]});

 if(req.params.part==='clasificacion')return res.json({groups:[{title:'Ejemplo de clasificación',rows:DEMO_TABLE}],items:DEMO_TABLE,source:'demo',demo:true});

 if(req.params.part==='noticias')return demoResponse(res,DEMO_NEWS);

 if(req.params.part==='videos')return demoResponse(res,DEMO_VIDEOS);

 if(req.params.part==='en-vivo')return demoResponse(res,[],{notice:'La demostración nunca simula partidos en vivo.'});

 res.status(404).json({error:'Recurso no encontrado'});

});

app.use('/api',(req,res)=>res.status(404).json({error:'Ruta no encontrada'}));

app.get('/',(_,res)=>res.json({app:'FutbolLive API',health:'/api/health'}));

app.listen(PORT,()=>console.log(`FutbolLive API http://localhost:${PORT} | API-Football ${configured('FOOTBALL_API_KEY')} | BSD respaldo ${configured('BZZOIRO_API_KEY')}`));
