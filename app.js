/* Cashbook Web v1.1 — multi-book + editable categories */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const DEFAULT_CATS={in:['Sales','Service','Salary','Gift','Loan In','Other Income'],
  out:['Food','Transport','Shopping','Bills','Rent','Health','Education','Salary Paid','Loan Out','Other']};
const state={user:null,demo:false,books:{},current:null,filter:'all',search:'',sort:'desc',bookSearch:'',
  monthKey:monthKey(new Date()),editId:null,entryType:'out'};
function monthKey(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')}
function fmtMonth(k){const[y,m]=k.split('-').map(Number);return new Date(y,m-1,1).toLocaleDateString('en-US',{month:'short',year:'numeric'})}
function fmtDate(ds){const t=new Date();t.setHours(0,0,0,0);const x=new Date(ds+'T12:00:00');
  const diff=Math.round((t-x)/86400000);
  if(diff===0)return'Today';if(diff===1)return'Yesterday';
  return new Date(ds+'T12:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}
const esc=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>state.user&&state.user.uid;
const curBook=()=>state.books[state.current]||null;
const curTxs=()=>{const b=curBook();return b?(b.transactions||{}):{}};
/* ---------- helpers ---------- */
function toast(msg,type){type=type||'info';const c=$('toast-container');const el=document.createElement('div');
  el.className='toast '+type;el.textContent=msg;c.appendChild(el);setTimeout(()=>{el.style.opacity='0';setTimeout(()=>el.remove(),300)},2600)}
function showScreen(id){document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));$(id).classList.add('active');
  window.scrollTo(0,0);if(id==='app-screen')$('splash-screen').classList.add('hidden')}
function navigate(page){document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  const el=$('page-'+page);if(el)el.classList.add('active');
  document.querySelectorAll('.bottom-nav-item').forEach(b=>b.classList.toggle('active',b.dataset.page===page));
  $('home-actions').classList.toggle('show',page==='home');
  $('page-title').textContent={home:'Cashbook',books:'My Books',filters:'Filters',add:state.editId?'Edit Entry':'Add Entry',reports:'Reports',settings:'Settings'}[page]||'Cashbook';
  if(page==='books')renderBooks();window.scrollTo(0,0)}
function confirmDlg(title,bodyHTML,onYes,yesLabel){$('dlgTitle').textContent=title;$('dlgBody').innerHTML=bodyHTML;
  const A=$('dlgActions');A.innerHTML='';
  const no=document.createElement('button');no.className='btn secondary';no.textContent='Cancel';no.onclick=closeDlg;
  const yes=document.createElement('button');yes.className='btn danger';yes.textContent=yesLabel||'Delete';yes.onclick=()=>{closeDlg();onYes()};
  A.append(no,yes);$('dlg').hidden=false}
function closeDlg(){$('dlg').hidden=true}
function promptDlg(title,initial,onOk,okLabel){$('dlgTitle').textContent=title;
  $('dlgBody').innerHTML='<input id="dlg-input" style="width:100%;padding:12px 14px;border:1px solid var(--border);border-radius:10px;background:var(--bg);color:var(--text);font-family:inherit;font-size:15px" maxlength="40" value="'+esc(initial||'')+'">';
  const A=$('dlgActions');A.innerHTML='';
  const no=document.createElement('button');no.className='btn secondary';no.textContent='Cancel';no.onclick=closeDlg;
  const ok=document.createElement('button');ok.className='btn danger';ok.style.background='linear-gradient(135deg,#3b7bdd,#0b3d91)';
  ok.textContent=okLabel||'Save';ok.onclick=()=>{const v=$('dlg-input').value.trim();if(!v)return toast('Enter a name','error');closeDlg();onOk(v)};
  A.append(no,ok);$('dlg').hidden=false;setTimeout(()=>{const i=$('dlg-input');if(i){i.focus();i.select()}},50)}
/* ---------- theme (same as mess manager: Device + OLED) ---------- */
const sysDark=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)');
function applyTheme(){const device=$('set-device').checked;const oled=$('set-oled').checked;
  const dark=oled||(device?(sysDark?sysDark.matches:true):false);
  document.documentElement.dataset.theme=dark?'oled':'light';
  try{localStorage.setItem('cb-theme',JSON.stringify({device,oled}))}catch(e){}}
function initTheme(){try{const t=JSON.parse(localStorage.getItem('cb-theme')||'null');
  if(t){$('set-device').checked=t.device!==false;$('set-oled').checked=t.oled!==false;
    if($('set-device').checked&&$('set-oled').checked)$('set-device').checked=false}}catch(e){}
  applyTheme();
  $('set-device').onchange=()=>{if($('set-device').checked)$('set-oled').checked=false;applyTheme()};
  $('set-oled').onchange=()=>{if($('set-oled').checked)$('set-device').checked=false;applyTheme()};
  if(sysDark&&sysDark.addEventListener)sysDark.addEventListener('change',()=>{if($('set-device').checked)applyTheme()})}
initTheme();
/* ---------- currency (BDT / USD, synced per user) ---------- */
function curSym(){return state.currency==='usd'?'$':'৳'}
function fmtMoney(n){return curSym()+' '+Number(n||0).toLocaleString('en-US')}
function paintCurrency(){const c=state.currency||'bdt';const t=$('cur-toggle');if(!t)return;
  t.dataset.cur=c;t.querySelectorAll('.lt-label').forEach(l=>l.classList.toggle('active',l.dataset.cur===c));
  $('cur-symbol').textContent=curSym()}
function setCurrency(c){if(c!=='bdt'&&c!=='usd')return;state.currency=c;paintCurrency();render();
  try{localStorage.setItem('cb-cur',c)}catch(e){}
  if(!state.demo&&firebaseReady()&&uid())firebase.database().ref('cashbook/'+uid()+'/settings/currency').set(c)}
document.querySelectorAll('#cur-toggle .lt-label').forEach(l=>l.onclick=e=>{e.stopPropagation();setCurrency(l.dataset.cur)});
$('cur-toggle').onclick=()=>setCurrency(state.currency==='bdt'?'usd':'bdt');
try{const c=localStorage.getItem('cb-cur');if(c)state.currency=c}catch(e){}
state.currency=state.currency||'bdt';paintCurrency();
/* ---------- auth ---------- */
$('show-login-btn').onclick=()=>showScreen('auth-login-screen');
$('show-register-welcome').onclick=()=>showScreen('auth-register-screen');
$('show-register-login').onclick=()=>showScreen('auth-register-screen');
$('back-to-login-login').onclick=()=>showScreen('auth-login-screen');
$('back-to-welcome-login').onclick=()=>showScreen('auth-screen');
$('back-to-login-forgot').onclick=()=>showScreen('auth-login-screen');
$('forgot-password-link').onclick=()=>showScreen('forgot-screen');
$('login-btn').onclick=doLogin;$('register-btn').onclick=doRegister;$('send-reset-btn').onclick=doReset;
function firebaseReady(){return(typeof firebase!=='undefined'&&firebase.apps&&firebase.apps.length)}
['google-login-welcome','google-login-email','google-register'].forEach(id=>{
  $(id).onclick=()=>{if(!firebaseReady())return enterDemo('Firebase not configured — demo mode.');
    firebase.auth().signInWithPopup(new firebase.auth.GoogleAuthProvider()).catch(e=>toast(e.message,'error'))}});
function doLogin(){const e=$('login-email').value.trim(),p=$('login-password').value;
  if(!e||!p)return toast('Enter email & password','error');
  if(!firebaseReady())return enterDemo('Firebase not configured — demo mode.');
  firebase.auth().signInWithEmailAndPassword(e,p).catch(err=>toast(err.message,'error'))}
function doRegister(){const n=$('reg-name').value.trim(),e=$('reg-email').value.trim(),p=$('reg-password').value;
  if(!n)return toast('Enter your name','error');if(p.length<6)return toast('Password min 6 chars','error');
  if(!firebaseReady())return enterDemo('Firebase not configured — demo mode.');
  firebase.auth().createUserWithEmailAndPassword(e,p).then(c=>c.user.updateProfile({displayName:n})).catch(err=>toast(err.message,'error'))}
function doReset(){const e=$('reset-email').value.trim();if(!e)return toast('Enter email','error');
  if(!firebaseReady())return toast('Firebase not configured','error');
  firebase.auth().sendPasswordResetEmail(e).then(()=>toast('Reset link sent','success')).catch(err=>toast(err.message,'error'))}
$('btn-logout').onclick=()=>{if(state.demo)return logoutDemo();if(firebaseReady())firebase.auth().signOut()};
$('btn-reset-link').onclick=()=>{if(!state.user||!state.user.email)return toast('No email on account','error');
  firebase.auth().sendPasswordResetEmail(state.user.email).then(()=>toast('Reset link sent','success')).catch(e=>toast(e.message,'error'))};
$('btn-delete').onclick=()=>confirmDlg('Delete account?','<p>This deletes your login <b>and all books & data</b>. Cannot be undone.</p>',()=>{
  if(state.demo){localStorage.removeItem('cb-v2');location.reload();return}
  firebase.database().ref('cashbook/'+uid()).remove();
  if(firebaseReady())firebase.auth().currentUser.delete().then(()=>toast('Account deleted','success'))
    .catch(e=>toast(e.message+' (data wiped — re-login to retry)','error'))},'Delete all');
function enterDemo(msg){state.demo=true;state.user={uid:'demo',displayName:'Demo User',email:'demo@local'};
  loadDemo();afterLogin();toast(msg||'Demo mode','info')}
