import {parentPort,workerData} from 'node:worker_threads';
import {makeWorkbook,readWorkbook} from './form-xlsx.js';
import {HttpError} from '../middleware/security.js';
try {
 const result=workerData.task==='parse'?readWorkbook(Buffer.from(workerData.input)):workerData.task==='generate'?makeWorkbook(workerData.input):null;
 if(result===null)throw new Error('Unsupported task');
 if(workerData.task==='generate')readWorkbook(result);
 parentPort.postMessage({type:'excel:result',result});
}catch(e){parentPort.postMessage({type:'excel:result',error:{status:e instanceof HttpError?e.status:422,message:e instanceof HttpError?e.message:'Berkas Excel tidak dapat diproses.'}});}
