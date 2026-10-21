import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import { rateLimit } from 'express-rate-limit';
import { HttpError,parse,requireLogin,newToken } from '../middleware/security.js';
import { withActor } from '../services/data.js';
const safe=user=>({id:user.id,nama:user.nama,email:user.email,role:user.role,unit_id:user.unit_id,must_change_password:user.must_change_password});
const regenerate=req=>new Promise((resolve,reject)=>req.session.regenerate(e=>e?reject(e):resolve()));
const save=req=>new Promise((resolve,reject)=>req.session.save(e=>e?reject(e):resolve()));
export function authRoutes(pool,limit=10,skipPasswordChange=false){const r=Router();
  r.get('/csrf',async(req,res)=>{req.session.csrf??=newToken();await save(req);res.json({data:{csrf:req.session.csrf}});});
  r.post('/login',rateLimit({windowMs:15*60*1000,limit,standardHeaders:'draft-7',legacyHeaders:false,handler:(req,res)=>res.status(429).json({error:{code:'LOGIN_RATE_LIMIT',message:'Terlalu banyak percobaan. Coba kembali nanti.'}})}),async(req,res)=>{
    const b=parse(z.object({email:z.string().email().max(254).transform(s=>s.toLowerCase()),password:z.string().min(1).max(72)}).strict(),req.body);
    const u=(await pool.query('SELECT * FROM users WHERE email=$1 AND aktif AND NOT is_system',[b.email])).rows[0];
    const dummy='$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6Ttxqc3eKhq6P5oqhHG0NXCLwR86K';
    const matches=await bcrypt.compare(b.password,u?.password_hash||dummy);
    if(!u||!matches)throw new HttpError(401,'Email atau password tidak sesuai.','LOGIN_FAILED');
    await regenerate(req);req.session.userId=u.id;req.session.version=u.session_version;req.session.csrf=newToken();req.user={...u,must_change_password:u.must_change_password&&!skipPasswordChange};
    await withActor(pool,req,'login',c=>c.query('UPDATE users SET last_login=now() WHERE id=$1',[u.id]));
    await save(req);res.json({data:{user:safe(req.user),csrf:req.session.csrf}});
  });
  r.get('/me',requireLogin,(req,res)=>res.json({data:safe(req.user)}));
  r.post('/logout',requireLogin,async(req,res)=>{await withActor(pool,req,'logout',c=>c.query("SELECT record_app_event('logout')"));
    await new Promise((resolve,reject)=>req.session.destroy(e=>e?reject(e):resolve()));res.clearCookie('itpln.sid',{path:'/',httpOnly:true,sameSite:'lax'});res.json({data:{logged_out:true}});});
  r.post('/change-password',requireLogin,async(req,res)=>{
    const b=parse(z.object({old_password:z.string().max(72),new_password:z.string().min(12).max(72).refine(s=>Buffer.byteLength(s)<=72,'Maksimal 72 byte')}).strict(),req.body);
    if(!await bcrypt.compare(b.old_password,req.user.password_hash))throw new HttpError(403,'Password lama tidak sesuai.');
    const hash=await bcrypt.hash(b.new_password,12);
    const u=await withActor(pool,req,'change_password',async c=>(await c.query('UPDATE users SET password_hash=$2,must_change_password=false,session_version=session_version+1 WHERE id=$1 RETURNING session_version',[req.user.id,hash])).rows[0]);
    await regenerate(req);req.session.userId=req.user.id;req.session.version=u.session_version;req.session.csrf=newToken();await save(req);
    res.json({data:{csrf:req.session.csrf,must_change_password:false}});
  });return r;
}
