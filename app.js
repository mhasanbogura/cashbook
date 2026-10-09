/* Cashbook Web v1.0 — same auth/style pattern as messmanager/metermanager */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const CATS={in:['Sales','Service','Salary','Gift','Loan In','Other Income'],
  out:['Food','Transport','Shopping','Bills','Rent','Health','Education','Salary Paid','Loan Out','Other']};
const state={user:null,txs:{},filter:'all',search:'',monthKey:monthKey(new Date()),editId:null,entryType:'out',demo:false};
function monthKey(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')}
function fmtMonth(k){const[y,m]=k.split('-').map(Number);return new Date(y,m-1,1).toLocaleDateString('en-US',{month:'short',year:'numeric'})}
function fmtDate(ds){const d=new Date(ds+'T12:00:00');const t=new Date();t.setHours(0,0,0,0);
  const x=new Date(ds+'T12:00:00');const diff=Math.round((t-x)/86400000);
  if(diff===0)return'Today';if(diff===1)return'Yesterday';return d.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}
const fmtTaka=n=>'৳ '+Number(n||0).toLocaleString('en-US');
/* ---------- UI helpers ---------- */
function toast(msg,type){type=type||'info';const c=$('toast-container');const el=document.createElement('div');
  el.className='toast '+type;el.textContent=msg;c.appendChild(el);setTimeout(()=>{el.style.opacity='0';setTimeout(()=>el.remove(),300)},2600)}
function showScreen(id){document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));$(id).classList.add('active');
  window.scrollTo(0,0);if(id==='app-screen'){$('splash-screen').classList.add('hidden')}}
function navigate(page){document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  $('page-'+page).classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.page===page));
  $('fab-add').style.display=(page==='home')?'flex':'none';
  $('page-title').textContent={home:'Cashbook',add:state.editId?'Edit Entry':'Add Entry',reports:'Reports',settings:'Settings'}[page];
  window.scrollTo(0,0)}
function confirmDlg(title,bodyHTML,onYes,yesLabel){$('dlgTitle').textContent=title;$('dlgBody').innerHTML=bodyHTML;
  const A=$('dlgActions');A.innerHTML='';
  const no=document.createElement('button');no.className='btn secondary';no.textContent='Cancel';no.onclick=closeDlg;
  const yes=document.createElement('button');yes.className='btn danger';yes.textContent=yesLabel||'Delete';yes.onclick=()=>{closeDlg();onYes()};
  A.append(no,yes);$('dlg').hidden=false}
function closeDlg(){$('dlg').hidden=true}
/* ---------- theme ---------- */
function applyTheme(){const dark=$('set-dark').checked;$('set-oled').disabled=!dark;
  const oled=dark&&$('set-oled').checked;
  document.documentElement.dataset.theme=!dark?'light':(oled?'oled':'dark');
  try{localStorage.setItem('cb-theme',JSON.stringify({dark,oled}))}catch(e){}}
(function initTheme(){try{const t=JSON.parse(localStorage.getItem('cb-theme')||'null');
  if(t){$('set-dark').checked=t.dark!==false;$('set-oled').checked=t.oled!==false}}catch(e){}
  applyTheme();$('set-dark').onchange=applyTheme;$('set-oled').onchange=applyTheme})();
/* ---------- auth nav ---------- */
$('show-login-btn').onclick=()=>showScreen('auth-login-screen');
$('show-register-welcome').onclick=()=>showScreen('auth-register-screen');
$('show-register-login').onclick=()=>showScreen('auth-register-screen');
$('back-to-login-login').onclick=()=>showScreen('auth-login-screen');
$('back-to-welcome-login').onclick=()=>showScreen('auth-screen');
$('back-to-login-forgot').onclick=()=>showScreen('auth-login-screen');
$('forgot-password-link').onclick=()=>showScreen('forgot-screen');
$('login-btn').onclick=doLogin;$('register-btn').onclick=doRegister;$('send-reset-btn').onclick=doReset;
const googleProvider=()=>new firebase.auth.GoogleAuthProvider();
function firebaseReady(){return(typeof firebase!=='undefined'&&firebase.apps&&firebase.apps.length)}
['google-login-welcome','google-login-email','google-register'].forEach(id=>{
  $(id).onclick=()=>{if(!firebaseReady())return enterDemo('Firebase not configured yet — demo mode.');
    firebase.auth().signInWithPopup(googleProvider()).catch(e=>toast(e.message,'error'))}});
