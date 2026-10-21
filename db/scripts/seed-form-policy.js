import {domains} from '../../server/validators/domains.js';
import {transaction} from '../../server/services/db.js';
export async function seedFormPolicy(pool){return transaction(pool,async c=>{
 for(const d of Object.values(domains))await c.query('INSERT INTO definisi_formulir(domain,role_pengisi) VALUES($1,$2) ON CONFLICT(domain) DO NOTHING',[d.name,d.role]);
});}
