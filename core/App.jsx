import { EF, AnalogClock, CalendarModal, ModeMenu, ComprasModal, HumorSelector, FixedFreqBtn, SearchModal, ScheduleModal } from "./ui.jsx";
import { computeStressScore, esTareaMedica, DOCTOR_KEYWORDS, DEFAULT_HUMORS } from "./stress.js";
import { requestNotifPermission, scheduleTaskNotifs } from "./notifications.js";
import { downloadBackupJSON } from "./persistence.js";
import { fmt, fmtFull, getHoliday, addDays } from "./dates.js";
import PokecriptoPage, { CARPETAS_DEFAULT } from "../modules/pokecripto/PokecriptoPage.jsx";
import SaludPage from "../modules/salud/SaludPage.jsx";
import FadimanPage from "../modules/fadiman/FadimanPage.jsx";
import RoutinesPage from "../modules/rutinas/RoutinesPage.jsx";
import NutriaPage from "../modules/nutria/NutriaPage.jsx";
import { makeDefaultNutria } from "../modules/nutria/defaults.js";
import EjercicioPage from "../modules/ejercicio/EjercicioPage.jsx";
import NutricionPage from "../modules/nutricion/NutricionPage.jsx";
import BudgetPage from "../modules/presupuesto/BudgetPage.jsx";
import EspritPage from "../modules/espiritu/EspritPage.jsx";
import FeedPage from "../modules/feed/FeedPage.jsx";

const { useState, useEffect, useRef, useMemo, useCallback } = React;

async function localGet(key){const val=localStorage.getItem(key);if(val===null)return null;return{value:val};}
async function localSet(key,value){try{localStorage.setItem(key,value);return{value};}catch(e){console.error(e);return null;}}
function makeEmptyDay() {
  return { tasks:[], abasto:"", cookingMode:"", aseoMode:"", menu:"", summary:"", humors:[], humorCustom:[], compras:[], schedule:[] };
}
function isWithKids(dateKey, custody) {
  if(!custody) return true;
  if(custody.overrides && custody.overrides[dateKey] !== undefined) return custody.overrides[dateKey];
  const base = new Date(custody.baseDate+"T12:00:00");
  const day  = new Date(dateKey+"T12:00:00");
  const diffWeeks = Math.floor((day - base) / (7*24*60*60*1000));
  return diffWeeks % 2 === 0 ? (custody.withKids !== false) : !(custody.withKids !== false);
}
function fmtTime(dl) { if (!dl) return "--:--"; return `${String(dl.h).padStart(2,"0")}:${String(dl.m).padStart(2,"0")}`; }


const BASE_DATE = new Date(2026, 1, 21);
const DAY_NAMES = ["Sábado","Domingo","Lunes","Martes","Miércoles","Jueves","Viernes"];
const DEFAULT_COOKING_OPTS = ["cocino hoy 🍳","sobras ♻️","pedir 🍔","ayuno 🌿","red de apoyo 🤝"];
const DEFAULT_ASEO_OPTS    = ["aseo básico 🧹","aseo profundo 🫧","mantenimiento 🧼","superficies 🪣","vivir en la mugre 💀"];
const STOIC_PHRASES = [
  "el universo no tiene plan, pero tú tienes planilla.",
  "disciplina: hacer lo que dijiste que ibas a hacer.",
  "memento mori. pero primero anota las compras.",
  "ama fati: quiere incluso los días sin tareas completadas.",
  "lo que no se registra, no existió.",
  "el estoico no se queja. el estoico presupuesta.",
  "todo es temporal. el caos más que el orden.",
  "no busques sentido. construye rutina.",
  "la virtud está en el proceso, no en terminar la lista.",
  "vivir bien es la mejor venganza contra el caos.",
  "considera el obstáculo como el camino.",
  "el tiempo es el único activo que no se recupera.",
];

// Exclusivo de Semana — antes vivía cerca del principio del archivo, sin
// relación real con ningún módulo.
const CYNICAL_SUBTITLES = [
  "otra semana de fingir que todo está bien",
  "sobrevive. eso es suficiente.",
  "el caos también puede tener horario",
  "planificar no cura la existencia, pero ayuda",
  "otra oportunidad de decepcionarte a ti mismo (o no)",
  "la semana no se va a organizar sola, lamentablemente",
  "no tienes que querer hacerlo para hacerlo",
  "lo hiciste la semana pasada. puedes volver a hacerlo.",
  "un día a la vez, aunque el día sea un desastre",
  "el orden es temporal. el caos, permanente. organízate igual.",
];