function logoutDemo(){state.demo=false;state.user=null;state.books={};state.current=null;showScreen('auth-screen')}
/* ---------- boot ---------- */
window.addEventListener('online',()=>{$('offline-warning').style.display='none'});
window.addEventListener('offline',()=>{$('offline-warning').style.display='flex'});
if(!navigator.onLine)$('offline-warning').style.display='flex';
setTimeout(()=>{if(!firebaseReady()&&!state.user){showScreen('auth-screen');$('splash-screen').classList.add('hidden')}},4000);
if(firebaseReady()){
  firebase.auth().onAuthStateChanged(u=>{
    if(u){state.demo=false;state.user=u;afterLogin();subscribe()}
    else{showScreen('auth-screen');$('splash-screen').classList.add('hidden')}
  });
  setTimeout(()=>{if(!state.user){$('splash-screen').classList.add('hidden');
    if(!$('auth-screen').classList.contains('active'))showScreen('auth-screen')}},3500);
}else{showScreen('auth-screen');$('splash-screen').classList.add('hidden')}
function afterLogin(){showScreen('app-screen');navigate('home');
  const name=state.user.displayName||(state.user.email||'User').split('@')[0];
  $('prof-name').textContent=name;$('prof-email').textContent=state.user.email||'demo mode';
  $('prof-avatar').textContent=(name[0]||'C').toUpperCase();
  $('f-date').value=new Date().toISOString().slice(0,10);
  if(state.demo)ensureDemoBook();
  renderCats();render()}
/* ---------- data layer ---------- */
function seedCats(){const o={};['in','out'].forEach(t=>{o[t]={};DEFAULT_CATS[t].forEach((n,i)=>{o[t]['c'+Date.now()+i]=n})});return o}
function subscribe(){const ref=firebase.database().ref('cashbook/'+uid());
  ref.on('value',snap=>{
    const val=snap.val()||{};
    let books=val.books||{};
    // migrate legacy flat transactions
    if(val.transactions&&Object.keys(val.transactions).length){
      const legacy=val.transactions;
      const ids=Object.keys(books);
      const target=ids.length?ids[0]:null;
      if(target){Object.entries(legacy).forEach(([k,v])=>{books[target].transactions=books[target].transactions||{};books[target].transactions[k]=v})}
      else{const nid='b'+Date.now();books[nid]={name:'My Book',createdAt:Date.now(),transactions:legacy,categories:seedCats()}}
      const updates={};updates['cashbook/'+uid()+'/books']=books;updates['cashbook/'+uid()+'/transactions']=null;
      if(!val.currentBook)updates['cashbook/'+uid()+'/currentBook']=Object.keys(books)[0];
      firebase.database().ref().update(updates);return;
    }
    state.books=books;
    state.current=val.currentBook||Object.keys(books)[0]||null;
    if(val.settings&&val.settings.currency)state.currency=val.settings.currency;
    paintCurrency();
    if(!Object.keys(books).length){createBook('My Book',true);return}
    if(!state.current||!books[state.current]){state.current=Object.keys(books)[0]}
    // ensure categories exist
    const b=books[state.current];
    if(b&&!b.categories){firebase.database().ref('cashbook/'+uid()+'/books/'+state.current+'/categories').set(seedCats());return}
    renderCats();render();
  });
  ref.on('cancel',()=>toast('Database permission denied — check RTDB rules','error'))}
function persistDemo(){try{localStorage.setItem('cb-v2',JSON.stringify({books:state.books,current:state.current}))}catch(e){}}
function loadDemo(){try{const d=JSON.parse(localStorage.getItem('cb-v2')||'null');
  if(d&&d.books&&Object.keys(d.books).length){state.books=d.books;state.current=d.current||Object.keys(d.books)[0];return}}catch(e){}
  state.books={};state.current=null}
function ensureDemoBook(){if(Object.keys(state.books).length)return;
  const id='b'+Date.now();state.books[id]={name:'My Book',createdAt:Date.now(),transactions:{},categories:seedCats()};
  try{const old=JSON.parse(localStorage.getItem('cb-demo-txs')||'null');
    if(old&&Object.keys(old).length){state.books[id].transactions=old;localStorage.removeItem('cb-demo-txs')}}catch(e){}
  state.current=id;persistDemo()}
function bookRef(id){return firebase.database().ref('cashbook/'+uid()+'/books/'+id)}
function createBook(name,silent){name=(name||'').trim()||'My Book';
  if(state.demo){const id='b'+Date.now();state.books[id]={name,createdAt:Date.now(),transactions:{},categories:seedCats()};
    state.current=id;persistDemo();renderCats();render();if(!silent)toast('Book created','success');return}
  const ref=firebase.database().ref('cashbook/'+uid()+'/books').push();
  ref.set({name,createdAt:Date.now(),transactions:{},categories:seedCats()}).then(()=>{
    firebase.database().ref('cashbook/'+uid()+'/currentBook').set(ref.key)}).catch(e=>toast(e.message,'error'))}
function switchBook(id){if(!state.books[id])return;state.current=id;
  if(state.demo){persistDemo()}else{firebase.database().ref('cashbook/'+uid()+'/currentBook').set(id)}
  state.editId=null;renderCats();render();navigate('home')}
function renameBook(id,name){name=(name||'').trim();if(!name)return;
  if(state.demo){state.books[id].name=name;persistDemo();render();return}
  bookRef(id).child('name').set(name).catch(e=>toast(e.message,'error'))}
function deleteBook(id){const names=Object.keys(state.books);
  if(names.length<=1)return toast('Keep at least one book','error');
  confirmDlg('Delete book?','<p>Delete <b>'+esc(state.books[id].name)+'</b> and all its entries & categories?</p>',()=>{
    if(state.demo){delete state.books[id];if(state.current===id)state.current=Object.keys(state.books)[0];
      persistDemo();renderCats();render();return}
    bookRef(id).remove().then(()=>{if(state.current===id)
      firebase.database().ref('cashbook/'+uid()+'/currentBook').set(Object.keys(state.books).filter(k=>k!==id)[0])})
      .catch(e=>toast(e.message,'error'))})}
/* ---------- categories ---------- */
function getCats(type){const b=curBook();if(!b)return[];
  const c=b.categories&&b.categories[type];if(!c)return[];
  return Object.entries(c).map(([id,name])=>({id,name}))}
function renderCats(){const row=$('cat-row');if(!row)return;row.innerHTML='';
  const cats=getCats(state.entryType);
  const list=cats.length?cats:DEFAULT_CATS[state.entryType].map((name,i)=>({id:'tmp'+i,name}));
  list.forEach((c,i)=>{const btn=document.createElement('button');btn.type='button';
    btn.className='chip'+(i===0?' active':'');btn.textContent=c.name;btn.dataset.cid=c.id;
    btn.onclick=()=>{row.querySelectorAll('.chip').forEach(x=>x.classList.remove('active'));btn.classList.add('active')};
    row.appendChild(btn)})}
function selectedCat(){const a=$('cat-row').querySelector('.chip.active');return a?a.textContent:getCats(state.entryType)[0]?.name||'Other'}
function setType(t){state.entryType=t;$('type-in').classList.toggle('active',t==='in');$('type-out').classList.toggle('active',t==='out');renderCats()}
$('type-in').onclick=()=>setType('in');$('type-out').onclick=()=>setType('out');
function openCatManager(type){
  const o=$('modal-overlay');$('modal-title').textContent=(type==='in'?'Cash In':'Cash Out')+' categories';
  const body=$('modal-body');const F=$('modal-footer');F.innerHTML='';
  function draw(){const cats=getCats(type);
    body.innerHTML=cats.map(c=>'<div class="cat-row"><span>'+esc(c.name)+'</span>'+
      '<button class="icon-mini" data-edit="'+c.id+'"><span class="material-icons-round">edit</span></button>'+
      '<button class="icon-mini danger" data-del="'+c.id+'"><span class="material-icons-round">delete</span></button></div>').join('')+
      '<div class="cat-add-row"><input id="new-cat-name" placeholder="New category" maxlength="30"><button id="add-cat-btn">Add</button></div>';
    body.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>{const c=cats.find(x=>x.id===b.dataset.edit);
      promptDlg('Rename category',c.name,v=>renameCat(type,c.id,v),'Save')});
    body.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>delCat(type,b.dataset.del));
    $('add-cat-btn').onclick=()=>{const v=$('new-cat-name').value.trim();if(!v)return toast('Enter name','error');addCat(type,v);};
    $('new-cat-name').onkeydown=e=>{if(e.key==='Enter')$('add-cat-btn').click()}}
  draw();
  // live re-draw on data change
  const close=document.createElement('button');close.className='btn-cancel';close.textContent='Done';
  close.onclick=()=>{o.classList.remove('active');renderCats();render()};F.append(close);
  o.classList.add('active');o.onclick=ev=>{if(ev.target===o){o.classList.remove('active');renderCats();render()}};
  // re-draw when snapshot changes
  openCatManager.redraw=draw}
function addCat(type,name){name=name.trim();if(!name)return;
  if(getCats(type).some(c=>c.name.toLowerCase()===name.toLowerCase()))return toast('Already exists','error');
  if(state.demo){curBook().categories[type]['c'+Date.now()]=name;persistDemo();
    if(openCatManager.redraw)openCatManager.redraw();renderCats();return}
  bookRef(state.current).child('categories/'+type).push(name).then(()=>{renderCats()}).catch(e=>toast(e.message,'error'))}
function renameCat(type,id,name){name=name.trim();if(!name)return;
  if(state.demo){curBook().categories[type][id]=name;persistDemo();
    if(openCatManager.redraw)openCatManager.redraw();renderCats();render();return}
  bookRef(state.current).child('categories/'+type+'/'+id).set(name).catch(e=>toast(e.message,'error'))}
