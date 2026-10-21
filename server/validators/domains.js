import {formDefinitions} from '../../static-web/assets/js/input-schema.js';
import {amiErrors} from '../../static-web/assets/js/ami-schema.js';
import {financeErrors} from '../../static-web/assets/js/finance-schema.js';
import { z } from 'zod';
import { parse, HttpError } from '../middleware/security.js';
const id=z.union([z.number().int().positive().safe(),z.string().regex(/^[1-9]\d*$/).refine(s=>Number.isSafeInteger(Number(s)),'ID terlalu besar')]).transform(String);
const count=z.number().int().nonnegative().max(2147483647);
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s=>!Number.isNaN(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s,'Tanggal tidak valid');
const text=z.string().trim().min(1).max(2000);
const types={id,count:count.nullable().default(null),year:z.number().int().min(2000).max(2200),date,text,
  nullableId:id.nullable().default(null),accreditationScope:z.enum(['institusi','prodi','internasional']),nullableLevel:z.enum(['D3','S1','S2','PROFESI']).nullable().default(null),
  nullableDuration:z.number().min(0).max(100).nullable().default(null),nullableText:text.nullable().default(null),nullableDate:date.nullable().default(null),nullableCount:count.nullable().default(null),
  nullableNumber:z.number().finite().nonnegative().max(1e18).nullable().default(null),nullableIPK:z.number().min(0).max(4).nullable().default(null),
  bool:z.boolean(),status:z.enum(['aktif','cuti','nonaktif']).default('aktif'),scope:z.enum(['institusi','prodi']),
  basis:z.enum(['actual','reported_percent']).default('actual'),metrics:z.object({pendapatan_miliar_rp:z.number().nonnegative().optional()}).strict().default({})};
