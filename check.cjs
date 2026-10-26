const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const root=path.resolve(__dirname,'..'),dist=__dirname;
const ids=new Map();let activeElement=null;
function element(tag='div',attrs={}) {
  const node={tag,attrs:{...attrs},dataset:{},style:{},events:{},value:attrs.value||'0',textContent:'',children:[],open:false};
  for(const [key,value]of Object.entries(attrs))if(key.startsWith('data-'))node.dataset[key.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=value;
  node.classList={values:new Set(),add(v){this.values.add(v)},remove(v){this.values.delete(v)},contains(v){return this.values.has(v)}};
  node.setAttribute=(k,v)=>node.attrs[k]=v;node.getAttribute=k=>node.attrs[k];node.removeAttribute=k=>delete node.attrs[k];
  node.addEventListener=(k,f)=>{node.events[k]=f};node.focus=()=>activeElement=node;
  node.showModal=()=>{node.open=true};node.close=()=>{node.open=false;node.events.close?.()};
  node.getBoundingClientRect=()=>({left:0,top:0,right:800,bottom:600});
  node.querySelectorAll=selector=>node.children.filter(child=>{
    if(selector==='a[href^="assets/"]')return child.tag==='a'&&child.attrs.href?.startsWith('assets/');
    if(selector==='img[data-asset]')return child.tag==='img'&&child.attrs['data-asset'];
    if(selector==='[data-document]')return child.attrs['data-document'];
    if(selector==='[data-image]')return child.attrs['data-image'];
    return false;
  });
  let markup='';
  Object.defineProperty(node,'innerHTML',{get:()=>markup,set:value=>{
    for(const child of node.children)if(child.attrs.id)ids.delete(child.attrs.id);
    markup=value;node.children=[];
    for(const match of value.matchAll(/<([a-z][a-z0-9-]*)(\s[^>]*|)>/gi)){
      const attributes={};for(const a of match[2].matchAll(/([\w-]+)="([^"]*)"/g))attributes[a[1]]=a[2];
      const child=element(match[1],attributes);node.children.push(child);if(attributes.id)ids.set(attributes.id,child);
    }
  }});
  return node;
}
for(const id of ['project-dialog','dialog-body','close-project','dialog-context'])ids.set(id,element('div',{id}));
const document={body:element('body'),getElementById:id=>ids.get(id)||null,querySelectorAll:()=>[],createElement:tag=>element(tag)};
const window={};
const context={window,document,Map,Uint8Array,URL,Blob,atob};vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(dist,'projects.js'),'utf8'),context);
let source=fs.readFileSync(path.join(dist,'app.js'),'utf8');
const last=source.lastIndexOf('})();');assert(last>=0);
source=source.slice(0,last)+'window.TEST={dyckPaths,cardGraphic,openProject,openDocument,connectAssets};\n'+source.slice(last);
vm.runInContext(source,context);
const api=window.TEST;
for(const [n,count]of [[2,2],[3,5],[4,14],[5,42],[6,132]]){
 const paths=api.dyckPaths(n);assert.equal(paths.length,count);assert.equal(new Set(paths).size,count);
 for(const p of paths){assert.equal(p.length,2*n);let balance=0;for(const move of p){balance+=move==='N'?1:-1;assert(balance>=0)}assert.equal(balance,0)}
}
assert.equal(window.PROJECTS.length,11);
for(const project of window.PROJECTS){
 assert.match(api.cardGraphic(project),/<svg|<img/);
 api.openProject(project.id);assert(ids.get('project-dialog').open);
 const html=ids.get('dialog-body').innerHTML;
 assert(!/\bundefined\b|\bNaN\b|forecasting-notes\.txt|output width|color dimensions/i.test(html));
 for(const m of html.matchAll(/(?:href|data-asset|data-document|data-image)="(assets\/[^"]+)"/g))assert(fs.existsSync(path.join(dist,m[1])),m[1]);
 ids.get('project-dialog').close();
}
api.openProject('catalan');
assert.equal(ids.get('path-status').textContent,'Path 1 of 42');
ids.get('next-path').events.click();assert.equal(ids.get('path-status').textContent,'Path 2 of 42');
ids.get('dyck-size').value='6';ids.get('dyck-size').events.input();assert.equal(ids.get('path-status').textContent,'Path 1 of 132');
ids.get('project-dialog').close();
let pagesChecked=0;
for(const [pdf,doc]of Object.entries(window.PORTFOLIO_DOCUMENTS)){
 api.openDocument(pdf);assert(ids.get('project-dialog').classList.contains('document-mode'));
 assert(ids.get('previous-page').disabled);
 for(let i=0;i<doc.pages.length;i++){
  assert.equal(ids.get('page-status').textContent,`Page ${i+1} of ${doc.pages.length}`);
  assert.equal(ids.get('document-page').src,doc.pages[i].image);
  assert(fs.existsSync(path.join(dist,doc.pages[i].image)));pagesChecked++;
  if(i<doc.pages.length-1)ids.get('next-page').events.click();
 }
 assert(ids.get('next-page').disabled);
 ids.get('zoom-in').events.click();assert.equal(ids.get('document-page').style.width,'125%');
 ids.get('fit-page').events.click();assert.equal(ids.get('document-page').style.width,'100%');
 ids.get('back-project').events.click();assert(!ids.get('project-dialog').classList.contains('document-mode'));
 ids.get('project-dialog').close();
}
const link=element('a',{href:'assets/catalan-poster.pdf',download:'poster.pdf'});link.textContent='Poster (PDF)';
const scope=element();scope.children=[link];api.connectAssets(scope);
assert(!('download' in link.attrs));let prevented=false;link.events.click({preventDefault(){prevented=true}});
assert(prevented);assert(ids.get('document-page'));assert(ids.get('project-dialog').open);
ids.get('project-dialog').close();
api.openProject('grammar');
for(let i=0;i<window.PORTFOLIO_GRAMMARS.length;i++){
 ids.get('grammar-file').value=String(i);ids.get('grammar-file').events.change();
 assert.equal(ids.get('grammar-code').textContent,window.PORTFOLIO_GRAMMARS[i].source);
}

const html=fs.readFileSync(path.join(dist,'index.html'),'utf8');
assert(html.trimEnd().endsWith('</html>'));
assert(!html.includes('PORTFOLIO_ASSETS'));
for(const m of html.matchAll(/(?:src|href)="([^"#]+)"/g)) {
 if(!/^(https?:|mailto:)/.test(m[1])) assert(fs.existsSync(path.join(dist,m[1])),m[1]);
}
assert(html.includes('Operations Research and Semantics'));
console.log('PASS: 11 project windows, 19 PDF pages, PDF navigation/zoom, Dyck paths, ACG source selection, and local asset references.');