function doLogin(){const e=$('login-email').value.trim(),p=$('login-password').value;
  if(!e||!p)return toast('Enter email & password','error');
  if(!firebaseReady())return enterDemo('Firebase not configured yet — demo mode.');
  firebase.auth().signInWithEmailAndPassword(e,p).catch(err=>toast(err.message,'error'))}
function doRegister(){const n=$('reg-name').value.trim(),e=$('reg-email').value.trim(),p=$('reg-password').value;
  if(!n)return toast('Enter your name','error');if(p.length<6)return toast('Password min 6 chars','error');
  if(!firebaseReady())return enterDemo('Firebase not configured yet — demo mode.');
  firebase.auth().createUserWithEmailAndPassword(e,p).then(c=>c.user.updateProfile({displayName:n})).catch(err=>toast(err.message,'error'))}
function doReset(){const e=$('reset-email').value.trim();if(!e)return toast('Enter email','error');
  if(!firebaseReady())return toast('Firebase not configured','error');
  firebase.auth().sendPasswordResetEmail(e).then(()=>toast('Reset link sent','success')).catch(err=>toast(err.message,'error'))}
$('btn-logout').onclick=()=>{if(state.demo)return logoutDemo();if(firebaseReady())firebase.auth().signOut()};
$('btn-reset-link').onclick=()=>{if(!state.user||!state.user.email)return toast('No email on account','error');
  firebase.auth().sendPasswordResetEmail(state.user.email).then(()=>toast('Reset link sent','success')).catch(e=>toast(e.message,'error'))};
$('btn-delete').onclick=()=>confirmDlg('Delete account?','<p>This deletes your login <b>and all cashbook data</b>. This cannot be undone.</p>',()=>{
  const uid=state.user&&state.user.uid;
  const wipe=()=>{if(uid&&firebaseReady())firebase.database().ref('cashbook/'+uid).remove()};
  if(state.demo){localStorage.removeItem('cb-demo-txs');location.reload();return}
  wipe();if(firebaseReady())firebase.auth().currentUser.delete()
    .then(()=>toast('Account deleted','success')).catch(e=>toast(e.message+' (data wiped, please re-login to retry)','error'))},'Delete all');
/* demo fallback (works before Firebase keys are pasted) */
function enterDemo(msg){state.demo=true;state.user={uid:'demo',displayName:'Demo User',email:'demo@local'};
  try{state.txs=JSON.parse(localStorage.getItem('cb-demo-txs')||'{}')}catch(e){state.txs={}}
  afterLogin();toast(msg||'Demo mode — add Firebase keys to sync','info')}
function logoutDemo(){state.demo=false;state.user=null;showScreen('auth-screen')}
/* ---------- boot ---------- */
window.addEventListener('online',()=>{$('offline-warning').style.display='none'});
window.addEventListener('offline',()=>{$('offline-warning').style.display='flex'});
if(!navigator.onLine)$('offline-warning').style.display='flex';
setTimeout(()=>{ // splash timeout
  if(!firebaseReady()){showScreen('auth-screen');$('splash-screen').classList.add('hidden');enterDemoSilent()}
  },4000);
