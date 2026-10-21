import session from 'express-session';
export class PgSessionStore extends session.Store {
  constructor(pool){super();this.pool=pool;this.timer=setInterval(()=>this.maintenance().catch(()=>{}),300000);this.timer.unref();}
  async maintenance(){await this.pool.query('SELECT prune_app_sessions()');await this.pool.query('SELECT prune_form_upload_previews()');}
  get(sid,cb){this.pool.query('SELECT sess FROM session WHERE sid=$1 AND expire>now()',[sid]).then(r=>cb(null,r.rows[0]?.sess??null),cb);}
  set(sid,sess,cb){this.pool.query(`INSERT INTO session(sid,sess,expire) VALUES ($1,$2,$3) ON CONFLICT(sid) DO UPDATE SET sess=EXCLUDED.sess,expire=EXCLUDED.expire`,[sid,JSON.stringify(sess),sess.cookie.expires||new Date(Date.now()+28800000)]).then(()=>cb?.(),cb);}
  touch(sid,sess,cb){this.pool.query('UPDATE session SET expire=$2 WHERE sid=$1',[sid,sess.cookie.expires||new Date(Date.now()+28800000)]).then(()=>cb?.(),cb);}
  destroy(sid,cb){this.pool.query('SELECT delete_app_session($1)',[sid]).then(()=>cb?.(),cb);}
  close(){clearInterval(this.timer);}
}
