/* Execute the actual frontend against archived data with a minimal DOM.
 * This checks scene/API wiring and rendered evidence, not browser layout. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),bundle=JSON.parse(fs.readFileSync(path.join(root,'data/replays.json'),'utf8'));
const elements=new Map(),events=new Map();
function element(key){if(!elements.has(key))elements.set(key,{innerHTML:'',textContent:'',dataset:{},classList:{toggle(){}},addEventListener(type,fn){events.set(key+':'+type,fn);},showModal(){this.open=true;},close(){this.open=false;}});return elements.get(key);}
const document={querySelector:element,querySelectorAll:()=>[],addEventListener(type,fn){events.set('document:'+type,fn);},documentElement:{dataset:{}},body:{classList:{toggle(){}}},title:''};
const calls=[];
async function fetchMock(url){
 calls.push(url);const u=new URL(url,'http://127.0.0.1');let d;
 if(u.pathname==='/api/studies')d={models:bundle.models,cv:bundle.cv.stats,limits:bundle.limits,provenance:bundle.provenance};
 else if(u.pathname==='/api/catalog')d={models:bundle.models,cv_records:Object.entries(bundle.cv.records).map(([id,r])=>({id,stratum:r.stratum}))};
 else if(u.pathname==='/api/cv/replay'){
  const q=Object.fromEntries(u.searchParams),notes=new Set([q.condition,'clean','neutral']);
  d={record:bundle.cv.records[q.record],note:bundle.cv.notes[q.condition],rows:bundle.cv.cells.filter(x=>x.record_id===q.record&&x.model===q.model&&x.frame===q.frame&&notes.has(x.condition))};
 }else throw Error('Unexpected API '+url);
 return {ok:true,json:async()=>d};
}
const window={dispatchEvent(){}};
const context=vm.createContext({document,window,location:{search:''},fetch:fetchMock,URLSearchParams,CustomEvent:function(name,options){this.name=name;this.detail=options.detail;},requestAnimationFrame:fn=>fn(),console});
vm.runInContext(fs.readFileSync(path.join(root,'dist/app.js'),'utf8'),context,{filename:'app.js'});
(async()=>{
 await window.researchDemo.ready;
 const expected={'cv-clean':[50,0],'cv-direct':[100,100],'cv-warning':[75,0],'cv-neutral':[60,0],'cv-forged':[80,0]};
 for(const [scene,scores] of Object.entries(expected)){
  await window.researchDemo.setScene(scene);const html=element('#content').innerHTML;
  for(const score of scores)assert(html.includes('class="score-value">'+score+'<small>'));
  assert(html.includes('Inspect exact recorded output and request IDs'));
  assert(html.includes('&quot;request&quot;'));assert(html.includes('&quot;response&quot;'));
 }
 await window.researchDemo.setScene('cv-findings');assert(element('#content').innerHTML.includes('+24.875'));
 await window.researchDemo.setScene('limitations');assert(element('#content').innerHTML.includes('synthetic'));
 await window.researchDemo.setScene('cv-clean',{record:'H09',frame:'json',condition:'response_template'});
 assert.equal(window.researchDemo.getState().record,'H09');assert(element('#content').innerHTML.includes('H09'));
 events.get('#provenance-button:click')();assert(element('#provenance-content').innerHTML.includes('81a0f6b1'));
 assert.equal(vm.runInContext('esc("<script>\\\"&")',context),'&lt;script&gt;&quot;&amp;');
 assert(calls.every(x=>!x.includes('/agent')&&!x.includes('/gate')&&!x.includes('/studio')));
 console.log(JSON.stringify({status:'PASS',scenes:window.researchDemo.scenes.length,selected_scene_score_pairs:expected,additional_record:'H09',new_model_calls:0,scope:'mocked DOM scene/API integration; no browser layout claim'}));
})().catch(e=>{console.error(e);process.exitCode=1;});
