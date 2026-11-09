import 'dotenv/config';
import {createInterface} from 'node:readline/promises';
import {stdin as input,stdout as output} from 'node:process';
import {pool} from './db.js';
import {makeHash} from './auth.js';
if(process.env.NODE_ENV==='production'){console.error('Crea la cuenta desde tu PC, con DB_* configuradas hacia alwaysdata, nunca dentro de Render.');process.exit(1)}
const rl=createInterface({input,output});
try{const name=(await rl.question('Nombre del administrador: ')).trim();const email=(await rl.question('Correo del administrador: ')).trim().toLowerCase();const password=await rl.question('Contraseña (mínimo 10 caracteres; se verá al escribir): ');if(name.length<2||!/^\S+@\S+\.\S+$/.test(email)||password.length<10)throw new Error('Datos inválidos');const hash=await makeHash(password);await pool.execute("INSERT INTO usuarios(nombre,correo,password_hash,rol,estado) VALUES(?,?,?,'admin','activo') ON DUPLICATE KEY UPDATE password_hash=VALUES(password_hash),nombre=VALUES(nombre),rol='admin',estado='activo'",[name,email,hash]);console.log('Administrador creado/actualizado en la base configurada:',email)}catch(e){console.error(e.message);process.exitCode=1}finally{rl.close();await pool.end()}