function enterDemoSilent(){/* stay on auth until user acts */}
if(firebaseReady()){
  firebase.auth().onAuthStateChanged(u=>{
    if(u){state.demo=false;state.user=u;afterLogin();subscribe()}
    else{showScreen('auth-screen');$('splash-screen').classList.add('hidden')}
  });
  setTimeout(()=>{if(!state.user){$('splash-screen').classList.add('hidden');
    if(!$('auth-screen').classList.contains('active')&&!$('auth-login-screen').classList.contains('active'))showScreen('auth-screen')}},3500);
}else{showScreen('auth-screen');$('splash-screen').classList.add('hidden')}
function afterLogin(){showScreen('app-screen');navigate('home');
  const name=state.user.displayName||(state.user.email||'User').split('@')[0];
  $('prof-name').textContent=name;$('prof-email').textContent=state.user.email||'demo mode';
  $('prof-avatar').textContent=(name[0]||'C').toUpperCase();
  $('f-date').value=new Date().toISOString().slice(0,10);
  renderCats();render()}
function subscribe(){const ref=firebase.database().ref('cashbook/'+state.user.uid+'/transactions');
  ref.on('value',snap=>{state.txs=snap.val()||{};render()});
  ref.on('cancel',()=>toast('Database permission denied — check RTDB rules','error'))}
/* ---------- entry form ---------- */
function renderCats(){const row=$('cat-row');row.innerHTML='';
  CATS[state.entryType].forEach((c,i)=>{const b=document.createElement('button');b.className='chip'+(i===0?' active':'');
    b.textContent=c;b.onclick=()=>{row.querySelectorAll('.chip').forEach(x=>x.classList.remove('active'));b.classList.add('active')};row.appendChild(b)})}
function setType(t){state.entryType=t;$('type-in').classList.toggle('active',t==='in');$('type-out').classList.toggle('active',t==='out');renderCats()}
$('type-in').onclick=()=>setType('in');$('type-out').onclick=()=>setType('out');
$('cancel-edit-btn').onclick=()=>{state.editId=null;$('cancel-edit-btn').style.display='none';$('save-tx-btn').textContent='Save Entry';navigate('home')};
$('save-tx-btn').onclick=saveTx;
function selectedCat(){const a=$('cat-row').querySelector('.chip.active');return a?a.textContent:CATS[state.entryType][0]}
function saveTx(){const amt=parseFloat($('f-amount').value);
  if(!(amt>0))return toast('Enter a valid amount','error');
  const tx={type:state.entryType,amount:Math.round(amt*100)/100,category:selectedCat(),
    note:$('f-note').value.trim(),method:$('f-method').value,date:$('f-date').value||new Date().toISOString().slice(0,10),
    createdAt:Date.now()};
  if(state.demo){if(state.editId){state.txs[state.editId]=tx}else{state.txs['d'+Date.now()]=tx}
    try{localStorage.setItem('cb-demo-txs',JSON.stringify(state.txs))}catch(e){}
    afterSave();return}
  if(!firebaseReady()||!state.user)return toast('Not signed in','error');
  const base=firebase.database().ref('cashbook/'+state.user.uid+'/transactions');
  const done=()=>afterSave();
  if(state.editId)base.child(state.editId).set(tx).then(done).catch(e=>toast(e.message,'error'));
  else base.push(tx).then(done).catch(e=>toast(e.message,'error'))}
function afterSave(){toast(state.editId?'Entry updated':'Entry saved','success');
  state.editId=null;$('cancel-edit-btn').style.display='none';$('save-tx-btn').textContent='Save Entry';
  $('f-amount').value='';$('f-note').value='';navigate('home');render()}
function editTx(id){const t=state.txs[id];if(!t)return;state.editId=id;setType(t.type);
  $('f-amount').value=t.amount;$('f-note').value=t.note||'';$('f-method').value=t.method||'Cash';$('f-date').value=t.date;
  [...$('cat-row').children].forEach(c=>c.classList.toggle('active',c.textContent===t.category));
  $('save-tx-btn').textContent='Update Entry';$('cancel-edit-btn').style.display='block';
  $('page-sub').textContent='Edit entry';navigate('add')}
function delTx(id){confirmDlg('Delete entry?','<p>Remove this transaction permanently?</p>',()=>{
  if(state.demo){delete state.txs[id];try{localStorage.setItem('cb-demo-txs',JSON.stringify(state.txs))}catch(e){}render();return}
  firebase.database().ref('cashbook/'+state.user.uid+'/transactions/'+id).remove().then(()=>toast('Deleted','success'))})}