const specs=[["mahasiswa-aktif","mahasiswa_aktif","baa","mahasiswa",{"total":"count","perempuan":"count","status_mhs":"status"},"prodi_id,status_mhs",true],["mahasiswa-baru","mahasiswa_baru","ppa","mahasiswa-baru",{"tahun_masuk":"year","tanggal_snapshot":"date","target":"count","realisasi_daftar_ulang":"count"},"prodi_id,tahun_masuk,tanggal_snapshot",true],["dosen","dosen_prodi","bsdm","dosen",{"total":"count","perempuan":"count","s3":"count","tenaga_pengajar":"count","asisten_ahli":"count","lektor":"count","lektor_kepala":"count","guru_besar":"count"},"prodi_id",true],["tendik","tendik_prodi","bsdm","tendik",{"laki":"count","perempuan":"count"},"prodi_id",true],["lulusan","lulusan","baa","lulusan",{"cakupan":"scope","tahun_lulus":"year","periode_wisuda":"nullableText","jumlah":"count","ipk_rata":"nullableIPK","masa_studi_rata":"nullableDuration"},"cakupan,prodi_id,tahun_lulus,periode_wisuda",false],["tracer","tracer_study","bpka","tracer",{"tahun_lulus":"year","jumlah_lulusan":"nullableCount","responden":"nullableCount","kerja_kurang_3_bulan":"nullableCount","kerja_lebih_3_bulan":"nullableCount","sesuai_bidang":"nullableCount","wirausaha":"nullableCount","studi_lanjut":"nullableCount"},"prodi_id,tahun_lulus",false],["tracer-ringkasan","tracer_ringkasan","bpka","tracer",{"tahun_lulus":"year","lulusan_institusi_id":"id","responden":"count","kerja_kurang_3_bulan_sumber":"nullableCount","kerja_lebih_3_bulan_sumber":"nullableCount","sesuai_bidang_sumber":"nullableCount","wirausaha_sumber":"nullableCount","studi_lanjut_sumber":"nullableCount","data_sementara":"bool"},"tahun_lulus",false],["kpi-capaian","kpi_capaian","prp","kpi",{"indikator_id":"id","tanggal_snapshot":"date","nilai_numerik":"nullableNumber","nilai_teks":"nullableText","nilai_tanggal":"nullableDate","basis_nilai":"basis","metrik_tambahan":"metrics","catatan":"nullableText"},"indikator_id,tanggal_snapshot",false],["kpi-input","kpi_input","prp","kpi",{"indikator_id":"id","tanggal_snapshot":"date","kode_input":"text","nilai_numerik":"nullableNumber","satuan":"text"},"indikator_id,kode_input,tanggal_snapshot",false]];
specs.push(['mahasiswa-angkatan','mahasiswa_angkatan','baa','mahasiswa',{angkatan:'year',total:'count'},'prodi_id,angkatan',true],['pegawai-ringkasan','pegawai_ringkasan','bsdm','pegawai-internal',{kategori:'pegawaiCategory',jumlah:'count'},'kategori',true]);
specs.push(['rka-target','rka_revisi','prp','kpi',{rka_target_id:'id',angka:'nullableNumber',catatan:'nullableText'},'rka_target_id',false]);
specs.push(['pmb-peminat','pmb_peminat','ppa','pmb-peminat',{tahun_masuk:'year',tanggal_snapshot:'date',jumlah_peminat:'count'},'tahun_masuk,tanggal_snapshot',true]);
specs.push(['akreditasi','akreditasi_revisi','pjm','akreditasi',{butir:'text',cakupan:'accreditationScope',prodi_id:'nullableId',nama_sumber:'text',jenjang:'nullableLevel',peringkat:'nullableText',nomor_sk:'nullableText',lembaga:'nullableText',berlaku_mulai:'nullableDate',berlaku_sampai:'nullableDate',status_sumber:'nullableText'},'butir',false]);
types.pegawaiCategory=z.enum(['dosen_tetap','dosen_tidak_tetap','tendik','pkwt']);
for(const name of ['penelitian','hki','pkm'])specs.push([name,name+'_revisi','lppm',name,{kategori:'text',tahun:'year',target:'count',...(name==='hki'?{diajukan:'count',disetujui:'count'}:{realisasi:'count',dana:'nullableNumber'})},'tahun,kategori',false]);
specs.push(['prestasi','prestasi_revisi','bkm','prestasi',{tahun:'year',jumlah_mahasiswa:'count',nasional:'count',regional:'count',internasional:'count',pkm_dikti:'count'},'tahun,prodi_id',false]);
specs.push(['kerjasama','kerjasama_revisi','kerjasama','kerjasama',{kategori:'text',tahun:'year',jumlah:'count',baris_sumber:'count',total_kosong:'count',selesai:'count',berjalan:'count',tahap_penjajakan:'count',proses_penjajakan:'count',dibatalkan:'count',mitra_institusi:'nullableText'},'tahun,kategori',false]);
specs.push(['produktivitas-dosen','produktivitas_dosen_revisi','bsdm','produktivitas-dosen',{kategori:'text',tahun:'year',target:'nullableNumber',realisasi:'nullableNumber',capaian_laporan:'nullableNumber'},'tahun,kategori',false]);
specs.push(['ami','ami_revisi','pjm','ami',{kategori:'text',tahun:'year',skor_standar:'count',realisasi:'count',capaian_laporan:'nullableNumber',jumlah_standar:'count',kesenjangan:'count',persen_kesenjangan:'nullableNumber',jumlah_prodi:'count',status_sumber:'nullableText'},'tahun,kategori',false]);
specs.push(['keuangan','keuangan_revisi','bku','keuangan',{kategori:'text',tahun:'year',target:'nullableNumber',realisasi:'nullableNumber',capaian_laporan:'nullableNumber',periode_sebelumnya:'nullableNumber',perubahan:'nullableNumber',status_sumber:'nullableText'},'tahun,kategori',false]);
specs.push(['formasi','formasi_revisi','bsdm','formasi',{kategori:'text',tahun:'year',jumlah:'count',target:'count',capaian_laporan:'nullableNumber',evaluasi:'nullableText'},'tahun,kategori',false],['pegawai-pergerakan','pergerakan_pegawai_revisi','bsdm','pegawai-internal',{kategori:'text',tahun:'year',jumlah:'count'},'tahun,kategori',false]);
types.ikuPeriod=z.enum(['T1','T2','T3','T4']);
specs.push(['iku-capaian','iku_capaian','prp','iku',{indikator_id:'id',tahun:'year',periode:'ikuPeriod',baseline:'nullableNumber',target:'nullableNumber',realisasi:'nullableNumber',status_sumber:'nullableText',catatan_verifikasi:'nullableText'},'tahun,periode,indikator_id',false]);
export const domains=Object.fromEntries(specs.map(([name,table,role,module,fields,keys,academic])=>{
  const shape={periode_laporan_id:id,periode_akademik_id:academic?id:id.nullable().default(null)};
  if(keys.split(',').includes('prodi_id'))shape.prodi_id=name==='lulusan'?id.nullable():id;
  for(const [k,type] of Object.entries(fields)){
    const column=formDefinitions[name]?.columns.find(c=>c.key===k);
    if(k==='kategori'&&formDefinitions[name]?.categories)shape[k]=z.enum(formDefinitions[name].categories.map(x=>x[0]));
    else if(column&&!column.text&&!column.date){let numeric=z.number().finite().min(column.min??0).max(column.max??1e18);if(column.integer)numeric=numeric.int();shape[k]=numeric.nullable().default(null);}
    else shape[k]=types[type];
  }
  return [name,{name,table,role,module,keys:[...(name==='iku-capaian'?[]:['periode_laporan_id']),...(academic||name==='lulusan'?['periode_akademik_id']:[]),...keys.split(',')],shape,
    schema:z.object(shape).strict(),patch:z.object({...Object.fromEntries(Object.entries(shape).map(([k,v])=>[k,v.optional()])),row_version:count.min(1)}).strict()}];
}));
export function getDomain(name){const d=domains[name];if(!d)throw new HttpError(404,'Domain belum tersedia.');return d;}
export function validate(d,value){const data=parse(d.schema,value);
  if(d.name==='ami'&&amiErrors(data).length)throw new HttpError(422,amiErrors(data).join(' '));
  if(d.name==='keuangan'&&financeErrors(data).length)throw new HttpError(422,financeErrors(data).join(' '));
  if(d.name==='akreditasi'&&(data.cakupan==='institusi'&&(data.prodi_id!==null||data.jenjang!==null||data.butir!=='institusi')||data.cakupan==='prodi'&&data.jenjang===null))throw new HttpError(422,'Cakupan institusi/prodi dan jenjang akreditasi tidak sesuai.');
  if(d.name==='lulusan'&&((data.cakupan==='institusi')!==(data.prodi_id===null)||data.cakupan==='prodi'&&!data.periode_akademik_id))throw new HttpError(422,'Cakupan dan prodi lulusan tidak sesuai.');
  if(d.name==='tracer'&&data.responden!==null&&data.jumlah_lulusan!==null&&data.responden>data.jumlah_lulusan)throw new HttpError(422,'Responden melebihi lulusan.');
  if(d.name==='kpi-capaian'&&[data.nilai_numerik,data.nilai_teks,data.nilai_tanggal].filter(v=>v!==null).length>1)throw new HttpError(422,'Isi hanya satu jenis nilai KPI.');
  return data;
}
export const rowVersion=z.object({row_version:count.min(1)}).strict();
export const reviewSchema=z.object({row_version:count.min(1),review_note:z.string().trim().min(1).max(2000),override:z.boolean().default(false),override_reason:z.string().trim().max(2000).optional()}).strict();
