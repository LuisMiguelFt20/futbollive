import {Router} from 'express';
import {randomBytes,createHash,scrypt as scryptCallback,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
import {pool} from './db.js';
const scrypt=promisify(scryptCallback),router=Router();
const digest=x=>createHash('sha256').update(x).digest('hex');
const publicUser=u=>({id:u.id,name:u.nombre,email:u.correo,role:u.rol,status:u.estado});
async function makeHash(password){const salt=randomBytes(16).toString('hex');const hash=await scrypt(password,salt,64,{N:16384,r:8,p:1});return `scrypt:${salt}:${hash.toString('hex')}`;}
async function matchHash(password,stored){try{const [alg,salt,h]=stored.split(':');if(alg!=='scrypt')return false;const target=Buffer.from(h,'hex');const check=await scrypt(password,salt,target.length,{N:16384,r:8,p:1});return timingSafeEqual(target,check)}catch{return false}}
function fail(res,e){console.error('Auth:',e.message);return res.status(e.status||500).json({error:e.status?e.message:'Error de base de datos; comprueba MySQL y el esquema SQL.'});}
// Protección preventiva por IP y ruta (un proceso). Para escalar a varias instancias, usar Redis.
const attempts=new Map();
function throttle(max,windowMs){return (req,res,next)=>{
 const key=`${req.ip}:${req.path}`,now=Date.now();
 if(attempts.size>5000)for(const [k,v] of attempts)if(v.until<=now)attempts.delete(k);
 let v=attempts.get(key);
 if(!v||v.until<=now){v={n:0,until:now+windowMs};attempts.set(key,v)}
 if(++v.n>max){res.setHeader('Retry-After',Math.ceil((v.until-now)/1000));return res.status(429).json({error:'Demasiados intentos. Intenta nuevamente más tarde.'})}
 next();
}}
const asyncRoute=fn=>(req,res,next)=>Promise.resolve(fn(req,res,next)).catch(e=>fail(res,e));
async function requireAuth(req,res,next){try{const token=(req.headers.authorization||'').match(/^Bearer ([a-f0-9]{64})$/i)?.[1];if(!token)return res.status(401).json({error:'Inicia sesión para continuar.'});const [rows]=await pool.execute(`SELECT u.id,u.nombre,u.correo,u.rol,u.estado FROM sesiones s JOIN usuarios u ON u.id=s.usuario_id WHERE s.token_hash=? AND s.expira_en>UTC_TIMESTAMP() LIMIT 1`,[digest(token)]);if(!rows.length||rows[0].estado!=='activo')return res.status(401).json({error:'Sesión inválida o cuenta desactivada.'});req.user=publicUser(rows[0]);req.tokenHash=digest(token);next()}catch(e){fail(res,e)}}
function admin(req,res,next){if(req.user.role!=='admin')return res.status(403).json({error:'Se requiere rol administrador.'});next()}
async function createSession(user){const token=randomBytes(32).toString('hex');await pool.execute('INSERT INTO sesiones(usuario_id,token_hash,expira_en) VALUES(?,?,DATE_ADD(UTC_TIMESTAMP(), INTERVAL 7 DAY))',[user.id,digest(token)]);return token}
router.get('/status',asyncRoute(async(req,res)=>{await pool.query('SELECT 1');res.json({ok:true,db:'MySQL/MariaDB',local:process.env.NODE_ENV!=='production'})}));
router.post('/register',throttle(8,60*60_000),asyncRoute(async(req,res)=>{const name=String(req.body.name||'').trim(),email=String(req.body.email||'').trim().toLowerCase(),password=String(req.body.password||'');if(name.length<2||name.length>80||!/^\S+@\S+\.\S+$/.test(email)||email.length>190||password.length<10||password.length>128)return res.status(400).json({error:'Nombre (2-80), correo válido y contraseña de 10-128 caracteres requeridos.'});const hashed=await makeHash(password);let result;try{[result]=await pool.execute("INSERT INTO usuarios(nombre,correo,password_hash,rol,estado) VALUES(?,?,?,'usuario','activo')",[name,email,hashed])}catch(e){if(e.code==='ER_DUP_ENTRY')return res.status(409).json({error:'Ya existe una cuenta con ese correo.'});throw e}const user={id:result.insertId,name,email,role:'usuario',status:'activo'};const token=await createSession(user);res.status(201).json({user,token})}));
router.post('/login',throttle(12,15*60_000),asyncRoute(async(req,res)=>{const email=String(req.body.email||'').trim().toLowerCase(),password=String(req.body.password||'');const [rows]=await pool.execute('SELECT * FROM usuarios WHERE correo=? LIMIT 1',[email]);const u=rows[0];if(!u||!(await matchHash(password,u.password_hash)))return res.status(401).json({error:'Correo o contraseña incorrectos.'});if(u.estado!=='activo')return res.status(403).json({error:'Cuenta desactivada. Contacta al administrador.'});const user=publicUser(u);res.json({user,token:await createSession(user)})}));
router.get('/me',requireAuth,(req,res)=>res.json({user:req.user}));
router.post('/logout',requireAuth,asyncRoute(async(req,res)=>{await pool.execute('DELETE FROM sesiones WHERE token_hash=?',[req.tokenHash]);res.json({ok:true})}));
router.get('/favorites',requireAuth,asyncRoute(async(req,res)=>{const [rows]=await pool.execute('SELECT partido_id FROM partidos_favoritos WHERE usuario_id=? ORDER BY creado_en DESC',[req.user.id]);res.json({items:rows.map(x=>x.partido_id)})}));
router.post('/favorites',requireAuth,asyncRoute(async(req,res)=>{const id=String(req.body.matchId||'').trim();if(!/^[a-zA-Z0-9_-]{1,80}$/.test(id))return res.status(400).json({error:'ID de partido inválido'});await pool.execute('INSERT IGNORE INTO partidos_favoritos(usuario_id,partido_id) VALUES(?,?)',[req.user.id,id]);res.json({ok:true})}));
router.delete('/favorites/:id',requireAuth,asyncRoute(async(req,res)=>{await pool.execute('DELETE FROM partidos_favoritos WHERE usuario_id=? AND partido_id=?',[req.user.id,req.params.id]);res.json({ok:true})}));
router.get('/admin/stats',requireAuth,admin,asyncRoute(async(req,res)=>{const [[{users}]]=await pool.query('SELECT COUNT(*) AS users FROM usuarios');const [[{favorites}]]=await pool.query('SELECT COUNT(*) AS favorites FROM partidos_favoritos');const [[{admins}]]=await pool.query("SELECT COUNT(*) AS admins FROM usuarios WHERE rol='admin'");res.json({users,admins,favorites})}));
router.get('/admin/users',requireAuth,admin,asyncRoute(async(req,res)=>{const [rows]=await pool.query('SELECT id,nombre,correo,rol,estado,creado_en FROM usuarios ORDER BY creado_en DESC LIMIT 100');res.json({items:rows.map(x=>({...x,role:x.rol,status:x.estado}))})}));
router.patch('/admin/users/:id',requireAuth,admin,asyncRoute(async(req,res)=>{const id=Number(req.params.id);const status=String(req.body.status||'');if(!Number.isInteger(id)||id<1||!['activo','bloqueado'].includes(status))return res.status(400).json({error:'ID o estado no válido.'});if(id===req.user.id)return res.status(400).json({error:'No puedes bloquear tu propia cuenta.'});const [r]=await pool.execute("UPDATE usuarios SET estado=? WHERE id=? AND rol='usuario'",[status,id]);if(!r.affectedRows)return res.status(404).json({error:'Usuario no encontrado o es administrador.'});if(status==='bloqueado')await pool.execute('DELETE FROM sesiones WHERE usuario_id=?',[id]);res.json({ok:true})}));
export function mountLocalAuth(app){app.use('/api/auth',router)}
export {makeHash};