function AngstApp() {
  const [page, setPage] = useState(0);
  // dayData: flat dict keyed by "YYYY-MM-DD" → individual day object
  // This ensures each calendar date is fully independent
  const [dayData, setDayData] = useState({});
  const [weekOffset, setWeekOffset] = useState(0);
  const [budgets, setBudgets] = useState({});  // keyed "YYYY-MM"
  const [nutria, setNutria] = useState(makeDefaultNutria());
  const [fadimanData, setFadimanData] = useState({});
  const fadimanDataRef = useRef({});
  const [nutriLog, setNutriLog] = useState({});
  const [ejercicioLog, setEjercicioLog] = useState({});
  const nutriLogRef = useRef({});
  const [customFoods, setCustomFoods] = useState({});
  const customFoodsRef = useRef({});
  const [foodOverrides, setFoodOverrides] = useState({});
  const foodOverridesRef = useRef({});
  const [customEjercicios, setCustomEjercicios] = useState({});
  const customEjerciciosRef = useRef({});
  const ejercicioLogRef = useRef({});
  const [ejercicioDecks, setEjercicioDecks] = useState([]);
  const ejercicioDecksRef = useRef([]);
  const [calMarks, setCalMarks] = useState({});
  const [semanaTab, setSemanaTab] = useState("semana");
  const [meleeMajors, setMeleeMajors] = useState([]);
  const [custody, setCustody] = useState({ baseDate:"2026-04-28", withKids:true, overrides:{} });

  const POKEMON_EVENTS = [
    { name:"Lima Special Championships 🇵🇪", start:"2026-05-23", end:"2026-05-24", url:"https://www.pokemon.com/us/play-pokemon/pokemon-events/find-a-pokemon-event/" },
    { name:"NAIC — North America Internationals 🇺🇸", start:"2026-06-12", end:"2026-06-14", url:"https://www.pokemon.com/us/play-pokemon/pokemon-events/find-a-pokemon-event/" },
    { name:"Pokémon Worlds 🌎", start:"2026-08-28", end:"2026-08-30", url:"https://worlds.pokemon.com/" },
    { name:"Belo Horizonte Regional 🇧🇷", start:"2026-10-11", end:"2026-10-12", url:"https://www.pokemon.com/us/play-pokemon/pokemon-events/find-a-pokemon-event/" },
    { name:"Buenos Aires Special Event 🇦🇷", start:"2026-11-15", end:"2026-11-16", url:"https://www.pokemon.com/us/play-pokemon/pokemon-events/find-a-pokemon-event/" },
  ];
  const SC2_EVENTS = [
    { name:"BlizzCon — Blizzard Classic Cup (SC2) 🎮", start:"2026-09-12", end:"2026-09-13", url:"https://blizzcon.com" },
  ];
  const [editingTask, setEditingTask] = useState(null);
  const [editText, setEditText] = useState("");
  const [clockOpen, setClockOpen] = useState(null);
  const [notifClockOpen, setNotifClockOpen] = useState(null); // {dateKey, tid, fixed}
  const [calOpen, setCalOpen] = useState(false);
  const [minimized, setMinimized] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [notifGranted, setNotifGranted] = useState(false);
  const [saved, setSaved] = useState(false);
  const [subIdx, setSubIdx] = useState(()=>Math.floor(Math.random()*CYNICAL_SUBTITLES.length));
  const [footerIdx, setFooterIdx] = useState(()=>Math.floor(Math.random()*STOIC_PHRASES.length));
  const [exportOk, setExportOk] = useState(null);
  const [loadMsg, setLoadMsg] = useState(null);

  // Refs for async-safe access
  const dayDataRef  = useRef({});
  const weekOffsetRef = useRef(0);
  const budgetRef   = useRef({});
  const nutriaRef   = useRef(makeDefaultNutria());
  const calMarksRef = useRef({});
  const routinesRef  = useRef([]);
  const recurringRef  = useRef([]);
  const lastRolloverRef = useRef(null);
  const [routines, setRoutines] = useState([]);
  const [recurring, setRecurring] = useState([]);
  const [lastRollover, setLastRollover] = useState(null);
  const [cookingOpts, setCookingOpts] = useState([...DEFAULT_COOKING_OPTS]);
  const [aseoOpts, setAseoOpts] = useState([...DEFAULT_ASEO_OPTS]);
  const [comprasOpen, setComprasOpen] = useState(null); // dateKey
  const [searchOpen, setSearchOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(null); // dateKey
  const [liftedTask, setLiftedTask] = useState(null); // {dateKey,tid}
  const [taskDragTarget, setTaskDragTarget] = useState(null); // {dateKey,idx}
  const holdTimerRef = useRef(null);
  const taskTouchX = useRef(0);
  const taskTouchY = useRef(0);
  const [openFMenu, setOpenFMenu] = useState(null); // "dateKey:taskId:menuId"
  const [kidsHealth, setKidsHealth] = useState({episodes:[]});
  const kidsHealthRef = useRef({episodes:[]});
  const [pokeInventario, setPokeInventario] = useState([]);
  const pokeInventarioRef = useRef([]);
  const [pokeCarpetas, setPokeCarpetas] = useState([...CARPETAS_DEFAULT]);
  const pokeCarpetasRef = useRef([...CARPETAS_DEFAULT]);
  const [pokeDarkCatalogo, setPokeDarkCatalogo] = useState([]);
  const pokeDarkCatalogoRef = useRef([]);
  const [pokePriceCache, setPokePriceCache] = useState({});
  const pokePriceCacheRef = useRef({});
  const [nutriDecks, setNutriDecks] = useState([]);
  const nutriDecksRef = useRef([]);
  const lastExportSizeRef = useRef(0);
  const lastExportDateRef = useRef(null);

  useEffect(()=>{ dayDataRef.current  = dayData;   }, [dayData]);
  useEffect(()=>{ weekOffsetRef.current = weekOffset; }, [weekOffset]);
  useEffect(()=>{ budgetRef.current   = budgets;   }, [budgets]);
  useEffect(()=>{ nutriaRef.current   = nutria;    }, [nutria]);
  useEffect(()=>{ calMarksRef.current = calMarks;  }, [calMarks]);
  useEffect(()=>{ routinesRef.current  = routines;  }, [routines]);
  useEffect(()=>{ recurringRef.current  = recurring;  }, [recurring]);
  useEffect(()=>{ lastRolloverRef.current = lastRollover; }, [lastRollover]);
  useEffect(()=>{ pokeInventarioRef.current = pokeInventario; }, [pokeInventario]);
  useEffect(()=>{ pokeCarpetasRef.current = pokeCarpetas; }, [pokeCarpetas]);
  useEffect(()=>{ pokeDarkCatalogoRef.current = pokeDarkCatalogo; }, [pokeDarkCatalogo]);
  useEffect(()=>{ pokePriceCacheRef.current = pokePriceCache; }, [pokePriceCache]);
  useEffect(()=>{ nutriDecksRef.current = nutriDecks; }, [nutriDecks]);
  useEffect(()=>{ ejercicioDecksRef.current = ejercicioDecks; }, [ejercicioDecks]);

  useEffect(()=>{const iv=setInterval(()=>setSubIdx(i=>(i+1)%CYNICAL_SUBTITLES.length),8000);return()=>clearInterval(iv);},[]);
  useEffect(()=>{const iv=setInterval(()=>setFooterIdx(i=>(i+1)%STOIC_PHRASES.length),10000);return()=>clearInterval(iv);},[]);

  const weekStart = addDays(BASE_DATE, weekOffset*7);

  // Get day object for a specific date key, returning empty day if not yet created
  function getDay(dateKey) {
    return dayDataRef.current[dateKey] || makeEmptyDay();
  }

  // getStressScoreForDate (sesión angst-57) — envuelve computeStressScore
  // con los refs de AngstApp ya en closure. Se pasa a NutricionPage como
  // prop `getStressScore` para el ajuste de kcal por carga del día, sin que
  // ese módulo necesite leer dayData/calMarks/kidsHealth directamente.
  function getStressScoreForDate(dateKey) {
    return computeStressScore(dateKey, dayDataRef.current, calMarksRef.current, kidsHealthRef.current);
  }


  // Runs every time the app becomes visible or on first load
  function runRollover() {
    const todayKey = fmtFull(new Date());
    const lr = lastRolloverRef.current || null;
    // Check every past day (ignore lastRollover — always scan to catch missed tasks)
    const prevDayData = dayDataRef.current || {};
    let newDayData = {...prevDayData};
    let changed = false;
    // Look back up to 14 days
    for(let i=1; i<=14; i++) {
      const pastKey = fmtFull(new Date(Date.now() - i*86400000));
      const pastDay = newDayData[pastKey];
      if(!pastDay) continue;
    // Quitar baliza de TODOS los días pasados al inicio
    const todayKey = fmtFull(new Date());
    Object.keys(newDayData).forEach(dk => {
      if(dk >= todayKey) return;
      const d = newDayData[dk];
      if((d?.tasks||[]).some(t=>t.urgent)) {
        newDayData[dk] = {...d, tasks: d.tasks.map(t=>({...t, urgent:false}))};
        changed = true;
      }
    });

    // Quitar baliza de días pasados — no existe urgencia en el pasado
      const hadUrgent = (pastDay.tasks||[]).some(t=>t.urgent);
      if(hadUrgent) {
        newDayData[pastKey] = {
          ...(newDayData[pastKey]||pastDay),
          tasks: (newDayData[pastKey]?.tasks||pastDay.tasks||[]).map(t=>({...t, urgent:false}))
        };
        changed = true;
      }
      // Unfinished: not fixed, not done, not already marked notDone
      // NOTE: carried tasks CAN be carried again if still unfinished
      const unfinished = (pastDay.tasks||[]).filter(t=>!t.fixed&&!t.done&&!t.notDone);
      if(unfinished.length===0) continue;
      // Mark originals as no realizada
      newDayData[pastKey] = {
        ...pastDay,
        tasks: pastDay.tasks.map(t=>
          unfinished.find(u=>u.id===t.id) ? {...t, notDone:true} : t
        )
      };
      // Avoid duplicates: check if already carried to today (by origId chain)
      const todayDay = newDayData[todayKey] || makeEmptyDay();
      const alreadyCarriedOrigIds = new Set(
        (todayDay.tasks||[]).filter(t=>t.carried).map(t=>t.origId||t.id)
      );
      const toCarry = unfinished.filter(t=>!alreadyCarriedOrigIds.has(t.origId||t.id));
      if(toCarry.length>0) {
        // Preserve intensity/workLevel/sleep — only inject carried tasks
        newDayData[todayKey] = {
          ...todayDay,
          tasks:[...(todayDay.tasks||[]), ...toCarry.map(t=>({
            ...t,
            origId: t.origId || t.id,  // preserve the root origId
            id: Date.now().toString()+Math.random().toString(36).slice(2),
            carried:true, carriedFrom:pastKey, done:false, notDone:false
          }))]
        };
        changed = true;
      }
    }
    // Compras rollover: carry undone items to today
    for(let i=1; i<=14; i++) {
      const pastKey = fmtFull(new Date(Date.now() - i*86400000));
      const pastDay = newDayData[pastKey];
      if(!pastDay) continue;
      const undoneCompras = (pastDay.compras||[]).filter(c=>!c.done);
      if(undoneCompras.length===0) continue;
      const todayDay2 = newDayData[todayKey] || makeEmptyDay();
      const alreadyIds = new Set((todayDay2.compras||[]).map(c=>c.origId||c.id));
      const toMove = undoneCompras.filter(c=>!alreadyIds.has(c.id));
      if(toMove.length>0) {
        // Mark originals as done in past day
        newDayData[pastKey] = {...pastDay, compras:(pastDay.compras||[]).map(c=>undoneCompras.find(u=>u.id===c.id)?{...c,done:true}:c)};
        newDayData[todayKey] = {...(newDayData[todayKey]||makeEmptyDay()), compras:[...(newDayData[todayKey]?.compras||[]), ...toMove.map(c=>({...c,origId:c.id,id:Date.now().toString()+Math.random().toString(36).slice(2)}))]};
        changed = true;
      }
    }
    if(lr !== todayKey) {
      setLastRollover(todayKey);
      lastRolloverRef.current = todayKey;
    }
    if(changed) {
      setDayData(newDayData);
      dayDataRef.current = newDayData;
      saveToStorage({dayData: newDayData, lastRollover: todayKey});
    } else if(lr !== todayKey) {
      saveToStorage({lastRollover: todayKey});
    }
  }


  // Re-run rollover when app comes back to foreground (e.g. next day, PWA background)
  useEffect(()=>{
    if(!loaded) return;
    function onVisible(){
      if(document.visibilityState==="visible"){
        runRollover();
        // Re-register all notification timers (page may have been idle)
        const dd = dayDataRef.current || {};
        Object.keys(dd).forEach(dk=>scheduleTaskNotifs(dk, dd[dk]?.tasks||[]));
      }
    }
    document.addEventListener("visibilitychange", onVisible);
    return ()=>document.removeEventListener("visibilitychange", onVisible);
  }, [loaded]);

  // Fetch Melee majors ICS once per session
  useEffect(()=>{
    async function fetchMelee(){
      try {
        const res = await fetch("https://meleemajors.gg/calendar.ics");
        if(!res.ok) return;
        const text = await res.text();
        const events = [];
        const blocks = text.split("BEGIN:VEVENT");
        blocks.slice(1).forEach(block=>{
          const getName = s => { const m=s.match(/SUMMARY:(.+)/); return m?m[1].trim():""; };
          const getDate = s => { const m=s.match(/(\d{8})/); return m?m[1]:""; };
          const dtstart = block.match(/DTSTART[^:]*:(\d{8})/);
          const dtend   = block.match(/DTEND[^:]*:(\d{8})/);
          const summary = block.match(/SUMMARY:(.+)/);
          if(dtstart&&summary){
            const parseDStart = s => `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}`;
          const parseD = s => { const d=new Date(s.slice(0,4)+"-"+s.slice(4,6)+"-"+s.slice(6,8)+"T12:00:00"); d.setDate(d.getDate()-1); return d.toISOString().slice(0,10); };
            events.push({ name:summary[1].trim(), start:parseDStart(dtstart[1]), end:dtend?parseD(dtend[1]):parseDStart(dtstart[1]) });
          }
        });
        setMeleeMajors(events);
      } catch(e) {}
    }
    fetchMelee();
  }, []);

  // Load from storage once on mount
  useEffect(()=>{
    async function load(){
      try{
        const r = await localGet("angst-v12");
        if(r?.value){
          const d = JSON.parse(r.value);
          // New format: d.dayData is a flat dict keyed by date string
          if(d.dayData && typeof d.dayData === 'object'){
            const cleaned = {};
            Object.keys(d.dayData).forEach(k=>{
              const day = d.dayData[k];
              cleaned[k] = {
                ...makeEmptyDay(),
                ...day,
                tasks: (day.tasks||[]).map(t=>({...t})),
              };
            });
            setDayData(cleaned);
            dayDataRef.current = cleaned;
          }
          // Legacy migration: old format had d.week array
          if(Array.isArray(d.week) && d.week.length===7 && !d.dayData){
            console.log("Migrating legacy week array to dayData format");
            // We can't know which week it was for, skip migration
          }
          if(d.weekOffset!==undefined){ setWeekOffset(d.weekOffset); weekOffsetRef.current=d.weekOffset; }
          if(d.budgets && typeof d.budgets==='object'){
            setBudgets(d.budgets); budgetRef.current=d.budgets;
          } else if(d.budget){
            // legacy migration: move single budget to current month key
            const now=new Date();
            const key=`${now.getFullYear()}-${String(now.getDate()>=25?now.getMonth()+1:now.getMonth()||12).padStart(2,'0')}`;
            const migrated={[key]:d.budget};
            setBudgets(migrated); budgetRef.current=migrated;
          }
          if(d.nutria){ setNutria(d.nutria); nutriaRef.current=d.nutria; }
          if(d.cookingOpts) setCookingOpts(d.cookingOpts);
          if(d.aseoOpts){ const merged=[...d.aseoOpts];DEFAULT_ASEO_OPTS.forEach(o=>{if(!merged.includes(o))merged.splice(merged.length-1,0,o);});setAseoOpts(merged); }
          if(d.custody) setCustody(d.custody);
          if(d.fadimanData){ setFadimanData(d.fadimanData); fadimanDataRef.current=d.fadimanData; }
          if(d.routines){ setRoutines(d.routines); routinesRef.current=d.routines; }
          if(d.routines){ setRoutines(d.routines); routinesRef.current=d.routines; }
          if(d.routines){ setRoutines(d.routines); routinesRef.current=d.routines; }
          if(d.recurring){ setRecurring(d.recurring); recurringRef.current=d.recurring; }
          if(d.lastRollover){ setLastRollover(d.lastRollover); lastRolloverRef.current=d.lastRollover; }
          if(d.calMarks){ setCalMarks(d.calMarks); calMarksRef.current=d.calMarks; }
          if(d.kidsHealth){ setKidsHealth(d.kidsHealth); kidsHealthRef.current=d.kidsHealth; }
          if(d.pokeInventario){ setPokeInventario(d.pokeInventario); pokeInventarioRef.current=d.pokeInventario; }
          if(d.pokeCarpetas){ setPokeCarpetas(d.pokeCarpetas); pokeCarpetasRef.current=d.pokeCarpetas; }
          if(d.pokeDarkCatalogo){ setPokeDarkCatalogo(d.pokeDarkCatalogo); pokeDarkCatalogoRef.current=d.pokeDarkCatalogo; }
          if(d.pokePriceCache){ setPokePriceCache(d.pokePriceCache); pokePriceCacheRef.current=d.pokePriceCache; }
          if(d.nutriLog){ setNutriLog(d.nutriLog); nutriLogRef.current=d.nutriLog; }
          if(d.ejercicioLog){
            // Migración silenciosa: formato viejo [dateKey][tab] (tab="casa"|"gym")
            // → formato plano [dateKey]{exId_si:...}. Si un día ya viene plano, queda igual.
            const migrated = {};
            Object.keys(d.ejercicioLog).forEach(dk=>{
              const day = d.ejercicioLog[dk]||{};
              const hasOldTabs = day.casa || day.gym || day.ambos;
              if(hasOldTabs){
                migrated[dk] = {...(day.casa||{}), ...(day.gym||{}), ...(day.ambos||{})};
                Object.keys(day).forEach(k=>{ if(k!=="casa"&&k!=="gym"&&k!=="ambos") migrated[dk][k]=day[k]; });
              } else {
                migrated[dk] = day;
              }
            });
            setEjercicioLog(migrated); ejercicioLogRef.current=migrated;
          }
          if(d.ejercicioDecks){ setEjercicioDecks(d.ejercicioDecks); ejercicioDecksRef.current=d.ejercicioDecks; }
          if(d.customFoods){ setCustomFoods(d.customFoods); customFoodsRef.current=d.customFoods; }
          if(d.foodOverrides){ setFoodOverrides(d.foodOverrides); foodOverridesRef.current=d.foodOverrides; }
          if(d.customEjercicios){ setCustomEjercicios(d.customEjercicios); customEjerciciosRef.current=d.customEjercicios; }
          if(d.nutriDecks){
            setNutriDecks(d.nutriDecks); nutriDecksRef.current=d.nutriDecks;
          } else {
            // Migración silenciosa desde la clave vieja angst-nutri-decks-v1
            try {
              const legacyRaw = localStorage.getItem("angst-nutri-decks-v1");
              if(legacyRaw){
                const legacyDecks = JSON.parse(legacyRaw)||[];
                if(legacyDecks.length){ setNutriDecks(legacyDecks); nutriDecksRef.current=legacyDecks; }
              }
            } catch(e){}
          }
        }
      }catch(e){ console.warn("Load failed:", e); } finally { setLoaded(true); }
      // Request notification permission once
      requestNotifPermission().then(ok=>setNotifGranted(ok));
      // Schedule all timers from stored tasks
      setTimeout(()=>{
        const dd = dayDataRef.current || {};
        Object.keys(dd).forEach(dk=>scheduleTaskNotifs(dk, dd[dk]?.tasks||[]));
      }, 500);
      // Rollover: delay to ensure dayDataRef is populated
      setTimeout(()=>runRollover(), 100);
      // Jump to the week containing today and expand only today
      const today = new Date();
      const msPerWeek = 7*24*60*60*1000;
      const diff = Math.floor((new Date(today.getFullYear(),today.getMonth(),today.getDate()) - new Date(2026,1,21)) / msPerWeek);
      setWeekOffset(diff);
      weekOffsetRef.current = diff;
      // Minimize all days in that week except today
      const weekStartDate = new Date(2026,1,21);
      weekStartDate.setDate(weekStartDate.getDate() + diff*7);
      const initMin = {};
      for(let i=0;i<7;i++){
        const d = new Date(weekStartDate);
        d.setDate(d.getDate()+i);
        const dk = d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
        if(dk !== fmtFull(new Date())) initMin[dk] = true;
      }
      setMinimized(initMin);
    }
    load();
  },[]);

  // ── Auto-export silencioso — recordatorio para respaldar ──
  // Reusa buildExportPayload() (la misma fuente que el botón 💾 manual)
  // así nunca queda un campo afuera en uno y no en el otro.
  function silentExport(payloadArg){
    try {
      const payload = payloadArg || buildExportPayload();
      downloadBackupJSON(payload);
      lastExportDateRef.current = new Date().toISOString().slice(0,10);
      lastExportSizeRef.current = JSON.stringify(payload).length;
    } catch(e) { console.warn("Auto-export failed:", e); }
  }

  // Export diario al abrir la app (una vez por día, como recordatorio de respaldo)
  useEffect(()=>{
    if(!loaded) return;
    const todayKey = new Date().toISOString().slice(0,10);
    const lastDate = localStorage.getItem("angst-last-export-date");
    if(lastDate !== todayKey) {
      // Pequeño delay para que los refs estén poblados tras el load
      setTimeout(()=>{
        silentExport();
        localStorage.setItem("angst-last-export-date", todayKey);
      }, 3000);
    }
  }, [loaded]);

  // Save to storage
  async function saveToStorage(overrides={}) {
    const payload = {
      dayData:    overrides.dayData    ?? dayDataRef.current,
      weekOffset: overrides.weekOffset ?? weekOffsetRef.current,
      budgets:    overrides.budgets    ?? budgetRef.current,
      nutria:     overrides.nutria     ?? nutriaRef.current,
      calMarks:   overrides.calMarks   ?? calMarksRef.current,
      cookingOpts: overrides.cookingOpts ?? cookingOpts,
      aseoOpts: overrides.aseoOpts ?? aseoOpts,
      routines:   overrides.routines   ?? routinesRef.current,
      recurring:  overrides.recurring  ?? recurringRef.current,
      lastRollover: overrides.lastRollover ?? lastRolloverRef.current,
      kidsHealth:   overrides.kidsHealth   ?? kidsHealthRef.current,
      custody:      overrides.custody      ?? custody,
      fadimanData:  overrides.fadimanData  ?? fadimanDataRef.current,
      nutriLog:     overrides.nutriLog     ?? nutriLogRef.current,
      ejercicioLog: overrides.ejercicioLog ?? ejercicioLogRef.current,
      ejercicioDecks: overrides.ejercicioDecks ?? ejercicioDecksRef.current,
      customFoods:  overrides.customFoods  ?? customFoodsRef.current,
      foodOverrides:overrides.foodOverrides?? foodOverridesRef.current,
      customEjercicios: overrides.customEjercicios ?? customEjerciciosRef.current,
      nutriDecks: overrides.nutriDecks ?? nutriDecksRef.current,
      pokeInventario: overrides.pokeInventario ?? pokeInventarioRef.current,
      pokeCarpetas: overrides.pokeCarpetas ?? pokeCarpetasRef.current,
      pokeDarkCatalogo: overrides.pokeDarkCatalogo ?? pokeDarkCatalogoRef.current,
      pokePriceCache: overrides.pokePriceCache ?? pokePriceCacheRef.current,
    };
    try {
      const serialized = JSON.stringify(payload);
      await localSet("angst-v12", serialized);
      setSaved(true);
      setTimeout(()=>setSaved(false), 2000);
      // Watcher: si el payload creció >1KB respecto al último export, exportar de nuevo
      if(lastExportSizeRef.current > 0 && serialized.length - lastExportSizeRef.current > 1024) {
        silentExport();
      }
      if(lastExportSizeRef.current === 0) {
        lastExportSizeRef.current = serialized.length;
      }
    } catch(e) { console.warn("Save failed:", e); }
  }

  // Update a single day by its date key
  function updateDay(dateKey, fields) {
    setDayData(prev => {
      const next = {
        ...prev,
        [dateKey]: { ...(prev[dateKey]||makeEmptyDay()), ...fields }
      };
      dayDataRef.current = next;
      saveToStorage({dayData: next});
      return next;
    });
  }

  function sortTasks(tasks){
    return [...tasks].sort((a,b)=>{
      if(a.fixed&&!b.fixed)return -1;
      if(!a.fixed&&b.fixed)return 1;
      if(a.deadline&&b.deadline){const av=a.deadline.h*60+a.deadline.m,bv=b.deadline.h*60+b.deadline.m;return av-bv;}
      if(a.deadline)return -1;
      if(b.deadline)return 1;
      return 0;
    });
  }

  // Update a task within a specific date
  // DOCTOR_KEYWORDS / FAMILY_NAMES / esTareaMedica ahora son globales (ver
  // Constants) — compartidas con computeStressScore para evitar el triple
  // conteo de una misma cita médica (sesión angst-57).
  function autoMarkDoctor(dateKey, tasks) {
    const hasDocTask = tasks.some(t => esTareaMedica(t.text));
    setCalMarks(prev => {
      const cur = Array.isArray(prev[dateKey]) ? prev[dateKey] : (prev[dateKey] ? [prev[dateKey]] : []);
      const hasDoc = cur.includes("doctor");
      if(hasDocTask && !hasDoc) {
        const nm = {...prev, [dateKey]: [...cur, "doctor"]};
        calMarksRef.current = nm;
        saveToStorage({calMarks: nm});
        return nm;
      }
      if(!hasDocTask && hasDoc) {
        const next = cur.filter(v=>v!=="doctor");
        const nm = {...prev};
        if(next.length===0) delete nm[dateKey]; else nm[dateKey]=next;
        calMarksRef.current = nm;
        saveToStorage({calMarks: nm});
        return nm;
      }
      return prev;
    });
  }

  function updateTask(dateKey, tid, fields) {
    setDayData(prev => {
      const day = prev[dateKey] || makeEmptyDay();
      const updated = day.tasks.map(t => t.id===tid ? {...t,...fields} : t);
      const sorted = fields.deadline ? sortTasks(updated) : updated;
      const next = { ...prev, [dateKey]: { ...day, tasks: sorted } };
      dayDataRef.current = next;
      saveToStorage({dayData: next});
      setTimeout(()=>autoMarkDoctor(dateKey, sorted), 0);
      return next;
    });
  }

  function startEdit(dateKey, tid, text){ setEditingTask({dateKey,tid}); setEditText(text); }

  function persistTaskText(dateKey, tid, text){
    setDayData(prev => {
      const day = prev[dateKey] || makeEmptyDay();
      const newTasks = day.tasks.map(t=>t.id===tid?{...t,text}:t);
      const next = { ...prev, [dateKey]: { ...day, tasks: newTasks } };
      dayDataRef.current = next;
      saveToStorage({dayData: next});
      return next;
    });
  }

  function commitTask(){
    if(!editingTask) return;
    const {dateKey, tid} = editingTask;
    setEditingTask(null);
    setDayData(prev => {
      const day = prev[dateKey] || makeEmptyDay();
      let newTasks;
      if(!editText.trim()){
        newTasks = day.tasks.filter(t=>t.id!==tid);
      } else {
        newTasks = day.tasks.map(t=>t.id===tid?{...t,text:editText}:t);
      }
      const next = { ...prev, [dateKey]: { ...day, tasks: newTasks } };
      dayDataRef.current = next;
      saveToStorage({dayData: next});
      setTimeout(()=>autoMarkDoctor(dateKey, newTasks), 0);
      // Check repetition after commit (non-fixed tasks with real text)
      const committedTask = newTasks.find(t=>t.id===tid);
      if(committedTask && !committedTask.fixed && editText.trim()) {
        setTimeout(()=>{
          const norm = editText.trim().toLowerCase();
          const dd = dayDataRef.current || {};
          const matchDays = Object.keys(dd).filter(dk=>dk!==dateKey && (dd[dk].tasks||[]).some(t=>!t.fixed&&t.text&&t.text.toLowerCase()===norm&&!t.carried));
          const alreadyRecurring = recurringRef.current.some(r=>r.text.toLowerCase()===norm);
          if(matchDays.length>=2 && !alreadyRecurring) {
            const ok = window.confirm(`"${editText.trim()}" aparece en ${matchDays.length+1} días. ¿Convertirla en rutina automática?`);
            if(ok) saveRecurringTask({id:Date.now().toString(), text:editText.trim(), freq:"daily", createdAt:dateKey});
          }
        }, 400);
      }
      return next;
    });
  }

  function addFlexTask(dateKey){
    const id = Date.now();
    setDayData(prev => {
      const day = prev[dateKey] || makeEmptyDay();
      const next = { ...prev, [dateKey]: { ...day, tasks:[...day.tasks,{id,text:"",fixed:false,done:false}] } };
      dayDataRef.current = next;
      saveToStorage({dayData: next});
      return next;
    });
    setTimeout(()=>startEdit(dateKey, id, ""), 30);
  }

  function addFixedTask(dateKey){
    const id = Date.now();
    setDayData(prev => {
      const day = prev[dateKey] || makeEmptyDay();
      const next = { ...prev, [dateKey]: { ...day, tasks:[...day.tasks,{id,text:"",fixed:true}] } };
      dayDataRef.current = next;
      saveToStorage({dayData: next});
      return next;
    });
    setTimeout(()=>startEdit(dateKey, id, ""), 30);
  }

  function delTask(dateKey, tid){
    setDayData(prev => {
      const day = prev[dateKey] || makeEmptyDay();
      const newTasks = day.tasks.filter(t=>t.id!==tid);
      const next = { ...prev, [dateKey]: { ...day, tasks: newTasks } };
      dayDataRef.current = next;
      saveToStorage({dayData: next});
      setTimeout(()=>autoMarkDoctor(dateKey, newTasks), 0);
      return next;
    });
  }

  function saveKidsHealth(data) {
    setKidsHealth(data);
    kidsHealthRef.current = data;
    saveToStorage({kidsHealth: data});
  }

  function updateWeekOffset(off){
    setWeekOffset(off);
    weekOffsetRef.current = off;
    saveToStorage({weekOffset: off});
    // Minimizar todos los días de la nueva semana excepto hoy
    const todayKey = fmtFull(new Date());
    const newWeekStart = addDays(BASE_DATE, off*7);
    const initMin = {};
    for(let i=0;i<7;i++){
      const d = new Date(newWeekStart); d.setDate(d.getDate()+i);
      const dk = fmtFull(d);
      if(dk !== todayKey) initMin[dk] = true;
    }
    setMinimized(prev => ({...prev, ...initMin}));
  }

  function updateBudgetForMonth(monthKey, bud){
    setBudgets(prev => {
      const next = {...prev, [monthKey]: bud};
      budgetRef.current = next;
      saveToStorage({budgets: next});
      return next;
    });
  }

  function saveRoutines(next){ setRoutines(next); routinesRef.current=next; saveToStorage({routines:next}); }

  function saveRecurring(next){ setRecurring(next); recurringRef.current=next; saveToStorage({recurring:next}); }

  // FREQ helpers
  function nextRecurDate(createdAt, freq, fromDate) {
    // Parse dates as local integers to avoid any timezone issues
    function dateToDayNumber(s) {
      const [y,m,d] = s.split("-").map(Number);
      // Days since a fixed epoch using integer math only
      const a = Math.floor((14-m)/12), yr = y+4800-a, mo = m+12*a-3;
      return d + Math.floor((153*mo+2)/5) + 365*yr + Math.floor(yr/4) - Math.floor(yr/100) + Math.floor(yr/400) - 32045;
    }
    const originDay = dateToDayNumber(createdAt);
    const checkDay  = dateToDayNumber(fromDate);
    const diff = checkDay - originDay;
    if(diff < 0) return false;
    if(freq==="daily")     return true;
    if(freq==="every3")    return diff % 2 === 0;
    if(freq==="every5")    return diff % 5 === 0;
    if(freq==="weekly")    return diff % 7 === 0;
    if(freq==="biweekly")  return diff % 14 === 0;
    if(freq==="monthly"){
      const [oy,om,od] = createdAt.split("-").map(Number);
      const [cy,cm,cd] = fromDate.split("-").map(Number);
      return cd===od && (cy*12+cm) > (oy*12+om-1);
    }
    if(freq==="yearly"){
      const [oy,om,od] = createdAt.split("-").map(Number);
      const [cy,cm,cd] = fromDate.split("-").map(Number);
      return cd===od && cm===om && cy>=oy;
    }
    return false;
  }

  function getRecurringForDay(dateKey) {
    return recurringRef.current.filter(r => nextRecurDate(r.createdAt, r.freq, dateKey));
  }

  function saveRecurringTask(task) {
    const next = [...recurringRef.current, task];
    saveRecurring(next);
  }

  function deleteRecurring(id) {
    saveRecurring(recurringRef.current.filter(r=>r.id!==id));
    // Also remove any postponements for this recurring
    setDayData(prev => {
      const next = {};
      Object.keys(prev).forEach(dk => {
        const day = prev[dk];
        next[dk] = {...day, tasks: day.tasks.filter(t=>t.recurringId!==id)};
      });
      dayDataRef.current = next;
      saveToStorage({dayData: next});
      return next;
    });
  }

  function postponeRecurring(recurringId, originalDate) {
    // Mark original occurrence as postponed in dayData
    setDayData(prev => {
      const day = prev[originalDate] || makeEmptyDay();
      const already = day.tasks.find(t=>t.recurringId===recurringId&&t.postponed);
      if(already) return prev;
      const postponeTask = {id:Date.now().toString(), recurringId, text:"", postponed:true, fixed:true, postponeDate:null};
      const next = {...prev, [originalDate]: {...day, tasks:[...day.tasks, postponeTask]}};
      dayDataRef.current = next;
      saveToStorage({dayData: next});
      return next;
    });
  }

  function saveRecurring(next){ setRecurring(next); recurringRef.current=next; saveToStorage({recurring:next}); }
  function updateNutria(nut){
    setNutria(nut);
    nutriaRef.current = nut;
    saveToStorage({nutria: nut});
  }

  function handleMark(key,val){
    setCalMarks(prev => {
      const cur = Array.isArray(prev[key]) ? prev[key] : (prev[key] ? [prev[key]] : []);
      let next;
      if(!val){ next=[]; }
      else if(cur.includes(val)){ next=cur.filter(v=>v!==val); }
      else{ next=[...cur,val]; }
      const nm = {...prev};
      if(next.length===0) delete nm[key]; else nm[key]=next;
      calMarksRef.current = nm;
      saveToStorage({calMarks: nm});
      // Inyectar bloques automáticos según marcador
      if(val && !cur.includes(val)) {
        const GYM_BLOCKS = [
          {id:"gym-1", label:"Despertar, baño y desayuno ligero", start:"06:00", end:"06:30", color:"#1b5e20", steps:[]},
          {id:"gym-2", label:"Rutina ejercicios",                  start:"06:30", end:"07:30", color:"#2e7d52", steps:[]},
          {id:"gym-3", label:"Aseo personal",                      start:"07:30", end:"08:00", color:"#1b5e20", steps:[]},
          {id:"gym-4", label:"Desayuno completo",                  start:"08:00", end:"09:00", color:"#37474f", steps:[]},
        ];
        let blocksToAdd = null;
        if(val==="gym")   blocksToAdd = GYM_BLOCKS;
        
        if(blocksToAdd) {
          setTimeout(()=>{
            setDayData(prev2 => {
              const day2 = prev2[key] || makeEmptyDay();
              const existing = day2.schedule||[];
              const existingIds = new Set(existing.map(b=>b.id));
              const toAdd = blocksToAdd.filter(b=>!existingIds.has(b.id));
              if(toAdd.length===0) return prev2;
              const next2 = {...prev2, [key]:{...day2, schedule:[...existing,...toAdd]}};
              dayDataRef.current = next2;
              saveToStorage({dayData:next2});
              return next2;
            });
          }, 0);
        }
      }
      return nm;
    });
  }

  // Cambio 5: Detectar compras desde carrito — marcar día automáticamente
  function updateComprasItem(dateKey, itemId, fields) {
    setDayData(prev => {
      const day = prev[dateKey] || makeEmptyDay();
      const newCompras = (day.compras||[]).map(c=>c.id===itemId?{...c,...fields}:c);
      const next = {...prev, [dateKey]:{...day, compras:newCompras}};
      dayDataRef.current = next;
      saveToStorage({dayData:next});
      // Si hay ítems comprados (done:true), marcar día como compras en calMarks
      const hasPurchases = newCompras.some(c=>c.done);
      setCalMarks(cm => {
        const cur = Array.isArray(cm[dateKey])?cm[dateKey]:(cm[dateKey]?[cm[dateKey]]:[]);
        const hasCompras = cur.includes("compras");
        if(hasPurchases&&!hasCompras){
          const nm={...cm,[dateKey]:[...cur,"compras"]};
          calMarksRef.current=nm; saveToStorage({calMarks:nm}); return nm;
        }
        if(!hasPurchases&&hasCompras){
          const f=cur.filter(v=>v!=="compras");
          const nm={...cm}; if(f.length===0)delete nm[dateKey]; else nm[dateKey]=f;
          calMarksRef.current=nm; saveToStorage({calMarks:nm}); return nm;
        }
        return cm;
      });
      return next;
    });
  }

  function resetWeek(){
    // Clear only the 7 days of the current week
    const keysToDelete = Array.from({length:7},(_,i)=>fmtFull(addDays(weekStart,i)));
    setDayData(prev => {
      const next = {...prev};
      keysToDelete.forEach(k=>delete next[k]);
      dayDataRef.current = next;
      saveToStorage({dayData: next});
      return next;
    });
  }

  // ── Payload completo para export/backup — fuente única usada por el botón
  // 💾 manual y por el auto-export silencioso, para que nunca queden campos
  // afuera en uno y no en el otro.
  function buildExportPayload(){
    const clone = (v) => JSON.parse(JSON.stringify(v ?? null));
    return {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      dayData: clone(dayDataRef.current),
      weekOffset: weekOffsetRef.current,
      budgets: clone(budgetRef.current),
      nutria: clone(nutriaRef.current),
      calMarks: clone(calMarksRef.current),
      cookingOpts: clone(cookingOpts),
      aseoOpts: clone(aseoOpts),
      routines: clone(routinesRef.current),
      recurring: clone(recurringRef.current),
      lastRollover: lastRolloverRef.current,
      kidsHealth: clone(kidsHealthRef.current),
      custody: clone(custody),
      fadimanData: clone(fadimanDataRef.current),
      nutriLog: clone(nutriLogRef.current),
      ejercicioLog: clone(ejercicioLogRef.current),
      ejercicioDecks: clone(ejercicioDecksRef.current),
      customFoods: clone(customFoodsRef.current),
      foodOverrides: clone(foodOverridesRef.current),
      customEjercicios: clone(customEjerciciosRef.current),
      nutriDecks: clone(nutriDecksRef.current),
      pokeInventario: clone(pokeInventarioRef.current),
      pokeCarpetas: clone(pokeCarpetasRef.current),
      pokeDarkCatalogo: clone(pokeDarkCatalogoRef.current),
      pokePriceCache: clone(pokePriceCacheRef.current),
      // Feed mantiene sus propias claves de localStorage, aisladas del motor
      // de refs de arriba (angst-feed-proto-v1 = cola/vistos/buzon/último
      // refresh; las otras dos = sets de "visto/escuchado"). Se leen directo
      // de localStorage acá porque no pasan por React state en este nivel.
      feedState: readLocalJSON("angst-feed-proto-v1"),
      feedMicrodocsVistos: readLocalJSON("angst-feed-microdocs-vistos-v1"),
      feedPodcastsEscuchados: readLocalJSON("angst-feed-podcasts-escuchados-v1"),
    };
  }
  function readLocalJSON(key){
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; } catch(e){ return null; }
  }
  // Lista de campos persistidos que SIEMPRE deben viajar en el export.
  // Si agregás un campo de estado nuevo: sumalo en buildExportPayload,
  // en saveToStorage, acá, y en restoreFromPayload — las 4 ubicaciones
  // de la regla vital.
  const REQUIRED_EXPORT_FIELDS = ['dayData','weekOffset','budgets','nutria','calMarks','cookingOpts','aseoOpts','routines','recurring','lastRollover','kidsHealth','custody','fadimanData','nutriLog','ejercicioLog','ejercicioDecks','customFoods','foodOverrides','customEjercicios','nutriDecks','pokeInventario','pokeCarpetas','pokeDarkCatalogo','pokePriceCache','feedState','feedMicrodocsVistos','feedPodcastsEscuchados'];

  function handleExport(){
    const fullPayload = buildExportPayload();
    const missing=REQUIRED_EXPORT_FIELDS.filter(k=>fullPayload[k]===undefined);
    if(missing.length){setExportOk(`Faltan: ${missing.join(', ')}`);return;}
    const ok=downloadBackupJSON(fullPayload);
    setExportOk(ok);setTimeout(()=>setExportOk(null),3000);
  }

  // ── Restauración completa compartida — usada tanto por el AngstData de un
  // .xlsx como por la carga directa de un .json. Cubre los 23 campos persistidos.
  function restoreFromPayload(d, sourceLabel){
    if(!d || typeof d !== "object") return false;
    if(d.dayData){ setDayData(d.dayData); dayDataRef.current=d.dayData; }
    if(d.weekOffset!==undefined){ setWeekOffset(d.weekOffset); weekOffsetRef.current=d.weekOffset; }
    if(d.budgets){ setBudgets(d.budgets); budgetRef.current=d.budgets; }
    if(d.nutria){ updateNutria(d.nutria); }
    if(d.calMarks){ setCalMarks(d.calMarks); calMarksRef.current=d.calMarks; }
    if(d.cookingOpts){ setCookingOpts(d.cookingOpts); }
    if(d.aseoOpts){ setAseoOpts(d.aseoOpts); }
    if(d.routines){ setRoutines(d.routines); routinesRef.current=d.routines; }
    if(d.recurring){ setRecurring(d.recurring); recurringRef.current=d.recurring; }
    if(d.lastRollover){ setLastRollover(d.lastRollover); lastRolloverRef.current=d.lastRollover; }
    if(d.kidsHealth){ setKidsHealth(d.kidsHealth); kidsHealthRef.current=d.kidsHealth; }
    if(d.custody !== undefined){ setCustody(d.custody); }
    if(d.fadimanData){ setFadimanData(d.fadimanData); fadimanDataRef.current=d.fadimanData; }
    if(d.nutriLog){ setNutriLog(d.nutriLog); nutriLogRef.current=d.nutriLog; }
    if(d.ejercicioLog){ setEjercicioLog(d.ejercicioLog); ejercicioLogRef.current=d.ejercicioLog; }
    if(d.ejercicioDecks){ setEjercicioDecks(d.ejercicioDecks); ejercicioDecksRef.current=d.ejercicioDecks; }
    if(d.customFoods){ setCustomFoods(d.customFoods); customFoodsRef.current=d.customFoods; }
    if(d.foodOverrides){ setFoodOverrides(d.foodOverrides); foodOverridesRef.current=d.foodOverrides; }
    if(d.customEjercicios){ setCustomEjercicios(d.customEjercicios); customEjerciciosRef.current=d.customEjercicios; }
    if(d.nutriDecks){ setNutriDecks(d.nutriDecks); nutriDecksRef.current=d.nutriDecks; }
    if(d.pokeInventario){ setPokeInventario(d.pokeInventario); pokeInventarioRef.current=d.pokeInventario; }
    if(d.pokeCarpetas){ setPokeCarpetas(d.pokeCarpetas); pokeCarpetasRef.current=d.pokeCarpetas; }
    if(d.pokeDarkCatalogo){ setPokeDarkCatalogo(d.pokeDarkCatalogo); pokeDarkCatalogoRef.current=d.pokeDarkCatalogo; }
    if(d.pokePriceCache){ setPokePriceCache(d.pokePriceCache); pokePriceCacheRef.current=d.pokePriceCache; }
    // No persistir el JSON crudo importado (puede ser parcial y borraría
    // del localStorage los campos que no traía). Se arma el payload
    // completo desde los refs recién actualizados arriba, con fallback
    // explícito para cookingOpts/aseoOpts/custody (no tienen ref propio,
    // por lo que su valor de closure acá seguiría stale si el JSON los trae).
    const merged = {
      ...buildExportPayload(),
      cookingOpts: d.cookingOpts!==undefined ? d.cookingOpts : cookingOpts,
      aseoOpts: d.aseoOpts!==undefined ? d.aseoOpts : aseoOpts,
      custody: d.custody!==undefined ? d.custody : custody,
    };
    try { localStorage.setItem("angst-v12", JSON.stringify(merged)); } catch(e){}
    // Las 3 claves propias de Feed no viven en angst-v12 (no son refs de acá),
    // así que se escriben directo si el JSON importado las trae.
    if(d.feedState!=null){ try{ localStorage.setItem("angst-feed-proto-v1", JSON.stringify(d.feedState)); }catch(e){} }
    if(d.feedMicrodocsVistos!=null){ try{ localStorage.setItem("angst-feed-microdocs-vistos-v1", JSON.stringify(d.feedMicrodocsVistos)); }catch(e){} }
    if(d.feedPodcastsEscuchados!=null){ try{ localStorage.setItem("angst-feed-podcasts-escuchados-v1", JSON.stringify(d.feedPodcastsEscuchados)); }catch(e){} }
    setLoadMsg(`✓ Restauración completa desde ${sourceLabel||"backup"}`);
    setTimeout(()=>setLoadMsg(null), 4000);
    return true;
  }

  function handleLoad(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const isJson = /\.json$/i.test(file.name||"");
    const reader = new FileReader();

    // ── Ruta JSON: carga directa, restauración completa garantizada ──
    if(isJson){
      reader.onload = (ev) => {
        try {
          const d = JSON.parse(ev.target.result);
          if(!restoreFromPayload(d, "archivo JSON")){
            setLoadMsg("✗ El archivo JSON no contiene datos reconocibles");
            setTimeout(()=>setLoadMsg(null), 4000);
          }
        } catch(err) {
          console.error(err);
          setLoadMsg("✗ No se pudo leer el JSON — ¿está corrupto?");
          setTimeout(()=>setLoadMsg(null), 5000);
        }
      };
      reader.onerror = () => { setLoadMsg("✗ Error al leer el archivo"); setTimeout(()=>setLoadMsg(null),4000); };
      reader.readAsText(file);
      return;
    }

    // ── Ruta XLSX: hoja AngstData (completa) o fallback parcial (Ventas/Presupuesto) ──
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target.result);
        const wb = XLSX.read(data, {type:"array"});

        // ── Restauración completa desde hoja AngstData ──
        if(wb.SheetNames.includes("AngstData")) {
          try {
            const ws = wb.Sheets["AngstData"];
            const rows = XLSX.utils.sheet_to_json(ws, {header:1});
            // rows[0] = header, rows[1..] = chunks
            const json = rows.slice(1).map(r=>r[0]||"").join("");
            if(json) {
              const d = JSON.parse(json);
              if(restoreFromPayload(d, "backup AngstData")) return;
            }
          } catch(e2){ console.warn("AngstData parse failed:", e2); }
        }
        // ── Fallback: restauración parcial (archivos viejos sin AngstData) ──
        let loadedNutria = null;
        let loadedBudget = null;
        if (wb.SheetNames.includes("Ventas")) {
          const rows = XLSX.utils.sheet_to_json(wb.Sheets["Ventas"]);
          const emps = [...new Set(rows.map(r=>r["Emprendimiento"]).filter(Boolean))];
          const ventas = rows.map(r=>({
            id: Date.now().toString()+Math.random(),
            emprendimiento: r["Emprendimiento"]||"",
            producto: r["Producto"]||"",
            tamano: r["Tamaño"]||"",
            precio: Number(r["Precio"])||0,
            fecha: r["Fecha"]||new Date().toISOString(),
          }));
          const allEmps = [...new Set(["Nutria Papelería","Angst Papelería",...emps])];
          loadedNutria = {emprendimientos:allEmps, ventas};
        }
        if (wb.SheetNames.includes("Presupuesto")) {
          // Attempt to reconstruct budget from exported sheet
          try {
            const rows = XLSX.utils.sheet_to_json(wb.Sheets["Presupuesto"], {header:1});
            const defaultBud = makeDefaultBudget();
            let ingresos = {...defaultBud.ingresos};
            let readingIng = false;
            for (const row of rows) {
              if (row[0]==="INGRESOS") { readingIng=true; continue; }
              if (row[0]==="Total ingresos") { readingIng=false; continue; }
              if (readingIng && row[0] && row[1]!==undefined) {
                const k=String(row[0]);
                if (k in ingresos) ingresos[k]=Number(row[1])||0;
              }
            }
            loadedBudget = {...defaultBud, ingresos};
          } catch(_) { loadedBudget = makeDefaultBudget(); }
        }
        if (loadedNutria || loadedBudget) {
          if(loadedBudget){
            const now=new Date();
            const mk=`${now.getFullYear()}-${String(now.getDate()>=25?now.getMonth()+1:now.getMonth()||12).padStart(2,"0")}`;
            updateBudgetForMonth(mk, loadedBudget);
          }
          if(loadedNutria){updateNutria(loadedNutria);}
          setLoadMsg(`✓ Cargado: ${[loadedNutria&&"ventas",loadedBudget&&"presupuesto"].filter(Boolean).join(" + ")}`);
        } else {
          setLoadMsg("⚠️ Archivo leído pero sin datos reconocibles");
        }
        setTimeout(()=>setLoadMsg(null), 4000);
      } catch(err) {
        console.error(err);
        setLoadMsg("✗ No se pudo leer el archivo — ¿es un .xlsx o .json de angst?");
        setTimeout(()=>setLoadMsg(null), 5000);
      }
    };
    reader.onerror = () => { setLoadMsg("✗ Error al leer el archivo"); setTimeout(()=>setLoadMsg(null),4000); };
    reader.readAsArrayBuffer(file);
  }

  if(!loaded){
    return (
      <div style={{background:"#f7f6f4",minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center"}}>
        <span style={{fontFamily:"serif",color:"#ccc",letterSpacing:4,fontSize:12}}>cargando...</span>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Caveat:wght@400;600;700&family=DM+Sans:wght@300;400;500;600&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        html,body{overflow-x:hidden;}
        .app{background:#f7f6f4;min-height:100vh;font-family:'DM Sans',sans-serif;}
        .hdr{background:#111;padding:16px 20px;display:flex;align-items:center;justify-content:space-between;gap:10px;}
        .hdr-title{font-family:'Caveat',cursive;font-size:clamp(24px,5vw,32px);color:#fff;font-weight:700;}
        .saved-msg{font-family:'Caveat',cursive;color:#555;font-size:14px;}
        .tabs{background:#111;border-top:1px solid #1e1e1e;padding:0 16px;display:flex;overflow-x:auto;scrollbar-width:none;}
        .tabs::-webkit-scrollbar{display:none;}
        .tab{font-family:'Caveat',cursive;font-size:17px;color:#777;padding:10px 16px;cursor:pointer;border-bottom:2px solid transparent;transition:all 0.15s;font-weight:700;white-space:nowrap;}
        .tab.active{color:#fff;border-bottom:2px solid #fff;}
        .tab:hover{color:#bbb;}
        .sub-bar{padding:11px 20px;background:#fff;border-bottom:1px solid #eee;}
        .sub-text{font-family:'Caveat',cursive;font-size:20px;color:#aaa;}
        .wnav{background:#fff;border-bottom:1px solid #eee;padding:11px 20px;display:flex;align-items:center;justify-content:space-between;gap:10px;}
        .wnav-dates{font-family:'Caveat',cursive;font-size:20px;color:#555;flex:1;text-align:center;}
        .nbtn{background:transparent;border:1px dashed #ddd;border-radius:8px;padding:8px 14px;cursor:pointer;color:#999;font-size:22px;line-height:1;font-weight:700;transition:all 0.15s;}
        .nbtn:hover{border-color:#111;color:#111;}
        .calbtn{background:transparent;border:1px dashed #ddd;border-radius:8px;padding:8px 13px;cursor:pointer;font-size:17px;line-height:1;transition:all 0.15s;}
        .calbtn:hover{border-color:#111;}
        .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px;padding:14px;max-width:1400px;margin:0 auto;}
        .card{background:#fff;border:2px solid #eee;border-radius:16px;display:flex;flex-direction:column;;transition:border-color 0.2s;}
        .card:hover{border-color:#bbb;}
        .card.today-card{border:2px solid #111 !important;}
        .card.expanded{border:2px dashed #ccc;}
        .blk{background:#111;}
        .dhdr{padding:13px 16px 10px;display:flex;align-items:center;gap:8px;}
        .dname{font-family:'Caveat',cursive;font-size:34px;font-weight:700;color:#fff;line-height:1;}
        .ddate{font-family:'DM Sans',sans-serif;font-size:14px;color:#777;font-weight:600;}
        .min-btn{background:transparent;border:none;color:#666;cursor:pointer;font-size:15px;padding:2px 4px;line-height:1;flex-shrink:0;transition:color 0.12s;}
        .min-btn:hover{color:#fff;}
        .blk-div{height:1px;background:#2a2a2a;margin:0 16px;}
        .fzone{padding:9px 16px 12px;}
        .fzone-lbl{font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#666;font-family:'DM Sans',sans-serif;font-weight:700;margin-bottom:8px;display:flex;align-items:center;justify-content:space-between;}
        .fadd-btn{font-family:'DM Sans',sans-serif;font-size:10px;color:#555;background:transparent;border:1px dashed #444;border-radius:4px;padding:2px 8px;cursor:pointer;letter-spacing:1px;transition:all 0.12s;}
        .fadd-btn:hover{border-color:#aaa;color:#aaa;}
        .frow{display:flex;align-items:center;gap:7px;margin-bottom:8px;}
        .fdot{width:5px;height:5px;border-radius:50%;background:#555;flex-shrink:0;}
        .ftxt{flex:1;font-size:15px;color:#ddd;font-family:'DM Sans',sans-serif;cursor:pointer;line-height:1.4;font-weight:600;transition:color 0.12s;}
        .ftxt:hover{color:#fff;}
        .fbadge{font-size:13px;color:#aaa;font-family:'DM Sans',sans-serif;font-weight:700;flex-shrink:0;background:#1a1a1a;padding:3px 9px;border-radius:10px;letter-spacing:1px;cursor:pointer;}
        .fbadge:hover{color:#ddd;}
        .fdel{background:transparent;border:none;color:#444;font-size:15px;cursor:pointer;line-height:1;flex-shrink:0;transition:color 0.12s;padding:0 2px;}
        .fdel:hover{color:#e55;}
        .zsep{height:2px;background:#111;}
        .wsec{padding:14px 16px 9px;}
        .slbl{font-family:'Caveat',cursive;font-size:18px;color:#999;margin-bottom:9px;display:flex;align-items:center;gap:8px;}
        .slbl::after{content:'';flex:1;height:1px;border-top:1px dashed #e0e0e0;}
        .trow{display:flex;align-items:center;gap:8px;margin-bottom:11px;transition:transform 0.3s ease,opacity 0.15s;}
        @keyframes taskSlide{from{opacity:0;transform:translateY(-8px);}to{opacity:1;transform:translateY(0);}}
        .trow-new{animation:taskSlide 0.3s ease;}
        .ttxt{flex:1;font-size:14px;line-height:1.45;color:#333;cursor:pointer;padding:2px 5px;border:1px solid transparent;border-radius:5px;transition:border-color 0.12s;}
        .ttxt:hover{border-color:#ddd;}
        .dbtn{background:transparent;border:none;color:#ddd;cursor:pointer;font-size:21px;padding:0 3px;line-height:1;flex-shrink:0;transition:color 0.15s;}
        .dbtn:hover{color:#888;}
        .clkbtn{display:flex;align-items:center;gap:3px;background:transparent;border:1px solid #eee;border-radius:11px;padding:3px 7px;cursor:pointer;color:#bbb;font-size:11px;font-family:'DM Sans',sans-serif;transition:all 0.15s;white-space:nowrap;flex-shrink:0;}
        .clkbtn:hover{border-color:#aaa;color:#555;}
        .tinp{flex:1;border:1px dashed #aaa;background:#fafafa;border-radius:6px;padding:7px 9px;font-size:14px;font-family:'DM Sans',sans-serif;color:#111;outline:none;resize:none;line-height:1.4;}
        .abtn{width:100%;background:transparent;border:1px dashed #e0e0e0;border-radius:8px;color:#ccc;padding:10px;font-size:13px;cursor:pointer;margin-top:6px;letter-spacing:2px;font-family:'DM Sans',sans-serif;transition:all 0.15s;}
        .abtn:hover{border-color:#888;color:#555;}
        .hdiv{border:none;border-top:1px dashed #ebebeb;margin:3px 16px;}
        .bot{padding:13px 16px 18px;display:flex;flex-direction:column;gap:13px;}
        .brow{display:flex;flex-direction:column;gap:5px;}
        .tgrow{display:flex;align-items:center;gap:7px;flex-wrap:wrap;}
        .pill{font-family:'Caveat',cursive;font-size:15px;border-radius:24px;padding:5px 14px;cursor:pointer;transition:all 0.2s;white-space:nowrap;border:1.5px solid;}
        .pill.cook{background:#e8e0dc;border-color:#c4b5ad;color:#6b5c54;font-weight:600;}
        .pill.aseo{background:#e8e8e8;border-color:#999;color:#444;font-weight:600;}
        .pill.ayuno{background:#fff8f0;border-color:#e0c9b8;color:#b08060;border-style:dashed;}
        .pill.mugre{background:#f5f5f5;border-color:#ccc;color:#888;border-style:dashed;}
        .pill:hover{filter:brightness(0.95);}
        .rst-btn{background:transparent;border:1px dashed #444;color:#666;padding:5px 12px;font-size:10px;cursor:pointer;font-family:'DM Sans',sans-serif;letter-spacing:1px;border-radius:4px;transition:all 0.15s;}
        .rst-btn:hover{border-color:#fff;color:#fff;}
        .disk-btn{background:transparent;border:1px dashed #444;color:#888;padding:5px 10px;font-size:16px;cursor:pointer;border-radius:4px;transition:all 0.15s;line-height:1;}
        .disk-btn:hover{border-color:#fff;color:#fff;}
        .disk-btn.ok{border-color:#4caf50;color:#4caf50;}
        .ftr{background:#111;padding:16px 20px;display:flex;align-items:center;justify-content:space-between;margin-top:8px;}
        .ftr-copy{font-family:'Caveat',cursive;font-size:15px;color:#fff;font-weight:600;}
        .ftr-logo{font-family:'DM Sans',sans-serif;font-weight:700;font-size:12px;color:#fff;letter-spacing:4px;text-transform:uppercase;border:1px solid #fff;padding:4px 10px;}
        @media(max-width:640px){.grid{padding:10px;gap:10px;grid-template-columns:1fr;}}
      `}</style>

      {comprasOpen&&<ComprasModal
        items={dayData[comprasOpen]?.compras||[]}
        onSave={items=>updateDay(comprasOpen,{compras:items})}
        onMoveToNext={item=>{const nextDay=fmtFull(new Date(new Date(comprasOpen+"T12:00:00").getTime()+86400000));const ndd={...dayDataRef.current};const nd=ndd[nextDay]||makeEmptyDay();ndd[nextDay]={...nd,compras:[...nd.compras,{...item,origId:item.id,id:Date.now().toString()}]};setDayData(ndd);dayDataRef.current=ndd;saveToStorage({dayData:ndd});}}
        onClose={()=>setComprasOpen(null)}
      />}
      {notifClockOpen&&<AnalogClock h={notifClockOpen.h} m={notifClockOpen.m} onClose={()=>setNotifClockOpen(null)} onSave={({h,m})=>{
        const timeStr=String(h).padStart(2,"0")+":"+String(m).padStart(2,"0");
        if(notifClockOpen.onChange) notifClockOpen.onChange(timeStr);
        setNotifClockOpen(null);
        requestNotifPermission().then(ok=>setNotifGranted(ok));
      }}/>}
      {clockOpen&&<AnalogClock h={clockOpen.h} m={clockOpen.m} onClose={()=>setClockOpen(null)} onSave={({h,m})=>{
        updateTask(clockOpen.dateKey,clockOpen.tid,{deadline:{h,m}});
        const prevDate=new Date(clockOpen.dateKey+"T12:00:00"); prevDate.setDate(prevDate.getDate()-1);
        const prevKey=fmtFull(prevDate);
        const task=(dayDataRef.current[clockOpen.dateKey]?.tasks||[]).find(t=>t.id===clockOpen.tid);
        if(task?.text) setDayData(prev=>{
          const pd=prev[prevKey]||makeEmptyDay();
          if((pd.tasks||[]).some(t=>t.text===`preparar: ${task.text}`)) return prev;
          const pt={id:Date.now().toString()+Math.random().toString(36).slice(2),text:`preparar: ${task.text}`,fixed:false,done:false,deadline:{h:21,m:30},prepReminder:true};
          const next={...prev,[prevKey]:{...pd,tasks:[...(pd.tasks||[]),pt]}};
          dayDataRef.current=next; saveToStorage({dayData:next}); return next;
        });
      }}/>}
      {calOpen&&<CalendarModal weekStart={weekStart} marks={calMarks} onMark={handleMark} dayData={dayData} calMarks={calMarks} kidsHealth={kidsHealth} onWeekSelect={date=>{const dow=date.getDay();const mon=addDays(date,-(dow===0?6:dow-1));const diff=Math.round((mon-BASE_DATE)/(7*86400000));updateWeekOffset(diff);}} onClose={()=>setCalOpen(false)}/>}

      <div className="app">
        <div className="hdr">
          <div className="hdr-title" style={{whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{["Mi semana día a día","Presupuesto mensual","Emprendimientos","🧠 mindfulness","🩺 salud","🍄 Fadiman","🥗 Nutrición","🏋️ Ejercicio","🃏 Pokécripto"][page]}</div>
          <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
            {saved&&<span className="saved-msg">guardado ✓</span>}
            {loadMsg&&<span style={{fontFamily:"'Caveat',cursive",color:loadMsg.startsWith("✓")?"#4caf50":loadMsg.startsWith("⚠")?"#f0a000":"#c00",fontSize:13,maxWidth:220}}>{loadMsg}</span>}
            {exportOk===true&&<span style={{fontFamily:"'Caveat',cursive",color:"#4caf50",fontSize:13}}>descargado ✓</span>}
            {exportOk===false&&<span style={{fontFamily:"'Caveat',cursive",color:"#c00",fontSize:13}}>error al exportar</span>}
            {typeof exportOk==="string"&&<span style={{fontFamily:"'Caveat',cursive",color:"#c00",fontSize:13}}>{exportOk}</span>}
            <label title="Cargar backup .xlsx o .json" style={{position:"relative",cursor:"pointer",display:"inline-flex",alignItems:"center",justifyContent:"center",background:"transparent",border:"1px dashed #444",borderRadius:4,color:"#888",padding:"5px 10px",fontSize:14,lineHeight:1,overflow:"hidden"}}>
              📂<input type="file" accept=".xlsx,.xls,.json" onChange={handleLoad} style={{position:"absolute",inset:0,opacity:0,cursor:"pointer",width:"100%",height:"100%",fontSize:0}}/>
            </label>
            <button className={`disk-btn${exportOk===true?" ok":""}`} onClick={handleExport} title="Descargar backup .json">💾</button>
          </div>
        </div>

        {(()=>{
          const TABS=[{label:"📅 Semana",emoji:"📅"},{label:"💵 Presupuesto",emoji:"💵"},{label:"📒 Emprendimientos",emoji:"📒"},{label:"🧠 mindfulness",emoji:"🧠"},{label:"🩺 salud",emoji:"🩺"},{label:"🍄 fadiman",emoji:"🍄"},{label:"🥗 nutrición",emoji:"🥗"},{label:"🏋️ ejercicio",emoji:"🏋️"},{label:"🃏 pokécripto",emoji:"🃏"},{label:"📰 feed",emoji:"📰"}];
          return (
            <div className="tabs" style={{userSelect:"none"}}>
              {TABS.map((tab,ti)=>{
                const isActive=ti===page;
                return (
                  <div key={ti}
                    className={`tab ${isActive?"active":""}`}
                    onClick={()=>setPage(ti)}
                    style={{opacity:1,fontSize:isActive?17:18,padding:isActive?"10px 16px":"10px 10px",transition:"all 0.2s"}}>
                    {isActive?tab.label:tab.emoji}
                  </div>
                );
              })}
            </div>
          );
        })()}

        <div className="sub-bar"><div className="sub-text">{CYNICAL_SUBTITLES[subIdx]}</div></div>

        {/* ── PLANNER ── */}
        {page===0&&(
          <>
            {/* Sub-tabs */}
            <div style={{display:"flex",gap:0,padding:"8px 16px 0",background:"#fff",borderBottom:"1px solid #eee"}}>
              {[{k:"semana",label:"📅 semana"},{k:"rutinas",label:"🌱 prácticas"}].map(({k,label})=>(
                <button key={k} onClick={()=>setSemanaTab(k)} style={{fontFamily:"'Caveat',cursive",fontSize:15,padding:"6px 16px",background:"transparent",border:"none",borderBottom:semanaTab===k?"2px solid #111":"2px solid transparent",color:semanaTab===k?"#111":"#aaa",cursor:"pointer",transition:"all 0.15s"}}>{label}</button>
              ))}
            </div>
            {semanaTab==="rutinas"&&<RoutinesPage routines={routines} onSave={saveRoutines} onAddToDay={(name,emoji)=>{const tk=fmtFull(new Date());const nid=Date.now();const dd=dayDataRef.current||{};const d=dd[tk]||makeEmptyDay();const nx={...dd,[tk]:{...d,tasks:[...d.tasks,{id:nid,text:(emoji?emoji+" ":"")+name,fixed:false,done:false}]}};setDayData(nx);dayDataRef.current=nx;saveToStorage({dayData:nx});}}/>}
            {semanaTab==="semana"&&<><div className="wnav">
              <button className="nbtn" onClick={()=>updateWeekOffset(weekOffset-1)}>‹</button>
              <div className="wnav-dates">{fmt(weekStart)} — {fmt(addDays(weekStart,6))}</div>
              <button className="calbtn" onClick={()=>setCalOpen(true)}>📅</button>
              <button className="nbtn" onClick={()=>updateWeekOffset(weekOffset+1)}>›</button>
            </div>
            {(()=>{
              const weekDays = Array.from({length:7},(_,i)=>fmtFull(addDays(weekStart,i)));
              const eventsThisWeek = [
                ...(meleeMajors.filter(ev=>weekDays.some(dk=>dk>=ev.start&&dk<=ev.end)).map(ev=>({ev,color:"#ff6600",icon:<svg width="13" height="13" viewBox="0 0 24 24" style={{flexShrink:0}}><path fillRule="evenodd" fill="#fff" d="M12,1 A11,11,0,1,0,12,23 A11,11,0,1,0,12,1Z M1,14.5 H23 V16.5 H1Z M7.5,1 V23 H9.5 V1Z M8.5,12.5 A3,3,0,1,0,8.5,18.5 A3,3,0,1,0,8.5,12.5Z"/></svg>, url:"https://www.start.gg/"}))),
                ...(POKEMON_EVENTS.filter(ev=>weekDays.some(dk=>dk>=ev.start&&dk<=ev.end)).map(ev=>({ev,color:"#ffcc00",icon:<svg width="13" height="13" viewBox="0 0 12 12" style={{flexShrink:0}}><circle cx="6" cy="6" r="5" fill="none" stroke="#111" strokeWidth="1.3"/><line x1="1" y1="6" x2="11" y2="6" stroke="#111" strokeWidth="1.3"/><circle cx="6" cy="6" r="1.8" fill="#111"/></svg>, url:ev.url}))),
                ...(SC2_EVENTS.filter(ev=>weekDays.some(dk=>dk>=ev.start&&dk<=ev.end)).map(ev=>({ev,color:"#1565c0",icon:<span style={{fontSize:11,flexShrink:0}}>🎮</span>, url:ev.url}))),
              ];
              if(!eventsThisWeek.length) return null;
              return eventsThisWeek.map(({ev,color,icon,url},idx)=>{
                const isFinals = weekDays.some(dk=>dk===ev.end);
                const textColor = color==="#ffcc00"?"#111":"#fff";
                return (
                  <a key={idx} href={url} target="_blank" rel="noopener" style={{background:color,padding:"5px 20px",display:"flex",alignItems:"center",gap:8,textDecoration:"none"}}>
                    {icon}
                    <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:textColor,flex:1}}>{ev.name}</span>
                    {isFinals&&<span style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:textColor,opacity:0.7,letterSpacing:1,textTransform:"uppercase",background:"rgba(0,0,0,0.15)",borderRadius:4,padding:"2px 6px"}}>finals</span>}
                  </a>
                );
              });
            })()}
            <div className="grid">
              {DAY_NAMES.map((dayName,di)=>{
                const dayDate = addDays(weekStart,di);
                const dateKey = fmtFull(dayDate);
                const day = dayData[dateKey] || makeEmptyDay();
                const todayKey = fmtFull(new Date());
                const isToday = dateKey === todayKey;
                const fixed = day.tasks.filter(t=>t.fixed);
                const flex  = day.tasks.filter(t=>!t.fixed);
                const hol = getHoliday(dayDate);
                const isMin = !!minimized[dateKey];
                const dayMarkArr = Array.isArray(calMarks[dateKey])?calMarks[dateKey]:(calMarks[dateKey]?[calMarks[dateKey]]:[]);
                const MARK_COLORS = {social:"#4caf50",romantic:"#e91e8c",work:"#5c7a99",colegio:"#7b4fd4",doctor:"#e53935"};
                const dowDay = new Date(dateKey+"T12:00:00").getDay();
                const isWeekend = dowDay===0||dowDay===6;
                const withKidsToday = isWithKids(dateKey, custody);
                const SLIPPI_BASE = new Date("2024-04-15T00:00:00Z");
                const diffDays = Math.round((new Date(dateKey+"T00:00:00Z")-SLIPPI_BASE)/86400000);
                const isSlippiFree = diffDays>=0 && diffDays%4===0;
                const majorToday   = meleeMajors.find(ev=>dateKey>=ev.start&&dateKey<=ev.end);
                const pokemonToday = POKEMON_EVENTS.find(ev=>dateKey>=ev.start&&dateKey<=ev.end);
                const sc2Today     = SC2_EVENTS.find(ev=>dateKey>=ev.start&&dateKey<=ev.end);
                const isMajorFinals  = majorToday&&dateKey===majorToday.end;
                const isPokemonFinals= pokemonToday&&dateKey===pokemonToday.end;
                const isSc2Finals    = sc2Today&&dateKey===sc2Today.end;
                return (
                  <div key={dateKey} className={`card${!isMin?" expanded":""}${isToday?" today-card":""}`} style={isToday?{border:"2px solid #fff",boxShadow:"0 0 0 2px #111",borderRadius:16}:hol?{borderStyle:"solid",borderColor:hol.type==="weekend"?"#ddd":"#111"}:{}}>
                    <div className="blk" style={{
                      background:isWeekend?"#fff":dayMarkArr.includes("work")?"#0a0e14":dayMarkArr.includes("romantic")?"#1a0a10":dayMarkArr.includes("social")?"#0a140a":dayMarkArr.includes("colegio")?"#130a1f":dayMarkArr.includes("doctor")?"#1a0a0a":dayMarkArr.includes("gym")?"#1a0f00":"#111",
                      outline:isToday?"2px dashed #111":(isWeekend&&!withKidsToday)?"2px dashed #111":isWeekend?"1px solid #111":"none",
                      outlineOffset:"-5px"
                    }}>
                      <div className="dhdr">
                        <div className="dname" onClick={()=>setScheduleOpen(dateKey)} style={{cursor:"pointer",color:isWeekend?"#111":isSlippiFree?"#aac756":"#fff"}}>
                          {dayName}
                          {isToday&&<span style={{fontSize:10,background:isWeekend?"#111":"#fff",color:isWeekend?"#fff":"#111",borderRadius:4,padding:"1px 6px",marginLeft:6,fontFamily:"'DM Sans',sans-serif",fontWeight:700,letterSpacing:1,verticalAlign:"middle"}}>HOY</span>}
                          {majorToday&&<a href="https://www.start.gg/" target="_blank" rel="noopener" onClick={e=>e.stopPropagation()} style={{fontSize:9,background:isMajorFinals?"#ff6600":"rgba(255,102,0,0.35)",color:isMajorFinals?"#fff":"#ff6600",borderRadius:6,padding:"1px 5px",marginLeft:5,fontFamily:"'DM Sans',sans-serif",fontWeight:700,letterSpacing:0.5,verticalAlign:"middle",textDecoration:"none"}}>{isMajorFinals?"FINALS":"MAJOR"}</a>}
                          {pokemonToday&&<a href={pokemonToday.url} target="_blank" rel="noopener" onClick={e=>e.stopPropagation()} style={{fontSize:9,background:isPokemonFinals?"#ffcc00":"rgba(255,204,0,0.3)",color:isPokemonFinals?"#111":"#997700",borderRadius:6,padding:"1px 5px",marginLeft:3,fontFamily:"'DM Sans',sans-serif",fontWeight:700,letterSpacing:0.5,verticalAlign:"middle",textDecoration:"none"}}>{isPokemonFinals?"FINALS":"PKM"}</a>}
                          {sc2Today&&<a href={sc2Today.url} target="_blank" rel="noopener" onClick={e=>e.stopPropagation()} style={{fontSize:9,background:isSc2Finals?"#1565c0":"rgba(21,101,192,0.3)",color:isSc2Finals?"#fff":"#1565c0",borderRadius:6,padding:"1px 5px",marginLeft:3,fontFamily:"'DM Sans',sans-serif",fontWeight:700,letterSpacing:0.5,verticalAlign:"middle",textDecoration:"none"}}>{isSc2Finals?"FINALS":"SC2"}</a>}
                        </div>
                        <div className="ddate">{fmt(dayDate)}</div>
                        {(()=>{
                          const isWorkDay2 = dayMarkArr.includes("work");
                          const fields = [day.menu, day.aseoMode, day.cookingMode, day.summary, day.energy, day.concentration, day.intensity||day.mood];
                          if(isWorkDay2) fields.push(day.workLevel);
                          fields.push(day.sleep);
                          const hasNutri = (nutriLog[dateKey]||[]).length > 0;
                          fields.push(hasNutri ? "ok" : undefined);
                          const filled = fields.filter(f=>f!==undefined&&f!==null&&f!=="").length;
                          const pct = Math.round((filled/fields.length)*100);
                          const batColor = pct<=30?"#e53935":pct<=60?"#ff9800":pct<=90?"#ffcc00":"#4caf50";
                          return (
                            <div title={`registro: ${pct}%`} style={{display:"flex",alignItems:"center",gap:2,marginLeft:2}}>
                              <div style={{width:12,height:18,border:`1.5px solid ${isWeekend?"#555":"rgba(255,255,255,0.3)"}`,borderRadius:2,padding:1,position:"relative",flexShrink:0}}>
                                <div style={{position:"absolute",top:"-3px",left:"50%",transform:"translateX(-50%)",width:4,height:2,background:isWeekend?"#555":"rgba(255,255,255,0.3)",borderRadius:"1px 1px 0 0"}}/>
                                <div style={{width:"100%",height:`${pct}%`,background:batColor,borderRadius:1,position:"absolute",bottom:1,left:1,right:1,width:"calc(100% - 2px)",transition:"height 0.3s"}}/>
                              </div>
                            </div>
                          );
                        })()}
                        {(()=>{const hids=Array.isArray(day.humors)&&day.humors.length>0?day.humors:(day.humor?[day.humor]:[]);return hids.length>0?<div style={{display:"flex",gap:1,marginLeft:4}}>{hids.map(hid=>{const hobj=[...DEFAULT_HUMORS,...(day.humorCustom||[])].find(h=>h.id===hid);return hobj?<span key={hid} style={{fontSize:13}}>{hobj.emoji}</span>:null;})}</div>:null;})()}
                        {(()=>{const hasUrgent=(day.tasks||[]).some(t=>t.urgent&&!t.done);return hasUrgent?<span style={{fontSize:11,filter:"drop-shadow(0 0 3px #ff3b30)",marginRight:2}} title="tarea urgente">🚨</span>:null;})()}
                        {dayMarkArr.length>0&&<div style={{display:"flex",gap:2,alignItems:"center"}}>{dayMarkArr.map(m=>{
                          if(m==="social")return <span key={m} style={{fontSize:12}}>🟢</span>;
                          if(m==="romantic")return <span key={m} style={{fontSize:12}}>🌸</span>;
                          if(m==="work")return <span key={m} style={{fontSize:12}}>💼</span>;
                          if(m==="colegio")return <span key={m} style={{fontSize:12}}>🎒</span>;
                          if(m==="doctor")return <span key={m} style={{fontSize:12}}>🏥</span>;
                          if(m==="gym")return <svg key={m} width="13" height="13" viewBox="0 0 24 24" style={{display:"inline-block",verticalAlign:"middle"}}><rect x="1" y="9" width="3" height="6" rx="1" fill="#26a69a"/><rect x="4" y="7" width="2.5" height="10" rx="1" fill="#26a69a"/><rect x="6.5" y="10.5" width="11" height="3" rx="1" fill="#26a69a"/><rect x="17.5" y="7" width="2.5" height="10" rx="1" fill="#26a69a"/><rect x="20" y="9" width="3" height="6" rx="1" fill="#26a69a"/></svg>;
                          if(m==="melee")return <svg key={m} width="13" height="13" viewBox="0 0 24 24" style={{display:"inline-block",verticalAlign:"middle"}}><path fillRule="evenodd" fill="#ff6600" d="M12,1 A11,11,0,1,0,12,23 A11,11,0,1,0,12,1Z M1,14.5 H23 V16.5 H1Z M7.5,1 V23 H9.5 V1Z M8.5,12.5 A3,3,0,1,0,8.5,18.5 A3,3,0,1,0,8.5,12.5Z"/></svg>;
                          if(m==="pokemon")return <svg key={m} width="13" height="13" viewBox="0 0 12 12" style={{display:"inline-block"}}><circle cx="6" cy="6" r="5" fill="none" stroke="#ffcc00" strokeWidth="1.3"/><line x1="1" y1="6" x2="11" y2="6" stroke="#ffcc00" strokeWidth="1.3"/><circle cx="6" cy="6" r="1.8" fill="#ffcc00"/></svg>;
                          return null;
                        })}</div>}
                        {/* flex spacer always present - holiday label sits inside it, min-btn stays pinned right */}
                        <div style={{flex:1,display:"flex",justifyContent:"flex-end",alignItems:"center",minWidth:0}}>
                          {hol&&hol.type!=="weekend"&&<div style={{fontSize:9,color:"#555",fontFamily:"'DM Sans',sans-serif",textAlign:"right",lineHeight:1.3,fontWeight:600,maxWidth:90,overflow:"hidden"}}>{hol.type==="cl"&&"🇨🇱 "}{hol.type==="us"&&"🇺🇸 "}{hol.type==="both"&&"🇨🇱🇺🇸 "}{hol.label}</div>}
                        </div>
                        {(()=>{
                          const ds = computeStressScore(dateKey, dayData, calMarks, kidsHealth);
                          const barColor = ds<=5?"#4caf50":ds<=7?"#ff9800":"#f44336";
                          const label = ds<=5?"tranqui":ds<=7?"meh":"full";
                          return (
                            <div title={`carga: ${label} (${ds}/10)`} onClick={()=>setMinimized(m=>({...m,[dateKey]:!m[dateKey]}))}
                              style={{display:"flex",alignItems:"center",gap:4,marginRight:2,cursor:"pointer",padding:"4px 4px"}}>
                              <div style={{display:"flex",gap:1.5,alignItems:"center"}}>
                                {Array.from({length:5}).map((_,i)=>(
                                  <div key={i} style={{width:3,height:i<Math.ceil(ds/2)?8:4,borderRadius:1.5,
                                    background:i<Math.ceil(ds/2)?barColor:"rgba(255,255,255,0.12)",
                                    transition:"all 0.2s"}}/>
                                ))}
                              </div>
                            </div>
                          );
                        })()}
                        <button className="min-btn" onClick={()=>setMinimized(m=>({...m,[dateKey]:!m[dateKey]}))} style={{color:isWeekend?"#aaa":undefined}} title={isMin?"expandir":"minimizar"}>{isMin?"▾":"▴"}</button>
                      </div>
                      {!isMin&&(fixed.length>0||getRecurringForDay(dateKey).length>0)&&(
                        <>
                          <div className="blk-div"/>
                          <div className="fzone">
                            <div className="fzone-lbl">
                              <span>Tareas fijas</span>
                              <button className="fadd-btn" onClick={()=>addFixedTask(dateKey)}>+ agregar</button>
                            </div>
                            {/* Recurring tasks */}
                            {getRecurringForDay(dateKey).map(rec=>{
                              const postponeEntry = (dayData[dateKey]?.tasks||[]).find(t=>t.recurringId===rec.id&&t.postponed);
                              const FREQ_LABELS = {daily:"diaria",every3:"c/2d",every5:"c/5d",weekly:"semanal",biweekly:"quincenal",monthly:"mensual",yearly:"anual"};
                              if(postponeEntry) return (
                                <div key={rec.id} className="frow" style={{opacity:0.4}}>
                                  <div className="fdot" style={{background:"#aaa"}}/>
                                  <div style={{flex:1,fontSize:14,color:"#aaa",fontFamily:"'DM Sans',sans-serif",textDecoration:"line-through"}}>{rec.text}</div>
                                  <span style={{fontSize:9,color:"#bbb",letterSpacing:1}}>pospuesta</span>
                                </div>
                              );
                              return (
                                <div key={rec.id} className="frow">
                                  <div className="fdot" style={rec.urgent?{background:"#ff3b30",boxShadow:"0 0 5px #ff3b30",animation:"pulse 1.2s infinite"}:{}}/>
                                  <div className="ftxt" style={{flex:1}}>{rec.text}</div>
                                  <span style={{fontSize:9,color:"#bbb",background:"#f0f0f0",borderRadius:8,padding:"2px 6px",letterSpacing:0.5,flexShrink:0}}>🔁 {FREQ_LABELS[rec.freq]||rec.freq}</span>
                                  <button onClick={()=>{saveRecurring(recurringRef.current.map(r=>r.id===rec.id?{...r,urgent:!r.urgent}:r));}} style={{background:"transparent",border:"none",cursor:"pointer",fontSize:12,opacity:rec.urgent?1:0.2,padding:"0 1px",lineHeight:1}} title="urgente">🚨</button>
                                  <button onClick={()=>postponeRecurring(rec.id, dateKey)} style={{background:"transparent",border:"none",color:"#bbb",fontSize:11,cursor:"pointer",padding:"0 3px",flexShrink:0}} title="posponer">→</button>
                                  <button onClick={()=>{if(window.confirm("¿Eliminar esta tarea recurrente y todas sus ocurrencias?"))deleteRecurring(rec.id);}} style={{background:"transparent",border:"none",color:"#ccc",fontSize:15,cursor:"pointer",flexShrink:0,lineHeight:1}} className="fdel">×</button>
                                </div>
                              );
                            })}
                            {fixed.map(task=>{
                              const isEd=editingTask?.dateKey===dateKey&&editingTask?.tid===task.id;
                              return (
                                <div key={task.id} className="frow" style={{position:"relative"}}>
                                  <div className="fdot" style={task.urgent?{background:"#ff3b30",boxShadow:"0 0 5px #ff3b30"}:{}}/>
                                  {isEd
                                    ?<textarea autoFocus value={editText} rows={1} onChange={e=>{const v=e.target.value;setEditText(v);persistTaskText(dateKey,task.id,v);}} onBlur={commitTask} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();commitTask();}}} style={{flex:1,background:"#222",border:"1px solid #555",color:"#fff",padding:"3px 7px",fontSize:14,fontFamily:"'DM Sans',sans-serif",fontWeight:600,outline:"none",resize:"none",borderRadius:4,lineHeight:1.4}}/>
                                    :<div className="ftxt" onClick={()=>startEdit(dateKey,task.id,task.text)}>{task.text}</div>
                                  }
                                  {task.deadline
                                    ?<div className="fbadge" style={{cursor:"pointer"}} onClick={()=>setClockOpen({dateKey,tid:task.id,h:task.deadline.h,m:task.deadline.m})}>{fmtTime(task.deadline)}</div>
                                    :<button onClick={()=>setClockOpen({dateKey,tid:task.id,h:9,m:0})} style={{background:"transparent",border:"none",cursor:"pointer",fontSize:13,opacity:0.25,padding:"0 2px",lineHeight:1,transition:"opacity 0.15s",flexShrink:0}} title="fijar hora">🕐</button>
                                  }
                                  <button onClick={()=>updateTask(dateKey,task.id,{urgent:!task.urgent})} style={{background:"transparent",border:"none",cursor:"pointer",fontSize:12,opacity:task.urgent?1:0.2,padding:"0 1px",lineHeight:1,transition:"opacity 0.15s"}} title="baliza">🚨</button>
                                  <FixedFreqBtn menuId={`${dateKey}:${task.id}:freq`} openMenu={openFMenu} setOpenMenu={setOpenFMenu} value={task.recurringId?recurringRef.current.find(r=>r.id===task.recurringId):null}
                                    onSetFreq={freq=>{
                                      // Create or update recurring for this fixed task
                                      if(!task.recurringId){
                                        const rid=Date.now().toString();
                                        saveRecurringTask({id:rid,text:task.text,freq,createdAt:dateKey,fixedTaskId:task.id});
                                        updateTask(dateKey,task.id,{recurringId:rid});
                                      } else {
                                        saveRecurring(recurringRef.current.map(r=>r.id===task.recurringId?{...r,freq}:r));
                                      }
                                    }}
                                    onClear={()=>{
                                      if(task.recurringId) deleteRecurring(task.recurringId);
                                      updateTask(dateKey,task.id,{recurringId:null});
                                    }}/>
                                  <button className="fdel" onClick={()=>delTask(dateKey,task.id)}>×</button>
                                </div>
                              );
                            })}
                          </div>
                        </>
                      )}
                      {!isMin&&fixed.length===0&&<div style={{padding:"4px 16px 10px"}}><button className="fadd-btn" onClick={()=>addFixedTask(dateKey)}>+ tarea fija</button></div>}
                    </div>

                    {!isMin&&(
                      <>
                        <div className="zsep"/>
                        <div className="wsec">
                          <div className="slbl">Pendientes</div>
                          {flex.map(task=>{
                            const isEd=editingTask?.dateKey===dateKey&&editingTask?.tid===task.id;
                            const dl=task.deadline||null,done=!!task.done;
                            return (
                              <React.Fragment key={task.id}>
                              {task.notDone && (
                                <div key={task.id+"_nd"} style={{display:"flex",alignItems:"center",gap:6,marginBottom:8,opacity:0.35,padding:"2px 0"}}>
                                  <div style={{width:14,height:14,borderRadius:3,border:"1px dashed #bbb",flexShrink:0}}/>
                                  <div style={{flex:1,fontSize:13,fontFamily:"'DM Sans',sans-serif",color:"#bbb",textDecoration:"line-through"}}>{task.text}</div>
                                  <div style={{fontSize:9,color:"#ccc",letterSpacing:1}}>no realizada</div>
                                </div>
                              )}
                              {!task.notDone&&<>
                              {(()=>{const fi=flex.findIndex(t=>t.id===task.id);const showLine=taskDragTarget?.dateKey===dateKey&&taskDragTarget?.idx===fi&&liftedTask?.dateKey===dateKey&&liftedTask?.tid!==task.id;return showLine?<div style={{height:2,background:"#111",borderRadius:1,margin:"2px 8px",transition:"opacity 0.1s"}}/>:null;})()}
                              <div key={task.id} className={`trow${isEd&&editText===""?" trow-new":""}`} style={liftedTask?.tid===task.id&&liftedTask?.dateKey===dateKey?{background:"#111",borderRadius:6,opacity:0.85}:{transition:"background 0.15s"}}
                                 onTouchStart={e=>{
                                   taskTouchX.current=e.touches[0].clientX;
                                   taskTouchY.current=e.touches[0].clientY;
                                   holdTimerRef.current=setTimeout(()=>{if(!done)setLiftedTask({dateKey,tid:task.id});},350);
                                 }}
                                 onTouchMove={e=>{
                                   const dx=Math.abs(e.touches[0].clientX-taskTouchX.current);
                                   const dy=e.touches[0].clientY-taskTouchY.current;
                                   if(dx>8||Math.abs(dy)>8) clearTimeout(holdTimerRef.current);
                                   if(liftedTask?.tid===task.id&&liftedTask?.dateKey===dateKey){
                                     const els=[...e.currentTarget.closest('.wsec').querySelectorAll('.trow')];
                                     const my=e.touches[0].clientY;
                                     const ti=els.findIndex(el=>{const r=el.getBoundingClientRect();return my>=r.top&&my<=r.bottom;});
                                     if(ti>=0) setTaskDragTarget({dateKey,idx:ti});
                                   }
                                 }}
                                 onTouchEnd={e=>{
                                   clearTimeout(holdTimerRef.current);
                                   const dx=e.changedTouches[0].clientX-taskTouchX.current;
                                   const isLifted=liftedTask?.tid===task.id&&liftedTask?.dateKey===dateKey;
                                   if(isLifted){
                                     if(taskDragTarget&&taskDragTarget.dateKey===dateKey&&taskDragTarget.idx!==flex.indexOf(task)){
                                       // reorder
                                       const ndd={...dayDataRef.current};
                                       const d=ndd[dateKey]||makeEmptyDay();
                                       const flexTasks=d.tasks.filter(t=>!t.fixed);
                                       const fixedTasks=d.tasks.filter(t=>t.fixed);
                                       const fi=flexTasks.findIndex(t=>t.id===task.id);
                                       if(fi>=0){const[m]=flexTasks.splice(fi,1);flexTasks.splice(taskDragTarget.idx,0,m);}
                                       ndd[dateKey]={...d,tasks:[...fixedTasks,...flexTasks]};
                                       setDayData(ndd);dayDataRef.current=ndd;saveToStorage({dayData:ndd});
                                     } else if(dx>60&&!done){
                                       // swipe right → postpone
                                       const nextDay=fmtFull(new Date(new Date(dateKey+"T12:00:00").getTime()+86400000));
                                       updateTask(dateKey,task.id,{notDone:true});
                                       const ndd={...dayDataRef.current};
                                       const nd=ndd[nextDay]||makeEmptyDay();
                                       const nid=Date.now().toString()+Math.random().toString(36).slice(2);
                                       ndd[nextDay]={...nd,tasks:[...nd.tasks,{...task,id:nid,carried:true,carriedFrom:dateKey,done:false,notDone:false}]};
                                       setDayData(ndd);dayDataRef.current=ndd;saveToStorage({dayData:ndd});
                                     }
                                     setLiftedTask(null);setTaskDragTarget(null);
                                   }
                                 }}>
                                <div onClick={()=>updateTask(dateKey,task.id,{done:!done})} style={{width:21,height:21,borderRadius:"50%",border:`2px solid ${done?"#111":"#ccc"}`,background:done?"#111":"transparent",flexShrink:0,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.15s"}}>
                                  {done&&<span style={{color:"#fff",fontSize:10,lineHeight:1,fontWeight:700}}>✓</span>}
                                </div>
                                {isEd
                                  ?<textarea className="tinp" autoFocus value={editText} rows={2} onChange={e=>{const v=e.target.value;setEditText(v);persistTaskText(dateKey,task.id,v);}} onBlur={commitTask} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();commitTask();}}}/>
                                  :<div className="ttxt" style={task.carried?{borderLeft:"2px dashed #ddd",paddingLeft:6}:{}} onClick={()=>!done&&startEdit(dateKey,task.id,task.text)} style={{textDecoration:done?"line-through":"none",color:done?"#bbb":"#333",cursor:done?"default":"pointer"}}>{task.text}</div>
                                }
                                {!done&&<button onClick={()=>updateTask(dateKey,task.id,{urgent:!task.urgent})} style={{background:"transparent",border:"none",cursor:"pointer",fontSize:12,opacity:task.urgent?1:0.15,padding:"0 1px",lineHeight:1,transition:"opacity 0.15s"}} title="urgente">🚨</button>}
                                {!done&&dl&&<span style={{fontSize:11,color:"#888",fontFamily:"'DM Sans',sans-serif",whiteSpace:"nowrap",padding:"0 2px",cursor:"pointer"}} onClick={()=>setClockOpen({dateKey,tid:task.id,h:dl.h,m:dl.m})}>{"🕐 "+fmtTime(dl)}</span>}
                                {!done&&!dl&&<button onClick={()=>setClockOpen({dateKey,tid:task.id,h:9,m:0})} style={{background:"transparent",border:"none",cursor:"pointer",fontSize:13,opacity:0.2,padding:"0 2px",lineHeight:1,flexShrink:0}} title="fijar hora">🕐</button>}
                                {!done&&task.carried&&<button onClick={()=>{
                                  const origDate=task.carriedFrom||dateKey;
                                  setDayData(prev=>{
                                    const next={...prev};
                                    if(next[origDate]) next[origDate]={...next[origDate],tasks:(next[origDate].tasks||[]).map(t=>t.id===(task.origId||task.id)?{...t,done:true,doneOnTime:true}:t)};
                                    next[dateKey]={...next[dateKey],tasks:(next[dateKey].tasks||[]).filter(t=>t.id!==task.id)};
                                    dayDataRef.current=next; saveToStorage({dayData:next}); return next;
                                  });
                                }} style={{background:"transparent",border:"1px dashed #666",borderRadius:4,color:"#777",fontSize:9,padding:"1px 5px",cursor:"pointer",fontFamily:"'DM Sans',sans-serif",flexShrink:0,whiteSpace:"nowrap"}}>✓ a tiempo</button>}
                                <button className="dbtn" onClick={()=>delTask(dateKey,task.id)}>×</button>
                              </div>
                              </>}
                              </React.Fragment>
                            );
                          })}
                          <button className="abtn" onClick={()=>addFlexTask(dateKey)}>+ agregar tarea</button>
                        </div>
                        <hr className="hdiv"/>
                        <div className="bot">
                          <div style={{display:"flex",alignItems:"center",gap:6,padding:"5px 14px 2px"}}>
                            <span style={{fontSize:11,color:"#bbb",fontFamily:"'DM Sans',sans-serif",flexShrink:0}}>abasto</span>
                            <div style={{flex:1,minWidth:0}}><EF key={`abasto-${dateKey}`} value={day.abasto} placeholder="qué hay que comprar..." onSave={v=>updateDay(dateKey,{abasto:v})} compact/></div>
                            <button onClick={()=>setComprasOpen(dateKey)} style={{
                              background:(day.compras||[]).some(i=>!i.done)?"#222":"transparent",
                              color:(day.compras||[]).some(i=>!i.done)?"#fff":"#ccc",
                              border:"1.5px dashed #ccc",borderRadius:20,padding:"4px 10px",
                              cursor:"pointer",fontSize:14,flexShrink:0,fontFamily:"'Caveat',cursive",
                            }}>🛒{(day.compras||[]).filter(i=>!i.done).length>0?<sup style={{fontSize:8}}>{(day.compras||[]).filter(i=>!i.done).length}</sup>:null}</button>
                          </div>
                          <div className="brow">
                            <div className="slbl">Cocina & Aseo</div>
                            <div className="tgrow">
                              <ModeMenu
                                value={day.cookingMode||""} opts={cookingOpts}
                                placeholder="🍳 comida" accent="#8B5E3C"
                                onSelect={v=>updateDay(dateKey,{cookingMode:v})}
                                onAddOpt={o=>{const next=[...cookingOpts,o];setCookingOpts(next);saveToStorage({cookingOpts:next});}}
                              />
                              <ModeMenu
                                value={day.aseoMode||""} opts={aseoOpts}
                                placeholder="🧹 aseo" accent="#4a7a6b"
                                onSelect={v=>updateDay(dateKey,{aseoMode:v})}
                                onAddOpt={o=>{const next=[...aseoOpts,o];setAseoOpts(next);saveToStorage({aseoOpts:next});}}
                              />
                            </div>
                          </div>
                          <div className="brow"><div className="slbl">Menú del día</div><EF key={`menu-${dateKey}`} value={day.menu} placeholder="qué vas a comer..." multiline onSave={v=>updateDay(dateKey,{menu:v})}/></div>
                          <div className="brow"><div className="slbl">Cierre del día</div><EF key={`summary-${dateKey}`} value={day.summary||""} placeholder="cómo fue el día..." multiline onSave={v=>updateDay(dateKey,{summary:v})} small/></div>
                          <HumorSelector value={Array.isArray(day.humors)&&day.humors.length>0?day.humors:(day.humor?[day.humor]:[])} custom={day.humorCustom||[]} onSave={(h,c)=>updateDay(dateKey,{humors:h,humorCustom:c})}/>
                          {/* Energía y concentración rápida */}
                          <div className="brow">
                            <div className="slbl" style={{marginBottom:8}}>Energía · Concentración · Sueño</div>
                            <div style={{display:"flex",flexDirection:"column",gap:10}}>
                              {[{field:"energy",icon:"⚡"},{field:"concentration",icon:"🧠"},{field:"sleep",icon:"😴"}].map(({field,icon})=>(
                                <div key={field} style={{display:"flex",gap:5,alignItems:"center"}}>
                                  {Array.from({length:5}).map((_,i)=>(
                                    <span key={i} onClick={()=>updateDay(dateKey,{[field]:i+1===(day[field]||0)?0:i+1})}
                                      style={{fontSize:22,cursor:"pointer",opacity:i<(day[field]||0)?1:0.18,filter:i<(day[field]||0)?"none":"grayscale(1)",transition:"all 0.15s",userSelect:"none"}}>
                                      {icon}
                                    </span>
                                  ))}
                                </div>
                              ))}
                            </div>
                          </div>
                          {(()=>{
                            const dow=new Date(dateKey+"T12:00:00").getDay();
                            if(dow===0||dow===6) return null;
                            const wl=day.workLevel||"normal";
                            return (
                              <div className="brow">
                                <div className="slbl" style={{marginBottom:8}}>Trabajo</div>
                                <div style={{display:"flex",gap:8}}>
                                  {[{k:"relajado",icon:"😌"},{k:"normal",icon:"😐"},{k:"duro",icon:"😤"}].map(({k,icon})=>(
                                    <button key={k} onClick={()=>updateDay(dateKey,{workLevel:k===wl?"normal":k})}
                                      style={{flex:1,background:wl===k?"#fff":"transparent",border:wl===k?"none":"1px dashed #555",borderRadius:8,padding:"8px 4px",cursor:"pointer",fontSize:20,opacity:wl===k?1:0.35,transition:"all 0.15s"}}>
                                      {icon}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </>}</>
        )}

        {page===1&&<BudgetPage budgets={budgets} onSaveBudget={updateBudgetForMonth}/>}
        {page===2&&<NutriaPage data={nutria} saveData={updateNutria} budgets={budgets} onSaveBudget={updateBudgetForMonth}/>}
        {page===3&&<EspritPage dayData={dayData} calMarks={calMarks} updateDay={updateDay} kidsHealth={kidsHealth}/>}
        {page===4&&<SaludPage kidsHealth={kidsHealth} saveKidsHealth={saveKidsHealth} dayData={dayData} updateDay={updateDay} calMarks={calMarks} saveCalMarks={(nm)=>{setCalMarks(nm);calMarksRef.current=nm;saveToStorage({calMarks:nm});}}/>}
        {page===5&&<FadimanPage data={fadimanData} saveData={d=>{setFadimanData(d);fadimanDataRef.current=d;saveToStorage({fadimanData:d});}}/>}
        {page===6&&<NutricionPage nutriLog={nutriLog} saveNutriLog={d=>{setNutriLog(d);nutriLogRef.current=d;saveToStorage({nutriLog:d});}}
          customFoods={customFoods} saveCustomFoods={d=>{setCustomFoods(d);customFoodsRef.current=d;saveToStorage({customFoods:d});}}
          foodOverrides={foodOverrides} saveFoodOverrides={d=>{setFoodOverrides(d);foodOverridesRef.current=d;saveToStorage({foodOverrides:d});}}
          nutriDecks={nutriDecks} saveNutriDecks={d=>{setNutriDecks(d);nutriDecksRef.current=d;saveToStorage({nutriDecks:d});}}
          getStressScore={getStressScoreForDate}
        />}
        {page===7&&<EjercicioPage ejercicioLog={ejercicioLog} saveEjercicioLog={d=>{setEjercicioLog(d);ejercicioLogRef.current=d;saveToStorage({ejercicioLog:d});}}
          customEjercicios={customEjercicios} saveCustomEjercicios={d=>{setCustomEjercicios(d);customEjerciciosRef.current=d;saveToStorage({customEjercicios:d});}}
          ejercicioDecks={ejercicioDecks} saveEjercicioDecks={d=>{setEjercicioDecks(d);ejercicioDecksRef.current=d;saveToStorage({ejercicioDecks:d});}}
        />}
        {page===8&&<PokecriptoPage
          inventario={pokeInventario}
          saveInventario={d=>{
            const next = typeof d === 'function' ? d(pokeInventarioRef.current) : d;
            setPokeInventario(next);pokeInventarioRef.current=next;saveToStorage({pokeInventario:next});
          }}
          carpetas={pokeCarpetas}
          saveCarpetas={d=>{setPokeCarpetas(d);pokeCarpetasRef.current=d;saveToStorage({pokeCarpetas:d});}}
          darkCatalogo={pokeDarkCatalogo}
          saveDarkCatalogo={d=>{
            const next = typeof d === 'function' ? d(pokeDarkCatalogoRef.current) : d;
            setPokeDarkCatalogo(next);
            pokeDarkCatalogoRef.current=next;
            saveToStorage({pokeDarkCatalogo:next});
          }}
          priceCache={pokePriceCache}
          savePriceCache={d=>{
            const next = typeof d === 'function' ? d(pokePriceCacheRef.current) : d;
            setPokePriceCache(next);pokePriceCacheRef.current=next;saveToStorage({pokePriceCache:next});
          }}
        />}
        {page===9&&<FeedPage onExit={()=>setPage(0)}/>}

        <div className="ftr">
          <div className="ftr-copy">{STOIC_PHRASES[footerIdx]}</div>
          <button onClick={()=>setSearchOpen(true)} style={{background:"transparent",border:"none",cursor:"pointer",fontSize:16,opacity:0.4,padding:"0 4px",lineHeight:1}} title="buscar">🔍</button>
          <div className="ftr-logo">ANGST</div>
        </div>
        {searchOpen&&<SearchModal dayData={dayData} nutria={nutria} kidsHealth={kidsHealth} routines={routines} onClose={()=>setSearchOpen(false)}/>}
        {scheduleOpen&&<ScheduleModal dateKey={scheduleOpen} day={dayData[scheduleOpen]||makeEmptyDay()} isWork={Array.isArray(calMarks[scheduleOpen])?(calMarks[scheduleOpen].includes("work")):(calMarks[scheduleOpen]==="work")} isColegio={Array.isArray(calMarks[scheduleOpen])?(calMarks[scheduleOpen].includes("colegio")):(calMarks[scheduleOpen]==="colegio")} onSave={sched=>updateDay(scheduleOpen,{schedule:sched})} onClose={()=>setScheduleOpen(null)} onNavigate={dk=>setScheduleOpen(dk)}/>}
      </div>
    </>
  );
}

export default AngstApp;
