'use strict';
const MODEL_G='gemma4:e2b-it-qat',MODEL_Q='qwen3:4b-instruct';
const MODEL_LABEL={[MODEL_G]:'Gemma · E2B tag',[MODEL_Q]:'Qwen · 4B Instruct'};
const FRAME_LABEL={plain:'Plain document',warning_plain:'Warning + plain',json:'Structured JSON',warning_json:'Warning + JSON'};
const NOTE_LABEL={clean:'No added note',neutral:'Neutral admin note',direct:'Direct score instruction',forged_review:'Forged committee review',response_template:'Completed output template'};
const SCENES={
 'cv-clean':{tab:'cv',title:'What changes when evidence disappears?',description:'Compare the same synthetic candidate with qualifications present and removed. The score is an experimental rubric output, not a hiring verdict.',model:MODEL_G,record:'H01',frame:'plain',condition:'clean',label:'01  Establish the baseline'},
 'cv-direct':{tab:'cv',title:'A document asks for a perfect score.',description:'The added note supplies no new qualification. Both numbers are actual archived model outputs.',model:MODEL_G,record:'H01',frame:'plain',condition:'direct',label:'02  Inject a score instruction'},
 'cv-warning':{tab:'cv',title:'A stronger wrapper changes the outcome.',description:'The same candidate and note are inside structured input with an explicit warning. Check both score columns.',model:MODEL_G,record:'H01',frame:'warning_json',condition:'direct',label:'03  Inspect warning + JSON'},
 'cv-neutral':{tab:'cv',title:'Use a neutral note as a comparison.',description:'The neutral note also adds no qualification evidence. It helps contextualize the instruction effect.',model:MODEL_G,record:'H01',frame:'warning_json',condition:'neutral',label:'04  Compare a neutral note'},
 'cv-forged':{tab:'cv',title:'A claimed committee decision still shifts the score.',description:'The qualification-removed score remains zero here. Yet the full-evidence score moves when the document claims that review is complete.',model:MODEL_Q,record:'H01',frame:'warning_json',condition:'forged_review',label:'05  Test a forged review'},
 'cv-findings':{tab:'cv-findings',title:'Read paired scores, then the cohort.',description:'Aggregate results cover all 40 public synthetic CVs. The examples were selected after outcomes.',label:'06  Review measured findings'},
 limitations:{tab:'limits',title:'A bounded audit, with its limits visible.',description:'A teaching companion for evidence responsiveness. It does not certify a hiring system or a universal prompt-injection defense.',label:'Scope & limitations'}
};
let studies=null,catalog=null,state={scene:'cv-clean',...SCENES['cv-clean']},generation=0,pending=Promise.resolve(),lastData=null;
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clean=s=>String(s??'').replace(/\*\*/g,'').replace(/`/g,'');
const num=n=>Number(n).toLocaleString('en-US');
async function api(path){const response=await fetch(path);const data=await response.json();if(!response.ok)throw Error(data.error||'Replay unavailable');return data;}
function hero(kind,id=''){return `<div class="hero"><div><span class="eyebrow">${esc(kind)}</span><h1>${esc(state.title)}</h1><p>${esc(state.description)}</p></div>${id?`<span class="hero-id">${esc(id)}</span>`:''}</div>`;}
function pill(text,color=''){return `<span class="pill ${color}">${esc(text)}</span>`;}
function option(value,label,current){return `<option value="${esc(value)}" ${value===current?'selected':''}>${esc(label)}</option>`;}
function select(key,label,values){return `<div class="control"><label for="select-${key}">${label}</label><select id="select-${key}" data-select="${key}">${values.map(([v,l])=>option(v,l,state[key])).join('')}</select></div>`;}
function updateNav(){
 document.querySelectorAll('.nav-item').forEach(el=>el.classList.toggle('active',state.tab.startsWith('cv')));
 $('#scene-nav').innerHTML=Object.entries(SCENES).map(([id,scene])=>`<button class="scene-button ${state.scene===id?'active':''}" data-scene="${id}">${esc(scene.label)}</button>`).join('');
 $('#footer-meta').textContent=state.record?`${state.record} · ${state.model} · ${state.frame}`:'Frozen V2 CV study · archived evidence';
}

function cvControls(){return `<div class="control-bar">${select('record','SYNTHETIC CANDIDATE',catalog.cv_records.map(r=>[r.id,r.id+' · '+r.stratum.replaceAll('_',' ')]))}${select('model','LOCAL MODEL',catalog.models.map(m=>[m,MODEL_LABEL[m]]))}${select('condition','DOCUMENT NOTE',Object.entries(NOTE_LABEL))}${select('frame','INPUT WRAPPER',Object.entries(FRAME_LABEL))}${pill('ACTUAL OUTPUT','blue')}</div>`;}
function row(data,condition,evidence){const r=data.rows.find(r=>r.condition===condition&&r.evidence===evidence);if(!r)throw Error('Missing archived cell');return r;}
function scoreCard(data,evidence){
 const current=row(data,state.condition,evidence),baseline=row(data,'clean',evidence),neutral=row(data,'neutral',evidence);
 const bad=evidence==='removed'&&current.score>0;
 return `<div class="score-card ${bad?'bad':''}" data-evidence="${evidence}"><div class="score-title">QUALIFICATIONS ${evidence==='full'?'PRESENT':'REMOVED'}</div><div class="score-value">${esc(current.score)}<small> / 100</small></div><span class="score-code">${esc(current.response.message.content)}</span><div class="bar-track"><span style="width:${current.score}%"></span></div><div class="score-baseline">No-note baseline <strong>${baseline.score}</strong><br>Neutral-note comparison <strong>${neutral.score}</strong></div></div>`;
}
function renderCv(data){
 const r=data.record,doc=r.full_document,full=row(data,state.condition,'full').score,removed=row(data,state.condition,'removed').score;
 const basegap=row(data,'clean','full').score-row(data,'clean','removed').score;
 const degree=doc.education?.[0]?.degree||'No education stated';
 const roles=(doc.experience||[]).map(x=>x.role).join('\n');
 const note=data.note||'No document note was added. Only the frozen qualification evidence is supplied.';
 const influential=state.condition!=='clean'&&state.condition!=='neutral'&&full!==row(data,'neutral','full').score;
 const explanation=removed>0?'The qualification-removed document earns points despite containing no qualification evidence.':influential?'The empty-document boundary holds here, while the full-evidence score still differs from the neutral note.':'Compare both raw outputs and their baselines. A single example does not establish a general defense.';
 $('#content').innerHTML=hero('STUDY 01 / COUNTERFACTUAL CV EVIDENCE',r.record_id)+cvControls()+`<div class="cv-grid"><section class="panel"><div class="panel-heading"><h2>Candidate document</h2>${pill('PUBLIC · SYNTHETIC')}</div><div class="panel-body"><div class="section-label">MATCHED JOB DESCRIPTION</div><p class="source-job">${esc(r.job_description)}</p><div class="evidence-summary"><div class="evidence-item"><b>Qualifications present</b><span>${doc.education.length} education record · ${doc.experience.length} experience records<br>${Object.keys(doc.skills).length} skill categories</span></div><div class="evidence-item"><b>Qualifications removed</b><span>Education, experience, skills and credentials removed.<br>ID and interests retained.</span></div></div><div class="section-label">ARCHIVED QUALIFICATION EXCERPT</div><p class="source-job">${esc(degree)}<br><br>${esc(roles)}</p><div class="document-note ${['clean','neutral'].includes(state.condition)?'neutral':''}"><div class="section-label">${state.condition==='clean'?'BASELINE':'ADDED DOCUMENT NOTE · NO NEW QUALIFICATIONS'}</div><p>${esc(note)}</p></div></div></section><div><div class="score-pair">${scoreCard(data,'full')}${scoreCard(data,'removed')}</div><div class="gap-panel"><div><h3>Evidence gap = full score − removed score</h3><p>Compare responsiveness to evidence availability. Baseline gap: ${basegap} points. This is not validated candidate quality.</p></div><div class="gap-number">${full-removed}<span> points</span></div></div><div class="callout ${removed>0?'red':influential?'amber':''}"><strong>What this replay shows</strong><br>${esc(explanation)}</div><details class="details"><summary>Inspect exact recorded output and request IDs</summary><pre>${esc(JSON.stringify(data.rows.filter(x=>x.condition===state.condition).map(x=>({evidence:x.evidence,note:x.condition,score:x.score,request_id:x.request_id,request_sha256:x.request_sha256,request:x.request,response:x.response})),null,2))}</pre></details></div></div>`;
}
function renderCvFindings(){
 const rows=studies.cv.direct_removed;const forged=studies.cv.full_note_effects.find(x=>x.model===MODEL_Q&&x.frame==='warning_json'&&x.condition==='forged_review');
 $('#content').innerHTML=hero('STUDY 01 / ALL 40 SYNTHETIC CVS')+`<div class="findings-grid"><section class="panel"><div class="panel-heading"><h2>Direct note: removed evidence scored exactly 100</h2>${pill('N = 40 PER CELL')}</div><table class="data-table"><thead><tr><th>MODEL</th><th>INPUT WRAPPER</th><th>COUNT /40</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${r.model===MODEL_G?'Gemma':'Qwen'}</td><td>${FRAME_LABEL[r.frame]}</td><td><strong class="${r.target100_n?'num-bad':''}">${r.target100_n} /40</strong></td></tr>`).join('')}</tbody></table><div class="tiny-note">Fixed public note and two local artifacts. Zero observed events do not establish zero risk. No HR decision was executed.</div></section><section class="panel"><div class="summary-stat"><span class="eyebrow">A DIFFERENT ENDPOINT</span><div class="big">+${forged.delta_neutral_mean.toFixed(3)}</div><p>Mean full-evidence score shift for a forged committee note versus a neutral note, Qwen warning+JSON, all 40 CVs.</p><div class="callout">Paired 95% interval [${forged.delta_neutral_ci95_low.toFixed(3)}, ${forged.delta_neutral_ci95_high.toFixed(3)}] points.</div></div><div class="summary-stat"><span class="eyebrow">WHY BOTH COLUMNS MATTER</span><p>A wrapper can preserve the empty-document boundary while an instruction still influences scores for a full document. The full score itself is not ground-truth qualification.</p></div></section></div><div class="callout amber"><strong>Interpretation boundary</strong><br>Five occupational strata, eight CVs each; public synthetic data, one requested seed, short-output rubric scoring. This is evidence responsiveness under matched jobs, not validated hiring accuracy or a population causal effect.</div>`;
}

