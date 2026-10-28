import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { Activity, ArrowLeft, ArrowRight, BadgeCheck, BarChart3, Bell, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, Clock3, ExternalLink, Flag, Heart, Home, Info, ListFilter, Menu, Moon, Newspaper, Play, Radio, RefreshCw, Search, Shield, ShieldCheck, Star, Sun, Trophy, Users, Video, Wifi, WifiOff, X } from 'lucide-react';
import './style.css';
const NAV=[['Inicio',Home],['Partidos',CalendarDays],['Clasificación',BarChart3],['Equipos',Shield],['Videos',Video]];
const TABS=['Resumen','Resultados','En vivo','Partidos','Clasificación','Videos'];
const demoLeagues=[
{id:39,name:'Premier League',country:'Inglaterra',flag:'🇬🇧',color:'#a83fe8'},
{id:140,name:'LaLiga',country:'España',flag:'🇪🇸',color:'#ed4747'},
{id:78,name:'Bundesliga',country:'Alemania',flag:'🇩🇪',color:'#e63d4b'},
{id:135,name:'Serie A',country:'Italia',flag:'🇮🇹',color:'#4c9cf9'},
{id:61,name:'Ligue 1',country:'Francia',flag:'🇫🇷',color:'#7aaaf3'},
{id:2,name:'Champions League',country:'Europa',flag:'🇪🇺',color:'#4164ff'},
{id:3,name:'Europa League',country:'Europa',flag:'🇪🇺',color:'#f7a543'},
{id:13,name:'Copa Libertadores',country:'Sudamérica',flag:'🌎',color:'#dcaf49'},
{id:281,name:'Liga 1 Perú',country:'Perú',flag:'🇵🇪',color:'#ed535d'}];
const dateKey=(date)=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Lima',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
function addDay(day,count){const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+count);return d.toISOString().slice(0,10)}
const startDefault=()=>dateKey(new Date());
const displayDate=(day,options={})=>new Intl.DateTimeFormat('es-PE',{timeZone:'UTC',...options}).format(new Date(day+'T12:00:00Z'));
const timeOf=(iso)=>iso?new Intl.DateTimeFormat('es-PE',{timeZone:'America/Lima',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(iso)):'--:--';
function fmtPublished(s){if(!s)return 'Sin fecha';try{return new Intl.DateTimeFormat('es-PE',{timeZone:'America/Lima',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(s))}catch{return 'Sin fecha'}}
function useStored(name,initial){const [v,set]=useState(()=>{try{const t=localStorage.getItem(name);return t===null?initial:JSON.parse(t)}catch{return initial}});useEffect(()=>{try{localStorage.setItem(name,JSON.stringify(v))}catch{}},[name,v]);return [v,set]}
const API_ORIGIN=String(import.meta.env.VITE_API_URL||'').trim().replace(/\/+$/,'');
const apiUrl=(path)=>`${API_ORIGIN}/api${path}`;
async function fetchJson(path){const response=await fetch(apiUrl(path));const data=await response.json();if(!response.ok||data.error)throw new Error(data.error||`HTTP ${response.status}`);return data}
function useRemote(path,refresh=0,enabled=true){const [state,setState]=useState({data:null,loading:false,error:null});useEffect(()=>{if(!enabled||!path)return;let active=true;let controller=new AbortController();const run=async()=>{if(!active)return;setState(s=>({...s,loading:!s.data,error:null}));try{const r=await fetch(apiUrl(path),{signal:controller.signal});const j=await r.json();if(!r.ok||j.error)throw new Error(j.error||`HTTP ${r.status}`);if(active)setState({data:j,loading:false,error:null});}catch(e){if(active&&e.name!=='AbortError')setState(s=>({...s,loading:false,error:e.message}));}};run();let timer=refresh?setInterval(run,refresh):null;return()=>{active=false;controller.abort();if(timer)clearInterval(timer)}},[path,refresh,enabled]);return state}

// Resolver nombres diferentes entre BSD y football-data.org sin mezclar IDs.
function logoName(s){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\b(fc|cf|ac|ssc|calcio|club|football|1908|1913|1919)\b/g,' ').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ')}
const LOGO_ALIASES={
 'inter':'internazionale','inter milan':'internazionale','ac milan':'milan',
 'ssc napoli':'napoli','as roma':'roma','ss lazio':'lazio',
 'juve':'juventus','hellas verona':'verona','atalanta bc':'atalanta',
 'parma calcio':'parma','bologna fc':'bologna','udinese calcio':'udinese'
};
function crestForTeam(name,entries){
 const n=logoName(name), alias=logoName(LOGO_ALIASES[n]||n);
 if(!n||n.length<3)return null;
 for(const t of entries){
   const names=[t.name,t.shortName].map(logoName).filter(Boolean);
   if(names.includes(n)||names.includes(alias))return t.logo||null;
 }
 return null;
}
function Crest({src,name='',size=32}){const [bad,setBad]=useState(false);useEffect(()=>setBad(false),[src]);return src&&!bad?<img className="crest" style={{width:size,height:size}} src={src} loading="lazy" alt="" onError={()=>setBad(true)}/>:<span className="crest-fallback" style={{width:size,height:size,fontSize:size*.30}}>{name.split(' ').filter(Boolean).slice(0,2).map(w=>w[0]).join('').toUpperCase()||'⚽'}</span>}
function Empty({message='No hay datos para estos filtros.',sub='',icon:Icon=Info}){return <div className="empty"><Icon size={25}/><b>{message}</b>{sub&&<small>{sub}</small>}</div>}
function StatusNote({data,error,loading}){return <>{error&&<div className="alert danger"><WifiOff size={16}/>{error}</div>}{data?.source==='demo'&&<div className="alert"><Info size={16}/>Modo demostración: los ejemplos no son resultados reales. Agrega la clave correspondiente en <code>backend/.env</code>.</div>}{data?.partial&&<div className="alert"><Info size={16}/>Algunos días no pudieron consultarse: {data.errors?.slice(0,2).join(' · ')}</div>}{data?.source==='bsd'&&<div className="alert provider-notice"><BadgeCheck size={16}/>Datos reales obtenidos de BSD.</div>}{data?.source==='mixed'&&<div className="alert provider-notice"><BadgeCheck size={16}/>Datos combinados de API-Football y BSD, sin mezclar identificadores de los proveedores.</div>}{data?.stale&&<div className="alert"><Clock3 size={16}/>Mostrando última información guardada para ahorrar cuota o por una falla temporal.</div>}{data?.warnings?.length&&data?.source!=='youtube'&&<div className="alert provider-notice"><Info size={16}/>{data.warnings.slice(0,1).join(' · ')}</div>}{loading&&!data&&<div className="skeleton-line"/>}</>}
function MatchRows({items=[],onTeam,emptyTitle,compact=false,favorites=[],toggleFavorite}){if(!items.length)return <Empty message={emptyTitle||'No hay encuentros en esta selección.'} sub="Puede tratarse de una fecha sin partidos o de una competición no cubierta."/>;
return <div className={'fixture-rows '+(compact?'compact':'')}>{items.map((m,i)=>{const live=m.type==='live';const status=live?(m.minute!=null?`${m.minute}'`:'EN VIVO'):m.type==='finished'?'Finalizado':m.type==='upcoming'?timeOf(m.date):m.status||'—';return <div className="fixture-row" key={`${m.id}-${i}`}>
<button className={'star-btn '+(favorites.includes(m.id)?'picked':'')} title="Guardar favorito" onClick={()=>toggleFavorite?.(m.id)}><Star size={17} fill={favorites.includes(m.id)?'currentColor':'none'}/></button>
<div className={'fixture-status '+(live?'ongoing':'')}>{live&&<span className="pulse"/>}{status}</div>
<div className="fixture-team"><button onClick={()=>onTeam?.(m.homeId,m.home)}><Crest src={m.homeLogo} name={m.home} size={24}/><span>{m.home}</span></button><button onClick={()=>onTeam?.(m.awayId,m.away)}><Crest src={m.awayLogo} name={m.away} size={24}/><span>{m.away}</span></button></div>
<div className={'fixture-score '+(live?'score-live':'')}>{m.type==='upcoming'?<span>vs</span>:<><strong>{m.homeGoals??m.score?.split(' - ')[0]??'-'}</strong><strong>{m.awayGoals??m.score?.split(' - ')[1]??'-'}</strong></>}</div>
<div className="fixture-competition"><span>{m.league}</span>{!compact&&<small>{displayDate(m.date?dateKey(new Date(m.date)):dateKey(new Date()),{day:'numeric',month:'short'})}</small>}</div>
</div>})}</div>}
function LeagueBadge({league,size=52}){
 const [failed,setFailed]=useState(false);
 useEffect(()=>setFailed(false),[league?.id]);
 const id=Number(league?.id);
 return <span className="league-emblem" style={{width:size,height:size,background:`${league?.color||'#1a7694'}1b`,color:league?.color||'#1fd68c',borderColor:`${league?.color||'#1fd68c'}33`}}>
  {Number.isInteger(id)&&id>0&&!failed?<img className="league-mark" src={`https://media.api-sports.io/football/leagues/${id}.png`} loading="lazy" alt="" onError={()=>setFailed(true)}/>:<Trophy size={size*.53}/>}
 </span>
}
const FLAG_FILE={39:'england',140:'spain',78:'germany',135:'italy',61:'france',2:'eu',3:'eu',13:'world',281:'peru'};
function LeagueFlag({league,compact=false}){const key=FLAG_FILE[Number(league?.id)]||'world';return <img className={'country-flag '+(compact?'country-flag-sm':'')} src={`/assets/flags/${key}.svg`} alt={league?.country?`Bandera: ${league.country}`:'Bandera de la competición'} loading="lazy"/>}
function LeagueCards({leagues,onSelect}){return <div className="league-grid designer-league-grid">{leagues.map(l=><button key={l.id} className={`league-card league-card-${l.id}`} onClick={()=>onSelect(l.id)} aria-label={`Ver ${l.name}`}><LeagueBadge league={l} size={66}/><strong>{l.name}</strong><span className="league-country"><LeagueFlag league={l}/>{l.country}</span></button>)}</div>}
function HomeLive({items=[],onTeam,onAll,loading=false,notice=''}){
 const live=items.filter(m=>m.live||m.type==='live');
 const shown=live.length?live.slice(0,5):items.filter(m=>m.type==='finished'||m.type==='upcoming').slice(0,5);
 return <section className="home-box home-live"><div className="home-box-heading"><h2><Radio size={20}/>{live.length?'Partidos en vivo':'Partidos de hoy y mañana'}</h2><button onClick={onAll}>Ver todos <ArrowRight size={16}/></button></div>
 {loading&&<div className="skeleton-line"/>}
 {shown.length?<div className="home-live-list">{shown.map((m,i)=><div className="home-live-row" key={`${m.id||i}-${i}`}><span className="home-live-status"><strong>{m.live?(m.minute!=null?`${m.minute}'`:'EN VIVO'):m.finished?'FINAL':timeOf(m.date)}</strong><small>{m.live?'En vivo':m.finished?'Terminado':'Próximo'}</small></span><button className="home-live-team" onClick={()=>onTeam?.(m.homeId,m.home)}><Crest src={m.homeLogo} name={m.home} size={31}/><span>{m.home}</span></button><strong className="home-live-score">{m.upcoming?'vs':`${m.homeGoals??'-'} - ${m.awayGoals??'-'}`}</strong><button className="home-live-team away" onClick={()=>onTeam?.(m.awayId,m.away)}><Crest src={m.awayLogo} name={m.away} size={31}/><span>{m.away}</span></button><span className="home-live-league"><LeagueFlag league={{id:m.leagueId,country:m.country}} compact/>{m.league}</span></div>)}</div>
 :<div className="home-box-empty"><Activity size={28}/><strong>No hay encuentros disponibles ahora.</strong><small>{notice||'Cuando BSD envíe partidos aparecerán aquí.'}</small></div>}
 </section>
}
function HomeResults({items=[],onAll}){
 const finished=items.filter(m=>m.finished||m.type==='finished').slice(0,4);
 const upcoming=items.filter(m=>m.upcoming||m.type==='upcoming').slice(0,4);
 const shown=finished.length?finished:upcoming;
 return <section className="home-box home-news"><div className="home-box-heading"><h2><CalendarDays size={20}/>{finished.length?'Resultados recientes':'Próximos partidos'}</h2><button onClick={onAll}>Ver todos <ArrowRight size={16}/></button></div>
 {shown.length?<div className="home-match-results">{shown.map((m,i)=><div className="home-result-item" key={`${m.id||i}`}><span className="home-result-league">{m.league||'Competición'} · {timeOf(m.date)}</span><div className="home-result-teams"><span>{m.home}</span><strong>{m.finished?m.score||`${m.homeGoals??'-'} - ${m.awayGoals??'-'}`:'vs'}</strong><span>{m.away}</span></div></div>)}</div>:<div className="home-box-empty"><CalendarDays size={26}/><strong>Sin partidos finalizados o próximos.</strong><small>BSD actualizará la información según su cobertura.</small></div>}
 </section>
}
function HomeLeagues({leagues,onSelect,onAll}){return <section className="home-box home-leagues"><div className="home-box-heading"><h2><Trophy size={20}/>Ligas</h2><button onClick={onAll}>Ver todas <ArrowRight size={16}/></button></div><div className="home-league-list">{leagues.map(l=><button key={l.id} onClick={()=>onSelect(l.id)}><LeagueFlag league={l}/><span className="league-region">{l.id===13?'SA':l.id===281?'PE':[2,3].includes(l.id)?'EU':l.id===39?'GB':l.id===140?'ES':l.id===78?'DE':l.id===135?'IT':'FR'}</span><span className="home-league-name">{l.name}</span><ChevronRight size={16}/></button>)}</div></section>}

function Standings({data,onTeam,limit}){const groups=data?.groups||[];if(!groups.length||!groups.some(g=>g.rows?.length))return <Empty message="No hay tabla disponible para esta liga o temporada." sub="Algunas copas o temporadas no ofrecen clasificación en el plan disponible." icon={BarChart3}/>;return <div className="standings-wrap">{data?.source==='football-data.org'&&<div className="standings-provider"><BadgeCheck size={15}/> Clasificación oficial de temporada {data.seasonLabel||data.season||'actual'} · Fuente: football-data.org (no limitada a 2 días)</div>}{groups.map((g,i)=><div key={i} className="standing-group"><div className="group-name">{g.title||'Clasificación'}</div><div className="table-scroll"><table className="standing-table"><thead><tr>{['#','Equipo','PJ','G','E','P','DG','PTS'].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{(limit?g.rows?.slice(0,limit):g.rows||[]).map((r,j)=><tr key={r.teamId||j}><td><span className={'rank-ribbon '+(j<4?'qualify':'')}>{r.rank||j+1}</span></td><td>{r.teamId?<button className="team-table" onClick={()=>onTeam?.(r.teamId,r.team)}><Crest src={r.logo} name={r.team} size={23}/>{r.team}</button>:<span className="team-table" title="Datos de la clasificación"><Crest src={r.logo} name={r.team} size={23}/>{r.team}</span>}</td><td>{r.played??'-'}</td><td>{r.win??'-'}</td><td>{r.draw??'-'}</td><td>{r.lose??'-'}</td><td>{r.goalDiff??'-'}</td><td className="points">{r.points??'-'}</td></tr>)}</tbody></table></div></div>)}</div>}
function VideoGrid({items=[],data=null,notRequested=false}){
 if(notRequested)return <Empty message="Resúmenes disponibles en la pestaña Videos" icon={Video} sub="Abre Videos para buscar resúmenes de partidos finalizados; así ahorramos consultas de YouTube."/>;
 return <>
 {data?.notice&&<div className="video-info"><Info size={17}/><span>{data.notice}</span></div>}
 {Boolean(data?.warnings?.length)&&<div className="alert"><Clock3 size={16}/>{data.warnings[0]}</div>}
 {data?.source==='youtube'&&<div className="video-summary"><b>{data.finishedMatches??0}</b> partidos finalizados de estas fechas · <b>{data.checkedMatches??0}</b> encuentros revisados · <b>{data.matchedVideos??0}</b> resúmenes coincidentes</div>}
 {!items.length?<Empty message="No hay resúmenes confirmados para estos partidos." icon={Video} sub="Puedes utilizar la búsqueda manual de abajo para encontrar resúmenes publicados por los canales deportivos."/>:<div className="video-cards">{items.map((v,i)=><article key={v.id||i} className="video-card"><div className="video-match-label"><span>⚽ {v.home} vs {v.away}</span><b>{v.score||''}</b></div>{v.id?<a href={`https://www.youtube.com/watch?v=${encodeURIComponent(v.id)}`} target="_blank" rel="noreferrer" className="video-img" aria-label={`Ver resumen: ${v.home} contra ${v.away} en YouTube`}>{v.thumbnail?<img src={v.thumbnail} alt="Miniatura del resumen" loading="lazy"/>:<Video size={40}/>}<span className="play-overlay"><Play fill="currentColor" size={19}/></span></a>:<div className="video-img"><Video size={35}/></div>}<h3>{v.title}</h3><small>{v.league||'Fútbol'} · {v.channel||'YouTube'} · {fmtPublished(v.publishedAt)}</small></article>)}</div>}
 {Boolean(data?.searchSuggestions?.length)&&<section className="manual-video-search"><h3><Video size={18}/> Buscar resúmenes de estos partidos</h3><p>Estos enlaces abren una búsqueda en YouTube. No son videos confirmados; verifica equipos, fecha y marcador antes de reproducir.</p><div className="manual-video-list">{data.searchSuggestions.map((g,i)=><a key={g.fixtureId||i} href={g.searchUrl} target="_blank" rel="noopener noreferrer" className="manual-video-item"><span><strong>{g.home} vs {g.away}</strong><small>{g.league||'Fútbol'} · {g.score||'Finalizado'}</small></span><span>Buscar resumen ↗</span></a>)}</div></section>}
 </>;
}
function VideoPager({data,offset,setOffset}){if(!data||(!data.hasMore&&!offset))return null;return <div className="video-pager"><button disabled={!offset} onClick={()=>setOffset(x=>Math.max(0,x-5))}><ArrowLeft size={15}/> Anteriores</button><span>Partidos {Math.min(offset+1,data.finishedMatches||0)}–{Math.min(offset+(data.checkedMatches||5),data.finishedMatches||0)} de {data.finishedMatches||0}</span><button disabled={!data.hasMore} onClick={()=>setOffset(x=>x+5)}>Siguientes 5 encuentros <ArrowRight size={15}/></button></div>}

function Panel({title,icon:Icon,action,children,className=''}){return <section className={'panel '+className}><div className="panel-heading"><h2>{Icon&&<Icon size={18}/>} {title}</h2>{action}</div>{children}</section>}
function makeDay(day){return {date:day,day:displayDate(day,{weekday:'short'}).replace('.',''),num:displayDate(day,{day:'2-digit'}),month:displayDate(day,{month:'short'}).replace('.','')}}
function App(){
 const [page,setPage]=useState('Inicio');const [leagues,setLeagues]=useState(demoLeagues);const [selectedLeague,setLeague]=useState(null);const [leagueTab,setLeagueTab]=useState('Resumen');const [weekStart,setWeekStart]=useState(startDefault);const [selectedDay,setSelectedDay]=useState('all');const [matchFilter,setMatchFilter]=useState('all');const [search,setSearch]=useState('');const [menu,setMenu]=useState(false);const [showCountries,setShowCountries]=useState(false);const [dark,setDark]=useStored('fl-theme',true);const [favorites,setFavorites]=useStored('fl-favorites',[]);const [onlyFavorites,setOnlyFavorites]=useState(false);const [activeTeam,setActiveTeam]=useState(null);const [seasonOverride,setSeasonOverride]=useState('');const [tick,setTick]=useState(0);const [videoOffset,setVideoOffset]=useState(0);
 const [apiHealth,setApiHealth]=useState(null);
 const weekEnd=addDay(weekStart,1);const weekDays=useMemo(()=>Array.from({length:2},(_,i)=>makeDay(addDay(weekStart,i))),[weekStart]);
 const params=`start=${weekStart}`;const league=leagues.find(l=>l.id===selectedLeague)||null;
 // No consumir API-Football en pantallas que no usan marcadores.
 const needMatches=['Inicio','Partidos','Liga','Equipos','Videos'].includes(page);
 const needLive=page==='Inicio'||page==='Partidos'||(page==='Liga'&&['Resumen','En vivo'].includes(leagueTab));
 const matchesState=useRemote(`/futbol/dos-dias?${params}`,60000,needMatches);
 const liveState=useRemote(`/futbol/en-vivo`,60000,needLive);
 const needTable=page==='Clasificación'||page==='Liga'||page==='Equipos'||page==='Inicio';
 const tableLeague=selectedLeague||39;
 const standingsState=useRemote(`/futbol/clasificacion?league=${tableLeague}${seasonOverride?`&season=${seasonOverride}`:''}`,0,needTable);
 // Buscar videos solo al abrir su sección evita gastar la cuota en Inicio o Resumen.
 const videoEnabled=page==='Videos'||(page==='Liga'&&leagueTab==='Videos');
 const videoState=useRemote(`/videos?${params}${selectedLeague?'&league='+selectedLeague:''}&day=${selectedDay}&offset=${videoOffset}`,0,videoEnabled);
 useEffect(()=>setVideoOffset(0),[selectedLeague,selectedDay,weekStart]);
 const teamState=useRemote(activeTeam?.id?`/futbol/equipo/${activeTeam.id}`:null,0,!!activeTeam?.id);
 useEffect(()=>{fetchJson('/ligas').then(d=>setLeagues(d.items||demoLeagues)).catch(()=>{});const check=()=>fetchJson('/health').then(setApiHealth).catch(()=>{});check();const id=setInterval(check,120000);return()=>clearInterval(id)},[]);
 useEffect(()=>{const t=setInterval(()=>{setTick(x=>x+1);const today=dateKey(new Date());setWeekStart(previous=>previous===today?previous:today);},60000);return()=>clearInterval(t)},[]);
 const crestState=useRemote(selectedLeague&&[39,140,78,135,61].includes(selectedLeague)?`/escudos?league=${selectedLeague}`:null,0,Boolean(selectedLeague&&[39,140,78,135,61].includes(selectedLeague)));
 const crestEntries=useMemo(()=>{
   const result=[...(crestState.data?.items||[])];
   if(standingsState.data?.source==='football-data.org'){
     for(const group of standingsState.data.groups||[])for(const row of group.rows||[])if(row.logo)result.push({name:row.team,shortName:row.team,logo:row.logo});
   }
   return result;
 },[crestState.data,standingsState.data]);
 const enrichMatch=(m)=>{
   if(!selectedLeague||m.leagueId!==selectedLeague||!crestEntries.length)return m;
   const homeLogo=m.homeLogo||crestForTeam(m.home,crestEntries);
   const awayLogo=m.awayLogo||crestForTeam(m.away,crestEntries);
   return homeLogo===m.homeLogo&&awayLogo===m.awayLogo?m:{...m,homeLogo,awayLogo};
 };
 const dataMatches=(matchesState.data?.items||[]).map(enrichMatch);
 const liveMatches=(liveState.data?.items||[]).map(enrichMatch);
 const sourceDemo=matchesState.data?.source==='demo'||(!apiHealth?.configured?.football&&!apiHealth?.configured?.bsd);
 const filteredByLeague=useMemo(()=>dataMatches.filter(m=>!selectedLeague||m.leagueId===selectedLeague),[dataMatches,selectedLeague]);
 const qs=search.trim().toLowerCase();
 const weekMatches=filteredByLeague.filter(m=>{
   if(selectedDay!=='all'&&(m.date?dateKey(new Date(m.date)):null)!==selectedDay)return false;
   if(qs&&!`${m.home} ${m.away} ${m.league}`.toLowerCase().includes(qs))return false;
   if(onlyFavorites&&!favorites.includes(m.id))return false;
   return true;
 });
 const scopedLive=liveMatches.filter(m=>m.date&&dateKey(new Date(m.date))>=weekStart&&dateKey(new Date(m.date))<=weekEnd&&(!selectedLeague||m.leagueId===selectedLeague)&&(!qs||`${m.home} ${m.away}`.toLowerCase().includes(qs))&&(!onlyFavorites||favorites.includes(m.id)));
 const mergedLive=useMemo(()=>{const m=new Map();for(const x of [...weekMatches.filter(x=>x.live),...scopedLive])m.set(x.id,x);return [...m.values()].sort((a,b)=>(a.timestamp||0)-(b.timestamp||0))},[weekMatches,scopedLive]);
 const matchesToShow=(matchFilter==='live'?mergedLive:weekMatches.filter(m=>matchFilter==='all'||m.type===matchFilter));
 const homeMatches=useMemo(()=>{const map=new Map();for(const m of dataMatches)if(m.id)map.set(m.id,m);for(const m of liveMatches)if(m.id)map.set(m.id,m);return [...map.values()].sort((a,b)=>(Number(b.live)-Number(a.live))||((a.timestamp||0)-(b.timestamp||0)));},[dataMatches,liveMatches]);
 const goPage=p=>{setPage(p);setMenu(false);setMatchFilter('all');if(p==='Inicio'){setLeague(null);setOnlyFavorites(false)}if(p!=='Liga'){setSeasonOverride('')}};
 const pickLeague=id=>{setLeague(id);setLeagueTab('Resumen');setPage('Liga');setSelectedDay('all');setMatchFilter('all');setOnlyFavorites(false);setSeasonOverride('');setMenu(false)};
 const toggleFavorite=id=>setFavorites(cur=>cur.includes(id)?cur.filter(x=>x!==id):[...cur,id]);
 const openTeam=(id,name)=>{if(id||name)setActiveTeam({id,name})};
 // Ventana fija móvil de hoy y mañana, sin flechas para recorrer fechas no autorizadas.
 const features=[{title:'Marcadores en vivo',subtitle:'BSD · resultados de partidos',icon:Radio,page:'Partidos',color:'red'},{title:'Clasificaciones',subtitle:'Tablas con escudos',icon:BarChart3,page:'Clasificación',color:'blue'},{title:'Resultados de hoy',subtitle:'Marcadores y resultados BSD',icon:CalendarDays,page:'Partidos',color:'green'},{title:'Resúmenes de partidos',subtitle:'Solo encuentros finalizados',icon:Play,page:'Videos',color:'purple'}];
 const standingsObj=standingsState.data;
 const showMatchList=(items,opt={})=><MatchRows items={items} onTeam={openTeam} favorites={favorites} toggleFavorite={toggleFavorite} emptyTitle={matchesState.data?.partial&&!items.length?'Partidos temporalmente no disponibles por límite de cuota o cobertura.':undefined} {...opt}/>;
 const videoItems=(videoState.data?.items||[]).filter(v=>(selectedDay==='all'||(v.publishedAt&&dateKey(new Date(v.publishedAt))===selectedDay))&&(!qs||v.title?.toLowerCase().includes(qs)));
 const chosenLive=selectedDay==='all'?mergedLive:mergedLive.filter(x=>x.date&&dateKey(new Date(x.date))===selectedDay);
 return <div className={'app '+(dark?'dark':'light')}>
 <header className="topbar topbar-premium"><button className="mobile-menu icon-button" aria-label="Abrir menú" onClick={()=>setMenu(!menu)}>{menu?<X/>:<Menu/>}</button><button className="logo" onClick={()=>goPage('Inicio')}><span className="logo-ball" aria-hidden="true">⚽</span><b>Futbol<span>Live</span></b></button><nav className="topnav topnav-premium" aria-label="Navegación principal">{NAV.map(([p])=><button key={p} className={page===p?'current':''} onClick={()=>goPage(p)}>{p}</button>)}</nav><button className="icon-button theme-control" title="Cambiar tema" aria-label="Cambiar tema" onClick={()=>setDark(x=>!x)}>{dark?<Sun size={23}/>:<Moon size={23}/>}</button></header>
 <aside className={'sidebar sidebar-premium '+(menu?'show':'')}><div className="sidebar-overline">MI ACCESO</div><button className={'sidebar-special '+(onlyFavorites?'active':'')} onClick={()=>{goPage('Partidos');setOnlyFavorites(x=>!x)}}><Star size={18}/> Favoritos <span className="side-count">{favorites.length}</span></button><div className="sidebar-overline spaced">LIGAS DESTACADAS</div>{leagues.map(l=><button key={l.id} className={'league-link '+(l.id===selectedLeague?'selected':'')} onClick={()=>pickLeague(l.id)}><LeagueFlag league={l}/><span>{l.name}</span><ChevronRight size={15}/></button>)}<div className="sidebar-categories"><div className="sidebar-overline">TODAS LAS LIGAS</div><button onClick={()=>{goPage('Inicio');setTimeout(()=>document.getElementById('explora-ligas')?.scrollIntoView({behavior:'smooth'}),20)}}><Trophy size={22}/>Ver todas las ligas<ChevronRight size={17}/></button><button onClick={()=>pickLeague(2)}><Shield size={22}/>Competiciones UEFA<ChevronRight size={17}/></button><button onClick={()=>pickLeague(13)}><Trophy size={22}/>Competiciones CONMEBOL<ChevronRight size={17}/></button><button onClick={()=>setShowCountries(v=>!v)} aria-expanded={showCountries}><Flag size={22}/>Ligas por país<ChevronDown size={17}/></button>{showCountries&&<div className="sidebar-country-options">{leagues.filter(l=>[39,140,78,135,61,281].includes(l.id)).map(l=><button key={l.id} onClick={()=>pickLeague(l.id)}><LeagueFlag league={l} compact/>{l.country}</button>)}</div>}</div></aside>
 <main className="content">
 <div className="contextbar"><div><span className="breadcrumb" onClick={()=>goPage('Inicio')}>FÚTBOL</span><ChevronRight size={13}/><span>{league?.name||page}</span></div><div className="context-right"><span className="connection"><span className={(apiHealth?.configured?.football||apiHealth?.configured?.bsd)?'green-dot':'grey-dot'}/>{apiHealth?.configured?.bsd?'BSD conectado':apiHealth?.configured?.football?'API-Football configurada':'Datos de demostración'}</span><span className="quota">{apiHealth?.configured?.footballData?'Tablas actuales: football-data.org · ':''}{matchesState.data?.source==='bsd'||liveState.data?.source==='bsd'?'Partidos BSD · ':''}{apiHealth?.footballBudget?`${apiHealth.footballBudget.remaining} consultas API-Football restantes`:'Plan gratuito'}</span></div></div>
 {page==='Inicio'&&<>
 <section className="hero hero-premium"><div className="hero-player" aria-hidden="true"/><div className="hero-content"><span className="eyebrow"><span className="live-spot"/> TU CENTRO DE FÚTBOL</span><h1>Todo el fútbol<br/>en un <em>solo lugar.</em></h1><p>Partidos, resultados, ligas, clasificaciones y videos, organizados en hoy y mañana.</p><button className="primary" onClick={()=>document.getElementById('explora-ligas')?.scrollIntoView({behavior:'smooth'})}>Explorar ligas <ArrowRight size={20}/></button></div><div className="hero-overlay"><small>FUTBOLLIVE</small><b>90'<span>+</span></b><em>LA PASIÓN CONTINÚA</em></div></section>
 <div className="section-title premium-section-heading" id="explora-ligas"><h2>Explora las ligas</h2><button className="all-leagues-link" onClick={()=>goPage('Clasificación')}>Ver todas las ligas <ArrowRight size={18}/></button></div>
 <LeagueCards leagues={leagues} onSelect={pickLeague}/>
 <div className="home-dashboard"><HomeLive items={homeMatches} onTeam={openTeam} onAll={()=>goPage('Partidos')} loading={matchesState.loading||liveState.loading} notice={matchesState.error?'BSD no respondió. Revisa Partidos.':'La disponibilidad depende de BSD.'}/><HomeResults items={dataMatches} onAll={()=>{goPage('Partidos');setMatchFilter('finished')}}/><HomeLeagues leagues={leagues} onSelect={pickLeague} onAll={()=>{goPage('Clasificación')}}/></div>
 </>}
 {page==='Liga'&&league&&<><div className="league-hero"><div className="league-hero-upper">{standingsState.data?.logo?<Crest src={standingsState.data.logo} name={league.name} size={78}/>:<LeagueBadge league={league} size={78}/>}<div className="league-title"><span className="league-title-country"><LeagueFlag league={league} compact/>{league.country.toUpperCase()} · FÚTBOL</span><h1>{league.name}</h1><p>Resultados, clasificación y contenido de la competición</p></div><button className="share-league" onClick={()=>{setLeague(null);goPage('Inicio')}}><ArrowLeft size={16}/> Todas las ligas</button></div><div className="league-tabs">{TABS.map(t=><button className={leagueTab===t?'chosen':''} key={t} onClick={()=>setLeagueTab(t)}>{t}</button>)}</div></div>
 <WeekBar days={weekDays} selected={selectedDay} setSelected={setSelectedDay} start={weekStart} end={weekEnd}/>
 {(leagueTab==='Resumen'||leagueTab==='Partidos'||leagueTab==='Resultados'||leagueTab==='En vivo')&&<><StatusNote data={matchesState.data} error={matchesState.error} loading={matchesState.loading}/><StatusNote data={liveState.data} error={liveState.error}/><div className="league-columns"><Panel title={leagueTab==='En vivo'?'Partidos en vivo':leagueTab==='Resultados'?'Resultados finalizados':leagueTab==='Partidos'?'Partidos programados':`Partidos de ${league.name}`} icon={Radio}><div className="section-sub">Hoy y mañana · Horario de Perú</div>{showMatchList(leagueTab==='En vivo'?chosenLive:leagueTab==='Resultados'?weekMatches.filter(x=>x.finished):leagueTab==='Partidos'?weekMatches.filter(x=>x.upcoming):weekMatches)}</Panel>{leagueTab==='Resumen'&&<Panel title="Tabla de posiciones" icon={BarChart3} action={<button className="link" onClick={()=>setLeagueTab('Clasificación')}>Completa <ArrowRight size={14}/></button>}><StatusNote data={standingsState.data} error={standingsState.error}/><Standings data={standingsObj} onTeam={openTeam} limit={8}/></Panel>}</div>{leagueTab==='Resumen'&&<div className="league-columns"><Panel title={`Resultados de ${league.name}`} icon={CalendarDays} action={<button className="link" onClick={()=>setLeagueTab('Resultados')}>Ver resultados <ArrowRight size={14}/></button>}>{showMatchList(weekMatches.filter(m=>m.finished).slice(0,4),{compact:true})}</Panel><Panel title={`Videos de ${league.name}`} icon={Video} action={<button className="link" onClick={()=>setLeagueTab('Videos')}>Ver videos <ArrowRight size={14}/></button>}><StatusNote data={videoState.data} error={videoState.error}/><VideoGrid items={videoItems.slice(0,3)} data={videoState.data} notRequested={!videoEnabled}/></Panel></div>}</>}
 {leagueTab==='Clasificación'&&<Panel title={`Clasificación · ${league.name}`} icon={BarChart3}><SeasonSelector value={seasonOverride} setValue={setSeasonOverride} league={league}/><StatusNote data={standingsState.data} error={standingsState.error}/><Standings data={standingsObj} onTeam={openTeam}/></Panel>}
 {leagueTab==='Videos'&&<Panel title={`Resúmenes de partidos · ${league.name}`} icon={Video}><StatusNote data={videoState.data} error={videoState.error}/><VideoGrid items={videoItems} data={videoState.data} notRequested={!videoEnabled}/><VideoPager data={videoState.data} offset={videoOffset} setOffset={setVideoOffset}/></Panel>}
 </>}
 {page!=='Liga'&&page!=='Inicio'&&<><div className="page-heading"><div><span className="eyebrow">FUTBOLLIVE / FÚTBOL</span><h1>{page}</h1><p>{({Partidos:'Resultados de hoy y mañana, partidos en vivo y próximos encuentros',Clasificación:'Consulta la tabla de posiciones de cada competición',Equipos:'Conoce los equipos y consulta sus partidos',Videos:'Resúmenes de partidos finalizados de hoy y mañana, filtrados por liga'})[page]}</p></div><div className="heading-actions"><button className="refresh-label" title="La pantalla consulta al backend cada 60 segundos" onClick={()=>window.location.reload()}><RefreshCw size={15}/> Actualización automática cada 60 s</button></div></div>
 {(page==='Partidos'||page==='Videos'||page==='Equipos')&&<WeekBar days={weekDays} selected={selectedDay} setSelected={setSelectedDay} start={weekStart} end={weekEnd}/>}<div className="controls-row"><label className="field"><ListFilter size={16}/><select value={selectedLeague||'all'} onChange={e=>setLeague(e.target.value==='all'?null:Number(e.target.value))}><option value="all">Todas las ligas</option>{leagues.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select></label>{page==='Partidos'&&<div className="pill-switch">{[['all','Todos'],['live','En directo'],['finished','Finalizados'],['upcoming','Próximos']].map(([v,label])=><button key={v} className={matchFilter===v?'active':''} onClick={()=>setMatchFilter(v)}>{label}</button>)}</div>}{page==='Clasificación'&&<SeasonSelector league={league||leagues.find(l=>l.id===tableLeague)} value={seasonOverride} setValue={setSeasonOverride}/>}</div>
 {page==='Partidos'&&<><StatusNote data={matchesState.data} error={matchesState.error} loading={matchesState.loading}/><StatusNote data={liveState.data} error={liveState.error}/><div className="matches-layout"><Panel title={matchFilter==='live'?'En directo':matchFilter==='finished'?'Resultados finalizados':matchFilter==='upcoming'?'Próximos encuentros':'Partidos de hoy y mañana'} icon={Radio} action={<span className="tiny">{matchesToShow.length} encuentros</span>}>{showMatchList(matchesToShow)}</Panel><div className="sidepanel"><Panel title="En vivo ahora" icon={Activity}><span className="tiny">Fuente {liveState.data?.source==='bsd'?'BSD':'API-Football'} · {liveState.data?.lastFetched?`actualizado ${fmtPublished(new Date(liveState.data.lastFetched).toISOString())}`:'sin actualizar'}</span>{showMatchList(scopedLive.slice(0,6),{compact:true,emptyTitle:'No hay partidos en vivo disponibles.'})}</Panel><Panel title="Ligas" icon={Trophy}><div className="small-league-list">{leagues.map(l=><button key={l.id} onClick={()=>pickLeague(l.id)}><span className="small-league-with-flag"><LeagueFlag league={l} compact/>{l.name}</span><ChevronRight size={15}/></button>)}</div></Panel></div></div></>}
 {page==='Clasificación'&&<Panel title={`Tabla de posiciones · ${leagues.find(l=>l.id===tableLeague)?.name||'Liga'}`} icon={BarChart3}><StatusNote data={standingsState.data} error={standingsState.error} loading={standingsState.loading}/><Standings data={standingsObj} onTeam={openTeam}/></Panel>}
 {page==='Equipos'&&<Panel title="Equipos de hoy y mañana" icon={Shield}><StatusNote data={matchesState.data} error={matchesState.error}/><div className="clubs-grid">{[...new Map(weekMatches.flatMap(m=>[[m.homeId||m.home,{id:m.homeId,name:m.home,logo:m.homeLogo}],[m.awayId||m.away,{id:m.awayId,name:m.away,logo:m.awayLogo}]] )).values()].slice(0,48).map((c,i)=><button className="club-card" key={c.id||i} onClick={()=>openTeam(c.id,c.name)}><Crest src={c.logo} name={c.name} size={49}/><b>{c.name}</b><small>Ver información <ArrowRight size={12}/></small></button>)}</div>{!weekMatches.length&&<Empty message="No hay equipos disponibles para hoy ni mañana."/>}</Panel>}
 {page==='Videos'&&<Panel title="Resúmenes de partidos finalizados" icon={Video}><StatusNote data={videoState.data} error={videoState.error} loading={videoState.loading}/><VideoGrid items={videoItems} data={videoState.data} notRequested={!videoEnabled}/><VideoPager data={videoState.data} offset={videoOffset} setOffset={setVideoOffset}/></Panel>}
 </>}
 <footer><span>⚽ <b>FutbolLive</b> · Proyecto académico</span><span>BSD · YouTube · football-data.org</span><span>Datos reales sujetos a cobertura, cuota y retraso del proveedor. Sin apuestas ni publicidad.</span></footer>
 </main>
 {activeTeam&&<div className="modal-scrim" onClick={()=>setActiveTeam(null)}><div className="team-modal" role="dialog" aria-modal="true" onClick={e=>e.stopPropagation()}><button className="modal-close" onClick={()=>setActiveTeam(null)}><X/></button><div className="modal-heading"><Crest src={teamState.data?.team?.logo||null} name={activeTeam.name} size={65}/><div><span>FICHA DEL EQUIPO</span><h2>{teamState.data?.team?.name||activeTeam.name}</h2><p>{teamState.data?.team?.country||'Información deportiva'}</p></div></div>{teamState.error&&<div className="alert">{teamState.error}</div>}<div className="modal-stats"><div><small>Fundación</small><b>{teamState.data?.team?.founded||'—'}</b></div><div><small>Estadio</small><b>{teamState.data?.venue?.name||'—'}</b></div><div><small>Ciudad</small><b>{teamState.data?.venue?.city||'—'}</b></div></div><h3>Partidos de hoy y mañana</h3>{showMatchList(dataMatches.filter(m=>m.homeId===activeTeam.id||m.awayId===activeTeam.id).slice(0,7),{compact:true})}</div></div>}
 </div>;
}
function SeasonSelector({league,value,setValue}){const yr=Number(new Intl.DateTimeFormat('en-US',{timeZone:'America/Lima',year:'numeric'}).format(new Date()));const month=Number(new Intl.DateTimeFormat('en-US',{timeZone:'America/Lima',month:'numeric'}).format(new Date()));const current=league?.seasonType==='calendar'?yr:month>=7?yr:yr-1;return <label className="field season-field"><Trophy size={15}/><select value={value||'auto'} onChange={e=>setValue(e.target.value==='auto'?'':e.target.value)}><option value="auto">Temporada actual</option>{[current,current-1,current-2,current-3].map(y=><option key={y} value={y}>{league?.seasonType==='calendar'?y:`${y}/${y+1}`}</option>)}</select></label>}
function WeekBar({days,selected,setSelected,start,end}){
 return <div className="weekbar">
   <div className="weekbar-label"><CalendarDays size={17}/><div><strong>Hoy y mañana</strong><small>{displayDate(start,{day:'numeric',month:'short'})} — {displayDate(end,{day:'numeric',month:'short',year:'numeric'})} · Perú</small></div></div>
   <div className="daystrip two-days"><button className={'day-pill all '+(selected==='all'?'selected':'')} onClick={()=>setSelected('all')}>Todos<small>2 días</small></button>{days.map((d,i)=><button key={d.date} className={'day-pill '+(selected===d.date?'selected':'')+(i===0?' today':'')} onClick={()=>setSelected(d.date)}><small>{i===0?'HOY':'MAÑANA'} · {d.day}</small><strong>{d.num}</strong><small>{d.month}</small></button>)}</div>
 </div>
}

createRoot(document.getElementById('root')).render(<App/>);