function delCat(type,id){const cats=getCats(type);if(cats.length<=1)return toast('Keep at least one category','error');
  const name=(cats.find(c=>c.id===id)||{}).name||'';
  const used=Object.values(curTxs()).some(t=>t.type===type&&t.category===name);
  confirmDlg('Delete category?','<p>Delete <b>'+esc(name)+'</b>?'+(used?' Existing entries keep this name as plain text.':'')+'</p>',()=>{
    if(state.demo){delete curBook().categories[type][id];persistDemo();
      if(openCatManager.redraw)openCatManager.redraw();renderCats();render();return}
    bookRef(state.current).child('categories/'+type+'/'+id).remove().catch(e=>toast(e.message,'error'))})}
$('manage-cats-btn').onclick=()=>openCatManager(state.entryType);
$('btn-cats-in').onclick=()=>openCatManager('in');
$('btn-cats-out').onclick=()=>openCatManager('out');
/* ---------- books UI ---------- */
$('topbar-title').onclick=e=>{if(e.target.closest('.topbar-btn'))return;navigate('books')};
$('btn-books').onclick=()=>navigate('books');
$('create-book-btn').onclick=()=>promptDlg('New book','',v=>{createBook(v);toast('Book created','success')},'Create');
$('book-search').oninput=e=>{state.bookSearch=e.target.value.toLowerCase();renderBooks()};
function bookBalance(id){let i=0,o=0;Object.values((state.books[id]||{}).transactions||{}).forEach(t=>{t.type==='in'?i+=+t.amount||0:o+=+t.amount||0});return{i,o,net:i-o}}
function lastTxDate(id){const txs=Object.values((state.books[id]||{}).transactions||{});
  let m='';txs.forEach(t=>{if((t.date||'')>m)m=t.date||''});return m}
