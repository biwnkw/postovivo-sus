import {mkdir,readFile,writeFile} from 'node:fs/promises';

await mkdir('dist/server',{recursive:true});
const assets = {};
for (const [route,file,type] of [
  ['/','index.html','text/html'],
  ['/app.js','app.js','text/javascript'],
  ['/style.css','style.css','text/css'],
]) {
  assets[route] = {type:type+'; charset=utf-8',body:await readFile('web/'+file,'utf8')};
}
const worker = await readFile('backend/worker.mjs','utf8');
await writeFile('dist/server/index.js','const assets = '+JSON.stringify(assets)+';\n'+worker.replace("import assets from './assets.mjs';",''));