/* ---------- list / dashboard ---------- */
document.querySelectorAll('.filter-btn').forEach(b=>b.onclick=()=>{state.filter=b.dataset.filter;
  document.querySelectorAll('.filter-btn').forEach(x=>x.classList.toggle('active',x===b));render()});
$('search-input').oninput=e=>{state.search=e.target.value.toLowerCase();render()};
$('month-pick').onclick=()=>{const m=$('month-hidden');m.value=state.monthKey;
  m.onchange=()=>{if(m.value)state.monthKey=m.value;render()};m.showPicker?m.showPicker():m.focus()};
$('btn-refresh').onclick=()=>render();
function monthTxs(){return Object.entries(state.txs).filter(([,t])=>(t.date||'').slice(0,7)===state.monthKey)}
function render(){if(!state.user)return;
  $('dash-month').textContent=fmtMonth(state.monthKey);$('page-sub').textContent=fmtMonth(state.monthKey);
  const mtx=monthTxs();
  let tin=0,tout=0;mtx.forEach(([,t])=>{if(t.type==='in')tin+=+t.amount||0;else tout+=+t.amount||0});
  $('dash-in').textContent=fmtTaka(tin);$('dash-out').textContent=fmtTaka(tout);
  const bal=tin-tout;$('dash-balance').textContent=fmtTaka(bal);
  // list
  let rows=mtx.filter(([,t])=>state.filter==='all'||t.type===state.filter);
  if(state.search)rows=rows.filter(([,t])=>((t.note||'')+' '+(t.category||'')).toLowerCase().includes(state.search));
  rows.sort((a,b)=>(b[1].date||'').localeCompare(a[1].date||'')||((b[1].createdAt||0)-(a[1].createdAt||0)));
  const box=$('tx-list');box.innerHTML='';
  if(!rows.length){box.innerHTML='<div class="empty">No entries this month.<br>Tap + Add to record cash in / out.</div>'}
  let lastDay='';
  rows.forEach(([id,t])=>{if(t.date!==lastDay){lastDay=t.date;
      const g=document.createElement('div');g.className='day-group';
      const dayTxs=rows.filter(([,x])=>x.date===lastDay);
      let dIn=0,dOut=0;dayTxs.forEach(([,x])=>x.type==='in'?dIn+=+x.amount:dOut+=+x.amount);
      g.innerHTML='<div class="day-head"><span>'+fmtDate(lastDay)+'</span><span>In '+fmtTaka(dIn)+' • Out '+fmtTaka(dOut)+'</span></div>';
      g.id='g-'+lastDay;box.appendChild(g)}
    const el=document.createElement('div');el.className='tx';
    el.innerHTML='<div class="tx-ic '+t.type+'"><span class="material-icons-round">'+(t.type==='in'?'arrow_downward':'arrow_upward')+'</span></div>'+
      '<div class="tx-mid"><strong>'+esc(t.category||(t.type==='in'?'Cash In':'Cash Out'))+'</strong><small>'+esc(t.note||t.method||'')+' • '+esc(t.method||'')+'</small></div>'+
      '<div class="tx-amt '+t.type+'">'+(t.type==='in'?'+':'−')+' '+fmtTaka(t.amount)+'</div>';
    const menu=document.createElement('button');menu.className='tx-menu';
    menu.innerHTML='<span class="material-icons-round">more_vert</span>';
    menu.onclick=()=>txMenu(id);el.appendChild(menu);
    ($('g-'+CSS.escape(lastDay))||box).appendChild(el)});
  renderReports(mtx,tin,tout)}