function fmtUpdated(ds){if(!ds)return'No entries yet';
  return'Updated on '+new Date(ds+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}
function timeFmt(ts){const d=new Date(+ts||Date.now());if(isNaN(d))return'';
  return'at '+d.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',hour12:true}).toLowerCase()}
function renderBooks(){const box=$('book-list');if(!box)return;box.innerHTML='';
  const ids=Object.keys(state.books).filter(id=>(state.books[id].name||'').toLowerCase().includes(state.bookSearch));
  $('book-count').textContent=ids.length?ids.length+' book'+(ids.length>1?'s':''):'';
  if(!ids.length){box.innerHTML='<div class="empty">No books found.<br>Tap + Add new book to create one.</div>';return}
  ids.forEach(id=>{const b=state.books[id];const bal=bookBalance(id);
    const n=Object.keys(b.transactions||{}).length;
    const row=document.createElement('div');row.className='apk-book'+(id===state.current?' active':'');
    row.innerHTML='<div class="apk-book-ic"><span class="material-icons-round">book</span></div>'+
      '<div class="apk-book-mid"><strong>'+esc(b.name)+'</strong><small>'+fmtUpdated(lastTxDate(id))+' • '+n+' entries</small></div>'+
      '<div class="apk-book-amt">'+fmtMoney(bal.net)+'</div>'+
      '<button class="tx-menu"><span class="material-icons-round">more_vert</span></button>';
    row.onclick=e=>{if(e.target.closest('.tx-menu'))return;switchBook(id)};
    row.querySelector('.tx-menu').onclick=()=>bookMenu(id);
    box.appendChild(row)})}
function bookMenu(id){const b=state.books[id];if(!b)return;
  const o=$('modal-overlay');$('modal-title').textContent=b.name;
  $('modal-body').innerHTML='<p style="color:var(--sub);font-size:13px">Open, rename or delete this book.</p>';
  const F=$('modal-footer');F.innerHTML='';
  const mk=(t,cls,fn)=>{const x=document.createElement('button');x.className=cls;x.textContent=t;
    x.onclick=()=>{o.classList.remove('active');fn()};return x};
  F.append(mk('Open','btn-cancel',()=>switchBook(id)),
    mk('Rename','btn-cancel',()=>promptDlg('Rename book',b.name,v=>{renameBook(id,v);renderBooks()})),
    mk('Delete','btn-danger',()=>deleteBook(id)));
  o.classList.add('active');o.onclick=ev=>{if(ev.target===o)o.classList.remove('active')}}
/* ---------- entries ---------- */
$('cancel-edit-btn').onclick=()=>{state.editId=null;$('cancel-edit-btn').style.display='none';$('save-tx-btn').textContent='Save Entry';navigate('home')};
$('save-tx-btn').onclick=saveTx;
function txPath(){if(state.demo)return null;
  return firebase.database().ref('cashbook/'+uid()+'/books/'+state.current+'/transactions')}
function userName(){return state.user.displayName||(state.user.email||'You').split('@')[0]}
function pruneHist(h){const cut=Date.now()-30*864e5;return(h||[]).filter(x=>x.at>cut)}
const HIST_LABEL={amount:'amount',type:'entry type',category:'category',note:'remark',method:'payment mode',date:'date'};
function fmtVal(f,v){if(v===undefined||v===null||v==='')return'—';
  if(f==='amount')return fmtMoney(v);
  if(f==='type')return v==='in'?'Cash In':'Cash Out';
  if(f==='date'&&/^\d{4}-\d{2}-\d{2}$/.test(v))return fmtDate(v);return''+v}
function saveTx(){if(!state.current)return toast('Create a book first','error');
  const amt=parseFloat($('f-amount').value);if(!(amt>0))return toast('Enter a valid amount','error');
  const tx={type:state.entryType,amount:Math.round(amt*100)/100,category:selectedCat(),
    note:$('f-note').value.trim(),method:$('f-method').value,date:$('f-date').value||new Date().toISOString().slice(0,10),createdAt:Date.now()};
  if(state.editId){const old=curTxs()[state.editId]||{};
    tx.createdBy=old.createdBy||{name:userName(),at:old.createdAt||Date.now()};
    const changes=[];
    ['amount','type','category','note','method','date'].forEach(f=>{
      const a=old[f]===undefined?'':old[f],b2=tx[f]===undefined?'':tx[f];
      if(''+a!==''+b2)changes.push({f,from:''+a,to:''+b2})});
    tx.history=pruneHist(old.history||[]);
    if(changes.length)tx.history.push({by:userName(),at:Date.now(),changes})}else{
    tx.createdBy={name:userName(),at:Date.now()};tx.history=[]}
  if(state.demo){const txs=curBook().transactions=curBook().transactions||{};
    if(state.editId)txs[state.editId]=tx;else txs['d'+Date.now()]=tx;persistDemo();afterSave();return}
  const base=txPath();const done=()=>afterSave();
  if(state.editId)base.child(state.editId).set(tx).then(done).catch(e=>toast(e.message,'error'));
  else base.push(tx).then(done).catch(e=>toast(e.message,'error'))}
function afterSave(){toast(state.editId?'Entry updated':'Entry saved','success');
  state.editId=null;$('cancel-edit-btn').style.display='none';$('save-tx-btn').textContent='Save Entry';
  $('f-amount').value='';$('f-note').value='';navigate('home');render()}
function editTx(id){const t=curTxs()[id];if(!t)return;state.editId=id;setType(t.type);
  $('f-amount').value=t.amount;$('f-note').value=t.note||'';$('f-method').value=t.method||'Cash';$('f-date').value=t.date;
  renderCats();[...$('cat-row').children].forEach(c=>c.classList.toggle('active',c.textContent===t.category));
  if(![...$('cat-row').children].some(c=>c.classList.contains('active'))&&$('cat-row').firstChild)
    $('cat-row').firstChild.classList.add('active');
  $('save-tx-btn').textContent='Update Entry';$('cancel-edit-btn').style.display='block';navigate('add')}
function delTx(id){confirmDlg('Delete entry?','<p>Remove this transaction permanently?</p>',()=>{
  if(state.demo){delete curBook().transactions[id];persistDemo();render();return}
  txPath().child(id).remove().then(()=>toast('Deleted','success'))})}
/* ---------- list (APK book-detail style) ---------- */
const FILTER_LABEL={all:'All Entries',in:'Cash In only',out:'Cash Out only'};
function paintTypeLabel(){$('type-pick-label').textContent=FILTER_LABEL[state.filter]||'All Entries'}
/* ---------- filters (APK style) ---------- */
const METHODS=['Cash','bKash','Nagad','Rocket','Bank','Card'];
const DATE_OPTS=[['all','All Time'],['today','Today'],['yesterday','Yesterday'],['thisMonth','This Month'],['lastMonth','Last Month'],['single','Single Day'],['range','Date Range']];
const TYPE_OPTS=[['all','All'],['in','Cash In'],['out','Cash Out']];
function todayISO(){return new Date().toISOString().slice(0,10)}
function defFilters(){return{date:'all',single:todayISO(),from:'',to:'',type:'all',cats:[],methods:[]}}
if(!state.filters)state.filters=defFilters();
function monthKeyOf(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')}
function matchDate(ds){const f=state.filters;if(f.date==='all')return true;
  const t=todayISO();
  if(f.date==='today')return ds===t;
  if(f.date==='yesterday')return ds===new Date(Date.now()-864e5).toISOString().slice(0,10);
  if(f.date==='thisMonth')return(ds||'').slice(0,7)===monthKeyOf(new Date());
  if(f.date==='lastMonth'){const d=new Date();d.setMonth(d.getMonth()-1);return(ds||'').slice(0,7)===monthKeyOf(d)}
  if(f.date==='single')return ds===f.single;
  if(f.date==='range'){if(f.from&&ds<f.from)return false;if(f.to&&ds>f.to)return false;return true}
  return true}
function dateLabel(){const f=state.filters;
  const o=DATE_OPTS.find(o=>o[0]===f.date);let s=o?o[1]:'All Time';
  if(f.date==='single'&&f.single)s=fmtDate(f.single);
  if(f.date==='range'&&(f.from||f.to))s=(f.from||'…')+' → '+(f.to||'…');
  return s}
function paintChips(){$('dash-month').textContent=dateLabel();
  $('type-pick-label').textContent=FILTER_LABEL[state.filter]||'All Entries';
  $('cat-pick-label').textContent=state.filters.cats.length?state.filters.cats.length+' selected':'Category';
  $('month-pick').classList.toggle('on',state.filters.date!=='all');
  $('type-pick').classList.toggle('on',state.filter!=='all');
  $('cat-pick').classList.toggle('on',state.filters.cats.length>0)}
function openSheet(title,body,foot){const o=$('modal-overlay');o.classList.add('sheet');
  $('modal-title').textContent='';$('modal-footer').innerHTML='';
  $('modal-body').innerHTML='<div class="sheet-head"><button class="sheet-x" id="sheet-x"><span class="material-icons-round">close</span></button><h3>'+title+'</h3></div>'+
    '<div class="sheet-body">'+body+'</div><div class="sheet-foot">'+foot+'</div>';
  $('sheet-x').onclick=closeSheet;
  o.classList.add('active');o.onclick=ev=>{if(ev.target===o)closeSheet()}}
function closeSheet(){const o=$('modal-overlay');o.classList.remove('active');o.classList.remove('sheet')}
function radioRows(name,opts,sel,multi){return opts.map(([v,l])=>
  '<label class="fk-radio'+(multi?(sel.includes(v)?' sel':''):(sel===v?' sel':''))+'"><input type="'+(multi?'checkbox':'radio')+'" name="'+name+'" value="'+v+'"'+(multi?(sel.includes(v)?' checked':''):(sel===v?' checked':''))+'><span class="'+(multi?'fk-check':'fk-dot')+'"></span>'+esc(l)+'</label>').join('')}
function markReady(){const b=$('sheet-apply');if(b)b.classList.add('ready')}
function openDateSheet(){const f=state.filters;
  openSheet('Select Date Filter',
    radioRows('fdate',DATE_OPTS,f.date)+
    '<div id="fk-single" style="display:'+(f.date==='single'?'block':'none')+'"><div class="fk-date-inputs"><input type="date" id="f-single" value="'+f.single+'"></div></div>'+
    '<div id="fk-range" style="display:'+(f.date==='range'?'block':'none')+'"><div class="fk-date-inputs"><input type="date" id="f-from" value="'+f.from+'"><input type="date" id="f-to" value="'+f.to+'"></div></div>',
    '<button class="fk-clear" id="sheet-clear"><span class="material-icons-round">close</span> Clear</button><button class="fk-apply" id="sheet-apply">Apply</button>');
  document.querySelectorAll('input[name=fdate]').forEach(r=>r.onchange=()=>{markReady();
    document.querySelectorAll('input[name=fdate]').forEach(x=>x.closest('.fk-radio').classList.toggle('sel',x.checked));
    $('fk-single').style.display=r.value==='single'?'block':'none';
    $('fk-range').style.display=r.value==='range'?'block':'none'});
  $('sheet-clear').onclick=()=>{state.filters.date='all';state.filters.single=todayISO();state.filters.from='';state.filters.to='';
    closeSheet();render()};
  $('sheet-apply').onclick=()=>{const sel=document.querySelector('input[name=fdate]:checked');
    if(sel)state.filters.date=sel.value;
    const s=$('f-single'),fr=$('f-from'),to=$('f-to');
    if(s)state.filters.single=s.value||todayISO();if(fr)state.filters.from=fr.value;if(to)state.filters.to=to.value;
    closeSheet();render()}}
function openTypeSheet(){openSheet('Select Entry Type Filter',radioRows('ftype',TYPE_OPTS,state.filter),
  '<button class="fk-clear" id="sheet-clear"><span class="material-icons-round">close</span> Clear</button><button class="fk-apply ready" id="sheet-apply">Apply</button>');
  document.querySelectorAll('input[name=ftype]').forEach(r=>r.onchange=()=>{
    document.querySelectorAll('input[name=ftype]').forEach(x=>x.closest('.fk-radio').classList.toggle('sel',x.checked))});
  $('sheet-clear').onclick=()=>{state.filter='all';closeSheet();render()};
  $('sheet-apply').onclick=()=>{const sel=document.querySelector('input[name=ftype]:checked');
    if(sel)state.filter=sel.value;closeSheet();render()}}
$('type-pick').onclick=openTypeSheet;
$('month-pick').onclick=openDateSheet;
$('sort-btn').onclick=()=>{state.sort=state.sort==='desc'?'asc':'desc';
  toast(state.sort==='desc'?'Newest first':'Oldest first','info');render()};
$('search-input').oninput=e=>{state.search=e.target.value.toLowerCase();render()};
$('cat-pick').onclick=openCatSheet;
function openCatSheet(){const ac=allCats();
  const sel=new Set(state.filters.cats);
  openSheet('Select Category',
    '<div class="apk-search"><span class="material-icons-round">search</span><input id="fk-catq" placeholder="Search"></div><div id="fk-catlist"></div>',
    '<button class="fk-clear" id="sheet-clear"><span class="material-icons-round">close</span> Clear</button><button class="fk-apply ready" id="sheet-apply">Apply</button>');
  const draw=q=>{const f=(q||'').toLowerCase();
    $('fk-catlist').innerHTML=['in','out'].map(t=>{
      const list=ac[t].filter(n=>n.toLowerCase().includes(f));if(!list.length)return'';
      return'<p class="fk-sub">'+(t==='in'?'Cash In':'Cash Out')+'</p>'+list.map(n=>
      '<label class="fk-radio'+(sel.has(n)?' sel':'')+'"><input type="checkbox" data-v="'+esc(n)+'"'+(sel.has(n)?' checked':'')+'><span class="fk-check"></span>'+esc(n)+'</label>').join('')}).join('')||'<div class="empty">No categories</div>';
    $('fk-catlist').querySelectorAll('input').forEach(x=>x.onchange=()=>{
      x.checked?sel.add(x.dataset.v):sel.delete(x.dataset.v);
      x.closest('.fk-radio').classList.toggle('sel',x.checked)})};
  draw('');$('fk-catq').oninput=e=>draw(e.target.value);
  $('sheet-clear').onclick=()=>{state.filters.cats=[];closeSheet();render()};
  $('sheet-apply').onclick=()=>{state.filters.cats=[...sel];closeSheet();render()}}
function allCats(){const b=curBook();if(!b)return{in:[],out:[]};
  const g=t=>{const c=b.categories&&b.categories[t];return c?Object.values(c):[]};
  return{in:g('in'),out:g('out')}}
function scopedTxs(){return Object.entries(curTxs()).filter(([,t])=>matchDate(t.date||''))}
$('btn-refresh').onclick=()=>render();
$('go-reports').onclick=()=>navigate('reports');
function monthTxs(){return Object.entries(curTxs()).filter(([,t])=>(t.date||'').slice(0,7)===state.monthKey)}
function runningBalances(){ // all-time chronological id → balance-after
  const all=Object.entries(curTxs()).sort((a,b)=>(a[1].date||'').localeCompare(b[1].date||'')||((a[1].createdAt||0)-(b[1].createdAt||0)));
  let bal=0;const map={};
  all.forEach(([id,t])=>{bal+=t.type==='in'?(+t.amount||0):-(+t.amount||0);map[id]=bal});
  return map}
function render(){if(!state.user)return;const b=curBook();
  $('book-name-text').textContent=b?b.name:'—';
  $('page-sub').textContent=dateLabel()+(b?' • '+b.name:'');
  paintChips();
  const mtx=scopedTxs();let tin=0,tout=0;
  mtx.forEach(([,t])=>{t.type==='in'?tin+=+t.amount||0:tout+=+t.amount||0});
  $('dash-in').textContent=fmtMoney(tin);$('dash-out').textContent=fmtMoney(tout);
  $('dash-balance').textContent=fmtMoney(tin-tout);
  const runBal=runningBalances();
  let rows=mtx.filter(([,t])=>state.filter==='all'||t.type===state.filter);
  const fc=state.filters.cats,fm=state.filters.methods;
  if(fc.length)rows=rows.filter(([,t])=>fc.includes(t.category||''));
  if(fm.length)rows=rows.filter(([,t])=>fm.includes(t.method||'Cash'));
  if(state.search)rows=rows.filter(([,t])=>((t.note||'')+' '+(t.category||'')+' '+(t.amount||'')).toLowerCase().includes(state.search));
  rows.sort((a,c)=>state.sort==='desc'
    ?(c[1].date||'').localeCompare(a[1].date||'')||((c[1].createdAt||0)-(a[1].createdAt||0))
    :(a[1].date||'').localeCompare(c[1].date||'')||((a[1].createdAt||0)-(c[1].createdAt||0)));
  $('tx-count').textContent='Showing '+rows.length+' '+(rows.length===1?'entry':'entries');
  const box=$('tx-list');box.innerHTML='';
  if(!rows.length)box.innerHTML='<div class="empty">No entries in <b>'+esc(b?b.name:'')+'</b> here.<br>Use the buttons below to add Cash In / Out.</div>';
  let lastDay='';
  const me=(state.user.displayName||(state.user.email||'You').split('@')[0]);
  rows.forEach(([id,t])=>{if(t.date!==lastDay){lastDay=t.date;
      const h=document.createElement('p');h.className='apk-day';h.textContent=fmtDate(lastDay);box.appendChild(h)}
    const el=document.createElement('div');el.className='apk-entry';
    el.innerHTML='<div class="apk-entry-top"><div class="apk-chips"><span class="chip-cat">'+esc(t.category||(t.type==='in'?'Cash In':'Cash Out'))+'</span>'+
      '<span class="chip-method">'+esc(t.method||'Cash')+'</span></div>'+
      '<div class="apk-amt '+t.type+'">'+fmtMoney(t.amount)+'<small>Balance: '+fmtMoney(runBal[id]||0)+'</small></div></div>'+
      (t.note?'<p class="apk-remark">'+esc(t.note)+'</p>':'')+
      '<p class="apk-meta">Entry by '+esc(me)+' <span>'+esc(timeFmt(t.createdAt))+'</span></p>';
    el.onclick=()=>txMenu(id);box.appendChild(el)});
  const rpt=monthTxs();let rtin=0,rtout=0;
  rpt.forEach(([,t])=>{t.type==='in'?rtin+=+t.amount||0:rtout+=+t.amount||0});
  renderReports(rpt,rtin,rtout);if($('page-books').classList.contains('active'))renderBooks()}
function txMenu(id){const o=$('modal-overlay');const t=curTxs()[id]||{};
  const me=(state.user.displayName||(state.user.email||'You').split('@')[0]);
  const when=(t.date?new Date(t.date+'T12:00:00').toLocaleDateString('en-US',{day:'numeric',month:'short',year:'numeric'}):'')+(t.createdAt?', '+timeFmt(t.createdAt).replace(/^at /,''):'');
  $('modal-title').textContent='Entry Details';
  $('modal-body').innerHTML='<div class="apk-detail'+(t.type==='out'?' out':'')+'">'+
    '<div class="apk-detail-top"><span>'+(t.type==='in'?'Cash In':'Cash Out')+'</span><span>'+esc(when)+'</span></div>'+
    '<h2 class="'+t.type+'">'+fmtMoney(t.amount)+'</h2>'+
    (t.note?'<p class="apk-detail-note">'+esc(t.note)+'</p>':'')+
    '<div class="apk-chips"><span class="chip-cat">'+esc(t.category||'-')+'</span><span class="chip-method">'+esc(t.method||'Cash')+'</span></div>'+
    (t.details?'<p class="apk-detail-full">'+esc(t.details)+'</p>':'')+
    '<button class="apk-editbtn" id="detail-edit"><span class="material-icons-round">edit</span> Edit entry</button></div>'+
    '<p class="apk-created">Created By<span>'+esc((t.createdBy&&t.createdBy.name)||'—')+'</span></p>'+
    ((t.history&&t.history.length)?'<p class="apk-created">Last Edited By<span>'+esc(t.history[t.history.length-1].by)+'</span></p>'+
    '<button class="apk-editbtn" id="detail-hist"><span class="material-icons-round">history</span> View edit history</button>':'');
  const F=$('modal-footer');F.innerHTML='';
  const mk=(t2,cls,fn)=>{const x=document.createElement('button');x.className=cls;x.innerHTML=t2;
    x.onclick=()=>{o.classList.remove('active');fn()};return x};
  F.append(mk('<span class="material-icons-round" style="font-size:18px;vertical-align:-4px">share</span> Share entry','apk-share',()=>shareTx(id)),
    mk('Delete','btn-danger',()=>delTx(id)));
  $('detail-edit').onclick=()=>{o.classList.remove('active');editTx(id)};
  const hb=$('detail-hist');if(hb)hb.onclick=()=>{o.classList.remove('active');openHistory(id)};
  o.classList.add('active');o.onclick=ev=>{if(ev.target===o)o.classList.remove('active')}}
function fmtDT(ts){const d=new Date(+ts);if(isNaN(d))return'';
  return d.toLocaleDateString('en-US',{day:'numeric',month:'short',year:'numeric'})+', '+d.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',hour12:true})}
function openHistory(id){const t=curTxs()[id]||{};const hist=pruneHist(t.history||[]).slice().reverse();
  const o=$('modal-overlay');o.classList.add('sheet');$('modal-title').textContent='';
  let lastDay='';
  const rows=hist.map(h=>{
    const d=new Date(h.at);const day=d.toLocaleDateString('en-US',{day:'2-digit',month:'long',year:'numeric'});
    const head=day!==lastDay?'<p class="apk-day">'+day+'</p>':'';lastDay=day;
    const ch=h.changes.map(c=>'<div style="margin-top:10px"><strong style="font-size:15px">Edited '+(HIST_LABEL[c.f]||c.f)+'</strong>'+
      '<small>To: '+esc(fmtVal(c.f,c.to))+'</small><small>From: '+esc(fmtVal(c.f,c.from))+'</small></div>').join('');
    return head+'<div class="hist-row"><div class="hist-av">'+esc((h.by||'Y')[0].toUpperCase())+'</div>'+
      '<div class="hist-main"><strong>'+esc(h.by||'')+'</strong>'+ch+'</div>'+
      '<span class="hist-time">'+esc(d.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',hour12:true}))+'</span></div>'}).join('');
  $('modal-body').innerHTML='<div class="sheet-head"><button class="sheet-x" id="sheet-x"><span class="material-icons-round">close</span></button><h3>Edit History</h3></div>'+
    '<div class="sheet-body"><div class="apk-count"><span></span><p>Showing '+hist.length+' '+(hist.length===1?'activity':'activities')+'</p><span></span></div>'+
    (rows||'<div class="empty">No edits yet.</div>')+
    '<div class="hist-note"><span class="material-icons-round">info</span><span>Edit History is maintained only for last 30 days.</span></div></div>'+
    '<div class="sheet-foot"></div>';
  $('modal-footer').innerHTML='';
  $('sheet-x').onclick=closeSheet;
  o.classList.add('active');o.onclick=ev=>{if(ev.target===o)closeSheet()}}
function ordinal(n){const s=['th','st','nd','rd'],v=n%100;return n+(s[(v-20)%10]||s[v]||s[0])}
function billDate(ds){const d=new Date((ds||todayISO())+'T12:00:00');
  return ordinal(d.getDate())+' '+d.toLocaleDateString('en-US',{month:'short'})+' '+d.getFullYear()}
function loadImg(src){return new Promise(res=>{const im=new Image();im.onload=()=>res(im);im.onerror=()=>res(null);im.src=src})}
function wrapLines(ctx,text,maxW){const words=(''+text).split(/\s+/).filter(Boolean);
  const lines=[];let line='';
  words.forEach(w=>{const t=line?line+' '+w:w;
    if(ctx.measureText(t).width>maxW&&line){lines.push(line);line=w}else line=t});
  if(line)lines.push(line);return lines.length?lines:['-']}
async function shareTx(id){const t=curTxs()[id];if(!t)return;const b=curBook();
  toast('Making bill image…','info');
  const W=1080,PAD=64,PUR='#4f2fd6',INK='#111',GREY='#888';
  const amtStr=Number(t.amount||0).toLocaleString('en-US',{maximumFractionDigits:2});
  const amtCol=t.type==='in'?'#1e8e3e':'#d32f2f';
  const cv=document.createElement('canvas');const ctx=cv.getContext('2d');
  const F=(px,w)=>{ctx.font=(w||'')+px+'px Arial,sans-serif'};
  const remarkLines=wrapLines((F(42),ctx),t.note||t.category||'-',W-PAD*2-300);
  const H=90+120+150+120+70+remarkLines.length*58+150+150+90;
  cv.width=W;cv.height=H;
  ctx.fillStyle=PUR;ctx.fillRect(0,0,W,H);
  // receipt body
  const rx=PAD,ry=48,rw=W-PAD*2,rh=H-96;
  ctx.fillStyle='#fff';
  if(ctx.roundRect){ctx.beginPath();ctx.roundRect(rx,ry,rw,rh,8);ctx.fill()}
  else ctx.fillRect(rx,ry,rw,rh);
  // perforated top edge
  ctx.fillStyle=PUR;
  for(let x=rx+24;x<rx+rw-10;x+=64){ctx.beginPath();ctx.arc(x,ry,17,0,Math.PI*2);ctx.fill()}
  let y=ry+118;
  ctx.textBaseline='alphabetic';
  F(46,'bold');ctx.fillStyle=INK;ctx.textAlign='left';ctx.fillText('Bill',rx+40,y);
  F(34);ctx.fillStyle=GREY;ctx.textAlign='right';ctx.fillText('Bill Date: '+billDate(t.date),rx+rw-40,y+4);
  y+=34;ctx.strokeStyle='#eee';ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(rx,y);ctx.lineTo(rx+rw,y);ctx.stroke();y+=86;
  F(34);ctx.fillStyle=GREY;ctx.textAlign='right';ctx.fillText('Mode',rx+rw-40,y);
  F(46,'bold');ctx.fillStyle=INK;ctx.fillText(t.method||'Cash',rx+rw-40,y+62);y+=100;
  F(34);ctx.fillStyle=GREY;ctx.textAlign='left';ctx.fillText('Details',rx+40,y);
  ctx.textAlign='right';ctx.fillText('Amount',rx+rw-40,y);y+=72;
  F(42);ctx.fillStyle=INK;ctx.textAlign='left';
  remarkLines.forEach((ln,i)=>ctx.fillText(ln,rx+40,y+i*58));
  F(64,'bold');ctx.fillStyle=amtCol;ctx.textAlign='right';ctx.fillText(amtStr,rx+rw-40,y);
  y+=remarkLines.length*58+110;
  F(34);ctx.fillStyle=GREY;ctx.textAlign='center';ctx.fillText('Created by',W/2,y);y+=86;
  const logo=await loadImg('icon.png');
  const bw=ctx.textAlign='left';
  if(logo){const s=84;ctx.drawImage(logo,W/2-150,y-58,s,s);
    F(44,'bold');ctx.fillStyle='#2b4bd6';ctx.fillText('CASHBOOK',W/2-52,y-12);
    F(23);ctx.fillStyle=INK;ctx.fillText('Easy to Use  |  100 % Safe',W/2-52,y+24)}
  else{F(40,'bold');ctx.fillStyle='#2b4bd6';ctx.textAlign='center';ctx.fillText('CASHBOOK',W/2,y)}
  cv.toBlob(async blob=>{
    if(!blob)return toast('Could not make image','error');
    const file=new File([blob],'cashbook-bill-'+t.date+'.png',{type:'image/png'});
    if(navigator.canShare&&navigator.canShare({files:[file]})){
      try{await navigator.share({files:[file],title:'Cashbook bill'});return}
      catch(e){if(e&&e.name==='AbortError')return}}
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);
    a.download=file.name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),4000);
    toast('Bill image downloaded','success')},'image/png')}
function renderReports(mtx,tin,tout){
  $('report-month').innerHTML='<div class="rrow"><span>Cash In</span><strong style="color:var(--green)">'+fmtMoney(tin)+'</strong></div>'+
    '<div class="rrow"><span>Cash Out</span><strong style="color:var(--danger)">'+fmtMoney(tout)+'</strong></div>'+
    '<div class="rrow"><span>Net</span><strong>'+fmtMoney(tin-tout)+'</strong></div>'+
    '<div class="rrow"><span>Entries</span><strong>'+mtx.length+'</strong></div>';
  const byCat={};mtx.forEach(([,t])=>{const k=(t.type==='out'?'− ':'+ ')+(t.category||'Other');byCat[k]=(byCat[k]||0)+(+t.amount||0)});
  const top=Object.entries(byCat).sort((a,c)=>c[1]-a[1]).slice(0,6);const max=top.length?top[0][1]:1;
  $('report-cats').innerHTML=top.length?top.map(([k,v])=>'<div class="bar-row"><span class="bar-name">'+esc(k)+'</span>'+
    '<div class="bar-track"><div class="bar-fill'+(k[0]==='−'?' out':'')+'" style="width:'+Math.round(v/max*100)+'%"></div></div>'+
    '<span class="bar-amt">'+fmtMoney(v)+'</span></div>').join(''):'<div class="empty">No data</div>';
  const hist=[];const[y,m]=state.monthKey.split('-').map(Number);
  for(let i=5;i>=0;i--){const d=new Date(y,m-1-i,1);const k=monthKey(d);let hi=0,ho=0;
    Object.values(curTxs()).forEach(t=>{if((t.date||'').slice(0,7)===k){t.type==='in'?hi+=+t.amount||0:ho+=+t.amount||0}});
    hist.push({label:d.toLocaleDateString('en-US',{month:'short'}),net:hi-ho})}
  const mx=Math.max(1,...hist.map(h=>Math.abs(h.net)));
  $('report-history').innerHTML=hist.map(h=>'<div class="bar-row"><span class="bar-name">'+h.label+'</span>'+
    '<div class="bar-track"><div class="bar-fill'+(h.net<0?' out':'')+'" style="width:'+Math.round(Math.abs(h.net)/mx*100)+'%"></div></div>'+
    '<span class="bar-amt">'+fmtMoney(h.net)+'</span></div>').join('')}
/* ---------- import: CashBook APK exports (CSV / SQLite .db) ---------- */
/* robust CSV parser: quotes, escaped "", commas + newlines inside fields */
function parseCSV(text){
  const rows=[];let row=[],val='',q=false;
  for(let i=0;i<text.length;i++){const c=text[i];
    if(q){if(c==='"'){if(text[i+1]==='"'){val+='"';i++}else q=false}else val+=c}
    else if(c==='"')q=true;
    else if(c===','){row.push(val);val=''}
    else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;
      row.push(val);val='';
      if(row.length>1||(row.length===1&&row[0]!==''))rows.push(row);row=[]}
    else val+=c}
  if(val!==''||row.length){row.push(val);if(row.length>1||row[0]!=='')rows.push(row)}
  return rows}
function rowsToObjects(rows){if(!rows.length)return[];
  const head=rows[0].map(h=>h.trim());
  return rows.slice(1).map(r=>{const o={};head.forEach((h,i)=>o[h]=r[i]!==undefined?r[i]:'');return o})}
/* header normaliser for XLS/PDF sources (case/space/underscore tolerant) */
const KEYMAP={id:'id',name:'name',date:'date',cashin:'cash_in',cashout:'cash_out',notes:'notes',note:'notes',
  description:'description',desc:'description',details:'description',accounts:'accounts',account:'accounts',book:'accounts',
  isdeleted:'isDeleted',transactiontype:'transactionType',type:'transactionType',balance:'balance',bill:'bill'};
function normalizeKeys(rows){return rows.map(r=>{const o={};
  Object.entries(r).forEach(([k,v])=>{const key=KEYMAP[(''+k).toLowerCase().replace(/[\s_]+/g,'')];
    if(key)o[key]=(typeof v==='string')?v.trim():v});return o})}
/* Excel (.xls/.xlsx) via SheetJS CDN — every sheet, header row → objects */
function loadXlsx(){return new Promise((res,rej)=>{if(window.XLSX)return res(window.XLSX);
  const s=document.createElement('script');s.src='https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
  s.onload=()=>window.XLSX?res(window.XLSX):rej(new Error('xlsx lib failed'));s.onerror=()=>rej(new Error('xlsx CDN offline'));
  document.head.appendChild(s)})}
function parseSheetFile(file){return file.arrayBuffer().then(buf=>loadXlsx().then(XLSX=>{
  const wb=XLSX.read(buf,{type:'array'});const out=[];
  wb.SheetNames.forEach(sn=>{const arr=XLSX.utils.sheet_to_json(wb.Sheets[sn],{defval:'',raw:false});
    if(arr&&arr.length)normalizeKeys(arr).forEach(r=>out.push(r))});
  if(!out.length)throw new Error('no rows in workbook');return out}))}
/* PDF via pdf.js CDN — finds a delimiter table whose header names transaction fields */
function loadPdfJs(){return new Promise((res,rej)=>{if(window.pdfjsLib)return res(window.pdfjsLib);
  const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
  s.onload=()=>{try{window.pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    res(window.pdfjsLib)}catch(e){rej(e)}};s.onerror=()=>rej(new Error('pdf.js CDN offline'));document.head.appendChild(s)})}
function tableFromText(text){
  const lines=text.split('\n').map(l=>l.trim()).filter(l=>l.length>1);
  const words=['cash','account','note','description','transaction','balance','deleted'];
  let hi=-1,delim=',',best=0;
  lines.slice(0,60).forEach((l,i)=>{const low=l.toLowerCase();
    const hits=words.filter(w=>low.includes(w)).length;if(hits<3||hits<=best)return;
    const cands=[',','\t',';','|'].map(d=>({d,n:l.split(d).length})).sort((a,b)=>b.n-a.n)[0];
    if(cands.n>=3){best=hits;hi=i;delim=cands.d}});
  if(hi<0)return[];
  const strip=s=>{s=s.trim();if(s.length>1&&s[0]==='"'&&s[s.length-1]==='"')s=s.slice(1,-1);return s};
  const head=lines[hi].split(delim).map(strip);
  const out=[];
  for(let i=hi+1;i<lines.length&&out.length<5000;i++){const parts=lines[i].split(delim).map(strip);
    if(parts.length<head.length-1)continue;
    const o={};head.forEach((h,j)=>o[h]=parts[j]!==undefined?parts[j]:'');out.push(o)}
  return normalizeKeys(out)}
/* ----- statement-PDF tables: rebuild grid from text coordinates ----- */
function clusters(vals,n){
  const s=[...new Set(vals.map(v=>Math.round(v)))].sort((a,b)=>a-b);
  if(s.length<=n)return s;
  const gaps=[];for(let i=1;i<s.length;i++)gaps.push({i,g:s[i]-s[i-1]});
  gaps.sort((a,b)=>b.g-a.g);
  const cuts=gaps.slice(0,n-1).map(g=>g.i).sort((a,b)=>a-b);
  const groups=[];let start=0;
  cuts.forEach(c=>{groups.push(s.slice(start,c));start=c});groups.push(s.slice(start));
  return groups.map(g=>g[Math.floor(g.length/2)]).sort((a,b)=>a-b)}
function inferHC(pages){
  const DATE_RE=/^\d{1,2}-[A-Za-z]{3}-\d{4}$/,NUM_RE=/^[\d,]+(\.\d{1,2})?$/;
  const dates=[],nums=[],texts=[];
  pages.forEach(items=>items.forEach(it=>{const t=it.s.trim();
    if(DATE_RE.test(t))dates.push(it.x);
    else if(NUM_RE.test(t))nums.push(it);
    else if(t.length>1)texts.push(it)}));
  if(!dates.length)return null;
  const med=a=>{const s=[...a].sort((x,y)=>x-y);return s[Math.floor(s.length/2)]};
  const dateX=med(dates);
  const serials=nums.filter(o=>/^\d{1,4}$/.test(o.s.trim())&&o.x<dateX-10);
  if(!serials.length)return null;
  const serialMax=Math.max(...serials.map(o=>o.x));
  const grp=clusters(nums.filter(o=>o.x>dateX+10).map(o=>o.x),3);
  if(grp.length<3)return null;
  const[inX,outX,balX]=grp;
  const mid=texts.filter(o=>o.x>dateX+10&&o.x<inX-10);
  let notesX=dateX+40,descX=null;
  if(mid.length){notesX=med(mid.map(o=>o.x));
    const g2=clusters(mid.map(o=>o.x),2);
    if(g2.length>=2){notesX=g2[0];descX=g2[1]}}
  if(descX===null)descX=notesX;
  return{dateX,notesX,descX,inX,outX,balX,serialMax}}
function bandItems(items,tol){
  const sorted=[...items].sort((a,b)=>b.y-a.y);const bands=[];let cur=null;
  sorted.forEach(it=>{if(!cur||Math.abs(it.y-cur.y)>tol){cur={y:it.y,items:[]};bands.push(cur)}cur.items.push(it)});
  bands.forEach(b=>b.items.sort((a,c)=>a.x-c.x));return bands}
function buildPdfRows(pages,fileName){
  const MONTHS={jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12'};
  const norm=s=>(''+s).replace(/\s+/g,' ').trim();
  const isHeaderTxt=t=>{const l=t.toLowerCase();let h=0;
    if(l.includes('date'))h++;if(l.includes('notes'))h++;
    if(l.includes('description')||l.includes('category'))h++;if(l.includes('cash'))h++;if(l.includes('balance'))h++;return h>=4};
  // 1) locate header band (+ merged neighbour pairs for wrapped headers) + column x-centres
  let HC=null;const debug={pages:pages.length,bands:0,header:false,records:0};
  const findHC=bands=>{
    for(let bi=0;bi<bands.length&&!HC;bi++){
      const cands=[bands[bi]];
      if(bi+1<bands.length)cands.push({y:bands[bi].y,items:[...bands[bi].items,...bands[bi+1].items].sort((a,c)=>a.x-c.x)});
      for(const b of cands){if(HC)break;
        const txt=norm(b.items.map(i=>i.s).join(' '));if(!isHeaderTxt(txt))continue;
      const at=kw=>{const f=b.items.find(i=>i.s.toLowerCase().includes(kw));return f?f.x:null};
      let dateX=at('date'),notesX=at('notes');
      let descX=at('description');if(descX===null)descX=at('category');
      const cash=b.items.filter(i=>i.s.toLowerCase().includes('cash')).sort((a,c)=>a.x-c.x);
      let inX=null,outX=null;
      cash.forEach(i=>{const l=i.s.toLowerCase();
        if(l.includes('in')&&inX===null)inX=i.x;else if(l.includes('out')&&outX===null)outX=i.x});
      if(cash.length>=2&&inX!==null&&outX!==null){/* classified */}
      else if(cash.length>=2){inX=cash[0].x;outX=cash[cash.length-1].x}
      const balX=at('balance');
      if(dateX===null||notesX===null||balX===null)continue;
      const gaps=[notesX-dateX,descX!==null?descX-notesX:0].filter(g=>g>0);
      const avg=gaps.length?gaps.reduce((a,c)=>a+c,0)/gaps.length:80;
      HC={dateX,notesX,descX:descX===null?notesX+avg:descX,inX:outX!==null&&inX===null?null:inX,outX,balX,serialMax:dateX-avg/2};
      if(HC.inX===null&&HC.outX!==null)HC.inX=HC.outX-avg;
      if(HC.outX===null&&HC.inX!==null)HC.outX=HC.inX+avg;
      debug.header=true}}};
  pages.forEach(items=>{debug.bands+=bandItems(items,3).length;findHC(bandItems(items,3))});
  if(HC)debug.mode='header';
  if(!HC){HC=inferHC(pages);if(HC)debug.mode='inferred'}
  if(!HC)return{rows:[],debug};
  const colOf=x=>{if(x<HC.serialMax+2)return 0;
    const c=[HC.dateX,HC.notesX,HC.descX,HC.inX,HC.outX,HC.balX];
    let bi=0,bd=1e12;c.forEach((cx,i)=>{const d=Math.abs(x-cx);if(d<bd){bd=d;bi=i}});
    return bi+1};
  // 2) book title: first "NN. name" line before header on page 1
  let book='';
  bandItems(pages[0]||[],3).forEach(b=>{const t=norm(b.items.map(i=>i.s).join(' '));
    if(isHeaderTxt(t)||book)return;const m=t.match(/^(\d{1,2})\.\s*(.+)$/);if(m)book=(m[1]+'. '+m[2]).slice(0,60)});
  if(!book){const base=fileName.replace(/\.(pdf|PDF)$/,'').replace(/\s*\d{2}-[A-Za-z]{3}-\d{4}.*$/,'').trim();
    book=(base||'Imported').slice(0,60)}
  // 3) walk bands → records anchored by serial numbers or row dates
  const recs=[];let cur=null;
  const hasDate=t=>/\d{1,2}-[A-Za-z]{3}-\d{4}/.test(t);
  const pushBand=b=>{
    const cells=[[],[],[],[],[],[],[]];
    b.items.forEach(it=>cells[colOf(it.x)].push(it.s));
    const txt=norm(cells.flat().join(' '));
    if(isHeaderTxt(txt))return;
    if(/total/i.test(txt))return;
    const serial=norm(cells[0].join(' '));
    if(/^\d{1,4}$/.test(serial)||hasDate(txt))startRec(cells,serial);
    else if(cur){cells.forEach((c,i)=>{if(c.length)cur.cells[i].push(...c)})}};
  const startRec=(cells,serial)=>{cur={cells:cells.map(c=>[...c]),serial:/^\d{1,4}$/.test(serial)?serial:''};
    recs.push(cur);debug.records++};
  pages.forEach(items=>bandItems(items,3).forEach(pushBand));
  // 4) records → canonical rows
  const parseAmt=s=>{const v=parseFloat((''+s).replace(/,/g,''));return isNaN(v)?0:v};
  const out=[];
  recs.forEach(r=>{
    const j=i=>norm(r.cells[i].join(' '));
    const dm=j(1).match(/(\d{1,2})-([A-Za-z]{3})-(\d{4})/);
    if(!dm)return;const mo=MONTHS[dm[2].toLowerCase().slice(0,3)];if(!mo)return;
    const date=dm[3]+'-'+mo+'-'+('0'+dm[1]).slice(-2);
    const ci=parseAmt(j(4)),co=parseAmt(j(5));
    if(!(ci>0)&&!(co>0))return;
    const type=ci>0?'in':'out';
    const desc=j(3).replace(/\s*\n\s*/g,'\n');
    const slug=book.replace(/[^\w]+/g,'');
    out.push({id:'pdf-'+slug+'-'+(r.serial||(date+'-'+ci+'-'+co)).replace(/[^\w.-]+/g,''),date,
      cash_in:ci,cash_out:co,notes:j(2),description:desc,accounts:book,
      isDeleted:0,transactionType:type==='in'?1:2,balance:parseAmt(j(6))})});
  return{rows:out,debug}}
function readPdfFile(file){return file.arrayBuffer().then(buf=>loadPdfJs().then(async pdfjs=>{
  const pdf=await pdfjs.getDocument({data:new Uint8Array(buf)}).promise;
  const pages=[];const n=Math.min(pdf.numPages,80);
  for(let p=1;p<=n;p++){const pg=await pdf.getPage(p);
    pages.push((await pg.getTextContent()).items
      .map(it=>({x:it.transform[4],y:it.transform[5],s:it.str||''})).filter(o=>o.s.trim()))}
  try{pdf.destroy()}catch(e){}
  const built=buildPdfRows(pages,file.name);
  let rows=built.rows,why='read '+built.debug.pages+'p/'+built.debug.bands+' bands, mode '+(built.debug.mode||'none')+', header '+(built.debug.header?'found':'MISSING')+', records '+built.debug.records;
  if(!rows.length){ // fall back to plain-text table scan
    const text=pages.map(pg=>pg.map(o=>o.s).join(' ')).join('\n');
    rows=tableFromText(text)}
  if(!rows.length)throw new Error('no transaction table found ('+why+')');return rows}))}
function methodForAccount(name){const n=(name||'').toLowerCase();
  if(n.includes('bkash'))return'bKash';if(n.includes('nagad'))return'Nagad';
  if(n.includes('rocket'))return'Rocket';if(n.includes('cash'))return'Cash';
  if(n.includes('bank')||n.includes('abbl')||n.includes('dbbl')||n.includes('ibbl'))return'Bank';
  return'Cash'}
function dateFromMs(ms){const d=new Date(+ms);return isNaN(d.getTime())?null:d.toISOString().slice(0,10)}
function mapApkRow(r){
  if(+r.isDeleted)return null;
  const type=+r.transactionType===1?'in':'out';
  const amt=type==='in'?parseFloat(r.cash_in):parseFloat(r.cash_out);
  if(!(amt>0))return null;
  const iso=/^\d{4}-\d{2}-\d{2}$/.test(r.date||'')?r.date:null;
  const date=iso||dateFromMs(r.date);if(!date)return null;
  const desc=(r.description||'').trim();
  return{type,amount:Math.round(amt*100)/100,
    category:(r.notes||'').trim()||(type==='in'?'Cash In':'Cash Out'),
    note:desc.split('\n')[0].slice(0,120),
    details:desc.length>120?desc:'',
    method:methodForAccount(r.accounts),
    book:(r.accounts||'').trim()||'My Book',
    date,createdAt:iso?new Date(date+'T12:00:00').getTime():(+r.date||Date.now()),
    importId:/^pdf-/.test(r.id||'')?r.id:'csv-'+(r.id||(''+date+amt))}}
function collectImport(parsedFiles){
  // parsedFiles: [{name, rows:[objects]}] — returns plan
  const plan={books:{},skipped:0,files:0};
  const getBook=name=>{name=(name||'').trim()||'My Book';
    if(!plan.books[name])plan.books[name]={name,txs:[],newCats:{in:[],out:[]},exists:!!bookIdByName(name)};
    return plan.books[name]};
  parsedFiles.forEach(f=>{
    if(!f.rows.length)return;plan.files++;
    const keys=Object.keys(f.rows[0]);
    if(keys.includes('name')&&(keys.includes('_id')||keys.length<=2)&&!keys.includes('cash_in')){
      f.rows.forEach(r=>{if((r.name||'').trim())getBook(r.name)});return} // accounts.csv
    if(keys.includes('cash_in')||keys.includes('transactionType')){
      f.rows.forEach(r=>{const tx=mapApkRow(r);
        if(!tx){plan.skipped++;return}
        const b=getBook(tx.book);b.txs.push(tx);
        if(!catExists(b.name,tx.type,tx.category)&&!b.newCats[tx.type].includes(tx.category))
          b.newCats[tx.type].push(tx.category)});return}
    plan.skipped+=f.rows.length}) // unknown format
  return plan}
function bookIdByName(name){name=(name||'').trim().toLowerCase();
  return Object.keys(state.books).find(id=>(state.books[id].name||'').trim().toLowerCase()===name)||null}
function catExists(bookName,type,cat){const id=bookIdByName(bookName);
  if(!id)return false;const c=state.books[id].categories&&state.books[id].categories[type];
  if(!c)return false;const low=cat.toLowerCase();
  return Object.values(c).some(n=>(n||'').toLowerCase()===low)}
function txImported(bookId,importId){const txs=(state.books[bookId]||{}).transactions||{};
  return Object.values(txs).some(t=>t.importId===importId)}
function executeImport(plan){
  let nTx=0,nBook=0,nCat=0;const now=Date.now();
  const newKey=prefix=>state.demo?prefix+now+Math.floor(Math.random()*1e6):firebase.database().ref().push().key;
  const batch={};
  Object.values(plan.books).forEach(b=>{
    let id=bookIdByName(b.name);
    if(!id){id=newKey('b');nBook++;
      batch[basePath()+'/books/'+id]={name:b.name,createdAt:now,transactions:{},categories:seedCats()}}
    const existingCats=state.books[id]?state.books[id].categories:null;
    ['in','out'].forEach(t=>b.newCats[t].forEach(name=>{
      const has=existingCats&&existingCats[t]&&Object.values(existingCats[t]).some(n=>(n||'').toLowerCase()===name.toLowerCase());
      if(has)return;
      if(state.demo){(state.books[id].categories=state.books[id].categories||{in:{},out:{}});
        state.books[id].categories[t]=state.books[id].categories[t]||{};
        state.books[id].categories[t][newKey('c')]=name}
      else batch[basePath()+'/books/'+id+'/categories/'+t+'/'+newKey('c')]=name;nCat++}));
    b.txs.forEach(tx=>{if(txImported(id,tx.importId))return;
      const{book,...rest}=tx;
      if(state.demo){(state.books[id].transactions=state.books[id].transactions||{})['csv-'+nTx+'-'+now]=rest}
      else batch[basePath()+'/books/'+id+'/transactions/csv-'+rest.importId.replace(/^csv-/,'')]=rest;nTx++})});
  if(state.demo){persistDemo();if(!state.current)state.current=Object.keys(state.books)[0];
    renderCats();render();toast('Imported '+nTx+' entries into '+Object.keys(plan.books).length+' books','success');return}
  if(!Object.keys(batch).length){toast('Nothing new — all rows already imported','info');return}
  firebase.database().ref().update(batch).then(()=>{
    // point at first imported book
    const first=Object.keys(plan.books)[0];const id=first&&bookIdByName(first);
    toast('Imported '+nTx+' entries'+(nBook?' + '+nBook+' new books':'')+(nCat?' + '+nCat+' categories':''),'success')})
    .catch(e=>toast(e.message,'error'))}
function basePath(){return'cashbook/'+uid()}
function importFiles(files){
  if(!state.user)return toast('Log in first','error');
  const list=[...files].filter(f=>/\.(csv|xlsx?|db|sqlite3?|pdf)$/i.test(f.name));
  if(!list.length)return toast('Pick .csv / .xls / .pdf / .db files','error');
  toast('Reading '+list.length+' file(s)…','info');
  const reads=list.map(f=>new Promise(res=>{
    const ext=(f.name.split('.').pop()||'').toLowerCase();
    if(ext==='csv'){const r=new FileReader();
      r.onload=()=>{try{res({name:f.name,rows:rowsToObjects(parseCSV(r.result))})}catch(e){res({name:f.name,rows:[],err:''+e})}};
      r.onerror=()=>res({name:f.name,rows:[],err:'unreadable'});r.readAsText(f);return}
    if(ext==='xls'||ext==='xlsx'){parseSheetFile(f).then(rows=>res({name:f.name,rows}))
      .catch(e=>res({name:f.name,rows:[],err:''+(e.message||e)}));return}
    if(ext==='pdf'){readPdfFile(f).then(rows=>res({name:f.name,rows}))
      .catch(e=>res({name:f.name,rows:[],err:''+(e.message||e)}));return}
    readDbFile(f).then(rows=>res({name:f.name,rows})).catch(()=>res({name:f.name,rows:[],err:'db unreadable'}))}));
  Promise.all(reads).then(parsed=>{
    const bad=parsed.filter(p=>p.err);if(bad.length)toast(bad.map(b=>b.name+': '+b.err).join('; '),'error');
    const plan=collectImport(parsed.filter(p=>!p.err));
    const nTx=Object.values(plan.books).reduce((a,b)=>a+b.txs.length,0);
    const nBk=Object.keys(plan.books).length;
    if(!nTx&&!nBk)return toast('No importable rows found','error');
    const lines=Object.entries(plan.books).map(([n,b])=>'<div class="rrow"><span>'+esc(n)+'</span><strong>'+b.txs.length+' entries</strong></div>').join('');
    confirmDlg('Import data?','<div class="rrow"><span>Books</span><strong>'+nBk+'</strong></div>'+
      '<div class="rrow"><span>New entries</span><strong>'+nTx+'</strong></div>'+
      '<div class="rrow"><span>Skipped (deleted/empty)</span><strong>'+plan.skipped+'</strong></div>'+lines+
      '<p class="import-hint">Duplicates are skipped on re-import. Nothing is deleted.</p>',
      ()=>executeImport(plan),'Import')})}
function readDbFile(file){
  const loadSql=()=>new Promise((res,rej)=>{if(window.SQL)return res(window.SQL);
    const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/sql-wasm.js';
    s.onload=()=>res(window.SQL);s.onerror=()=>rej(new Error('sql.js CDN failed'));document.head.appendChild(s)});
  return file.arrayBuffer().then(buf=>loadSql().then(async SQL=>{
    const sql=await SQL({locateFile:f=>'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/'+f});
    const db=new sql.Database(new Uint8Array(buf));
    const tables=db.exec("SELECT name FROM sqlite_master WHERE type='table'").values.flat().map(t=>(''+t).toLowerCase());
    const out=[];
    const pull=(table,want)=>{ // want: {col:possible names[]}
      const tname=tables.find(t=>t===table.toLowerCase());if(!tname)return[];
      let cols=[];try{cols=db.exec('SELECT * FROM "'+tname+'" LIMIT 1').columns}catch(e){return[]}
      const lower=cols.map(c=>(''+c).toLowerCase());
      const pick=cands=>{for(const c of cands){const i=lower.indexOf(c);if(i>=0)return cols[i]}return null};
      const sel=Object.entries(want).map(([k,cands])=>({k,col:pick(cands)})).filter(x=>x.col);
      if(!sel.length)return[];
      try{const r=db.exec('SELECT '+sel.map(s=>'"'+s.col+'"').join(',')+' FROM "'+tname+'"');
        if(!r.length)return[];
        return r.values.map(v=>{const o={};sel.forEach((s,i)=>o[s.k]=v[i]);return o})}catch(e){return[]}};
    pull('accounts',{_id:['id','_id'],name:['name','account','title']}).forEach(r=>out.push({name:''+r.name}));
    const txs=pull('cashtransaction',{id:['id'],date:['date'],cash_in:['cash_in','cashin'],cash_out:['cash_out','cashout'],
      notes:['notes','note','category'],description:['description','desc','details'],accounts:['accounts','account','book'],
      isDeleted:['isdeleted'],transactionType:['transactiontype','type']});
    txs.forEach(r=>out.push(Object.assign({balance:0,bill:''},r)));
    try{db.close()}catch(e){}
    // tag so collectImport recognises tx rows
    return out.map(r=>('cash_in' in r||'transactionType' in r||'cash_out' in r)?
      Object.assign({transactionType:r.transactionType!==undefined?r.transactionType:(+r.cash_in>0?1:2)},r):r)}))}
$('btn-import').onclick=()=>$('file-import').click();
$('file-import').onchange=e=>{if(e.target.files.length)importFiles(e.target.files);e.target.value=''};
/* ---------- export ---------- */
function exportCSV(){const b=curBook();const rows=[['book','date','type','category','note','method','amount']];
  Object.values(curTxs()).sort((a,c)=>(a.date||'').localeCompare(c.date||'')).forEach(t=>
    rows.push(['"'+(b?b.name:'').replace(/"/g,'""')+'"',t.date,t.type,'"'+(t.category||'').replace(/"/g,'""')+'"','"'+(t.note||'').replace(/"/g,'""')+'"',t.method,t.amount]));
  const blob=new Blob([rows.map(r=>r.join(',')).join('\n')],{type:'text/csv'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);
  a.download='cashbook-'+(b?b.name.replace(/\s+/g,'-'):'book')+'-'+state.monthKey+'.csv';a.click();toast('CSV exported','success')}
$('btn-export').onclick=exportCSV;$('btn-export2').onclick=exportCSV;
/* ---------- nav ---------- */
document.querySelectorAll('.bottom-nav-item').forEach(x=>x.onclick=()=>navigate(x.dataset.page));
function newEntry(type){state.editId=null;setType(type||'out');$('save-tx-btn').textContent='Save Entry';
  $('cancel-edit-btn').style.display='none';$('f-amount').value='';$('f-note').value='';navigate('add')}
$('go-add-in').onclick=()=>newEntry('in');
$('go-add-out').onclick=()=>newEntry('out');
$('dlg').addEventListener('click',e=>{if(e.target.id==='dlg')closeDlg()});
setType('out');
})();