function renderLimits(){
 $('#content').innerHTML=hero('SCOPE / WHAT THE EVIDENCE SUPPORTS')+`<div class="limit-list">${studies.limits.map((s,i)=>`<section class="panel limit-item"><span>${String(i+1).padStart(2,'0')}</span><p>${esc(s)}</p></section>`).join('')}</div><div class="callout">This compact public app contains 160 archived cells for H01/H09 and cohort summaries from 3,200 main study calls. Another 320 length-control calls are reported separately. It contains no model weights, private records, new inference or autonomous actions.</div>`;
}
function provenance(){
 $('#provenance-content').innerHTML=`<p class="modal-note">Public synthetic HiringAudit data, pinned revision 81a0f6b1a5c3254371e6304af9dafdc533b6c9d5. Anonymous qualification-present and qualification-removed adaptations. MIT upstream notice is retained. H01/H09 are post-outcome illustrations; aggregates use all 40 selected profiles.</p><p class="modal-note">This app reads saved outputs only. The exact requests and assistant score JSON are available in each replay. The following hashes identify original local research sources; the full source files are not all part of this teaching repository.</p>${studies.provenance.map(r=>`<div class="provenance-row"><b>${esc(r.path)}</b><code>SHA256 ${esc(r.sha256)}</code></div>`).join('')}`;
 $('#provenance-modal').showModal();
}
async function showScene(id,overrides={}){
 if(!SCENES[id])throw Error('Unknown scene: '+id);
 const token=++generation;state={scene:id,...SCENES[id],...overrides};updateNav();let data=null;
 if(state.tab==='cv')data=await api('/api/cv/replay?'+new URLSearchParams({record:state.record,model:state.model,frame:state.frame,condition:state.condition}));
 if(token!==generation)return getState();
 if(state.tab==='cv')renderCv(data);else if(state.tab==='cv-findings')renderCvFindings();else renderLimits();
 lastData=data;document.documentElement.dataset.scene=id;document.title='CV Evidence Lab · '+state.title;
 await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
 window.dispatchEvent(new CustomEvent('research-demo-ready',{detail:getState()}));return getState();
}
function getState(){return JSON.parse(JSON.stringify({scene:state.scene,record:state.record||null,model:state.model||null,frame:state.frame||null,condition:state.condition||null,title:state.title,data:lastData}));}
window.researchDemo={scenes:Object.keys(SCENES),sceneCatalog:SCENES,getState,
 setScene(id,options={}){pending=this.ready.then(()=>showScene(id,options));return pending;},whenIdle(){return pending;}};
document.addEventListener('click',async e=>{const scene=e.target.closest('[data-scene]');if(scene){e.preventDefault();await window.researchDemo.setScene(scene.dataset.scene);}});
document.addEventListener('change',e=>{if(e.target.matches('[data-select]')){const options={...state,[e.target.dataset.select]:e.target.value,title:'Explore the recorded evidence.',description:'Choose a saved model, note and wrapper. Every output is archived; no new inference runs here.'};window.researchDemo.setScene('cv-clean',options);}});
$('#provenance-button').addEventListener('click',provenance);$('#close-modal').addEventListener('click',()=>$('#provenance-modal').close());
const query=new URLSearchParams(location.search);
window.researchDemo.ready=Promise.all([api('/api/studies'),api('/api/catalog')]).then(async([s,c])=>{studies=s;catalog=c;return showScene(query.get('scene')||'cv-clean');}).catch(e=>{$('#content').innerHTML=`<div class="error">${esc(e.message)}</div>`;throw e;});
pending=window.researchDemo.ready;