function esc(s){return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function txMenu(id){const o=$('modal-overlay');$('modal-title').textContent='Entry options';
  $('modal-body').innerHTML='<p style="color:var(--sub);font-size:13px">Edit or delete this transaction.</p>';
  const F=$('modal-footer');F.innerHTML='';
  const e=document.createElement('button');e.className='btn-cancel';e.textContent='Edit';e.onclick=()=>{o.classList.remove('active');editTx(id)};
  const d=document.createElement('button');d.className='btn-danger';d.textContent='Delete';d.onclick=()=>{o.classList.remove('active');delTx(id)};
  const c=document.createElement('button');c.className='btn-cancel';c.textContent='Close';c.onclick=()=>o.classList.remove('active');
  F.append(e,d,c);o.classList.add('active');o.onclick=ev=>{if(ev.target===o)o.classList.remove('active')}}
/* ---------- reports ---------- */
function renderReports(mtx,tin,tout){
  $('report-month').innerHTML='<div class="rrow"><span>Cash In</span><strong style="color:var(--green)">'+fmtTaka(tin)+'</strong></div>'+
    '<div class="rrow"><span>Cash Out</span><strong style="color:var(--danger)">'+fmtTaka(tout)+'</strong></div>'+
    '<div class="rrow"><span>Net</span><strong>'+fmtTaka(tin-tout)+'</strong></div>'+
    '<div class="rrow"><span>Entries</span><strong>'+mtx.length+'</strong></div>';
  const byCat={};mtx.forEach(([,t])=>{const k=(t.type==='out'?'− ':'+ ')+(t.category||'Other');
    byCat[k]=(byCat[k]||0)+(+t.amount||0)});
  const top=Object.entries(byCat).sort((a,b)=>b[1]-a[1]).slice(0,6);
  const max=top.length?top[0][1]:1;
  $('report-cats').innerHTML=top.length?top.map(([k,v])=>'<div class="bar-row"><span class="bar-name">'+esc(k)+'</span>'+
    '<div class="bar-track"><div class="bar-fill'+(k[0]==='−'?' out':'')+'" style="width:'+Math.round(v/max*100)+'%"></div></div>'+
    '<span class="bar-amt">'+fmtTaka(v)+'</span></div>').join(''):'<div class="empty">No data</div>';
  const hist=[];const[y,m]=state.monthKey.split('-').map(Number);
  for(let i=5;i>=0;i--){const d=new Date(y,m-1-i,1);const k=monthKey(d);let hi=0,ho=0;
    Object.values(state.txs).forEach(t=>{if((t.date||'').slice(0,7)===k){t.type==='in'?hi+=+t.amount||0:ho+=+t.amount||0}});
    hist.push({k,label:d.toLocaleDateString('en-US',{month:'short'}),net:hi-ho})}
  const mx=Math.max(1,...hist.map(h=>Math.abs(h.net)));
  $('report-history').innerHTML=hist.map(h=>'<div class="bar-row"><span class="bar-name">'+h.label+'</span>'+
    '<div class="bar-track"><div class="bar-fill'+(h.net<0?' out':'')+'" style="width:'+Math.round(Math.abs(h.net)/mx*100)+'%"></div></div>'+
    '<span class="bar-amt">'+fmtTaka(h.net)+'</span></div>').join('')}
/* ---------- export ---------- */
function exportCSV(){const rows=[['date','type','category','note','method','amount']];
  Object.values(state.txs).sort((a,b)=>(a.date||'').localeCompare(b.date||'')).forEach(t=>
    rows.push([t.date,t.type,t.category,'"'+(t.note||'').replace(/"/g,'""')+'"',t.method,t.amount]));
  const blob=new Blob([rows.map(r=>r.join(',')).join('\n')],{type:'text/csv'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);
  a.download='cashbook-'+state.monthKey+'.csv';a.click();toast('CSV exported','success')}
$('btn-export').onclick=exportCSV;$('btn-export2').onclick=exportCSV;
/* ---------- nav ---------- */
document.querySelectorAll('.nav-btn').forEach(b=>b.onclick=()=>navigate(b.dataset.page));
$('fab-add').onclick=()=>{state.editId=null;$('save-tx-btn').textContent='Save Entry';
  $('cancel-edit-btn').style.display='none';$('f-amount').value='';$('f-note').value='';navigate('add')};
$('dlg').addEventListener('click',e=>{if(e.target.id==='dlg')closeDlg()});
setType('out');
})();
