/* Cashbook Web v1.1 — multi-book + editable categories */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const DEFAULT_CATS={in:['Sales','Service','Salary','Gift','Loan In','Other Income'],
  out:['Food','Transport','Shopping','Bills','Rent','Health','Education','Salary Paid','Loan Out','Other']};
const state={user:null,demo:false,books:{},current:null,filter:'all',search:'',
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
  $('fab-add').style.display=(page==='home')?'flex':'none';
  $('page-title').textContent={home:'Cashbook',books:'My Books',add:state.editId?'Edit Entry':'Add Entry',reports:'Reports',settings:'Settings'}[page]||'Cashbook';
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
  document.documentElement.dataset.theme=!dark?'light':(oled?'oled':'dark');
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
$('create-book-btn').onclick=()=>{const v=$('new-book-name').value.trim();if(!v)return toast('Enter book name','error');
  createBook(v);$('new-book-name').value='';toast('Book created','success')};
function bookBalance(id){let i=0,o=0;Object.values((state.books[id]||{}).transactions||{}).forEach(t=>{t.type==='in'?i+=+t.amount||0:o+=+t.amount||0});return{i,o,net:i-o}}
function renderBooks(){const box=$('book-list');if(!box)return;box.innerHTML='';
  Object.entries(state.books).forEach(([id,b])=>{const bal=bookBalance(id);
    const n=Object.keys(b.transactions||{}).length;
    const row=document.createElement('div');row.className='book-row'+(id===state.current?' active':'');
    row.innerHTML='<span class="material-icons-round" style="color:var(--primary2)">book</span>'+
      '<strong>'+esc(b.name)+'</strong><small>'+n+' entries • '+fmtMoney(bal.net)+'</small>';
    const open=document.createElement('button');open.className='icon-mini';open.title='Open';
    open.innerHTML='<span class="material-icons-round">open_in_new</span>';open.onclick=()=>switchBook(id);
    const ed=document.createElement('button');ed.className='icon-mini';ed.title='Rename';
    ed.innerHTML='<span class="material-icons-round">edit</span>';ed.onclick=()=>promptDlg('Rename book',b.name,v=>{renameBook(id,v);renderBooks()});
    const del=document.createElement('button');del.className='icon-mini danger';del.title='Delete';
    del.innerHTML='<span class="material-icons-round">delete</span>';del.onclick=()=>deleteBook(id);
    row.append(open,ed,del);box.appendChild(row)})}
/* ---------- entries ---------- */
$('cancel-edit-btn').onclick=()=>{state.editId=null;$('cancel-edit-btn').style.display='none';$('save-tx-btn').textContent='Save Entry';navigate('home')};
$('save-tx-btn').onclick=saveTx;
function txPath(){if(state.demo)return null;
  return firebase.database().ref('cashbook/'+uid()+'/books/'+state.current+'/transactions')}
function saveTx(){if(!state.current)return toast('Create a book first','error');
  const amt=parseFloat($('f-amount').value);if(!(amt>0))return toast('Enter a valid amount','error');
  const tx={type:state.entryType,amount:Math.round(amt*100)/100,category:selectedCat(),
    note:$('f-note').value.trim(),method:$('f-method').value,date:$('f-date').value||new Date().toISOString().slice(0,10),createdAt:Date.now()};
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
/* ---------- list/dashboard ---------- */
document.querySelectorAll('.filter-btn').forEach(b=>b.onclick=()=>{state.filter=b.dataset.filter;
  document.querySelectorAll('.filter-btn').forEach(x=>x.classList.toggle('active',x===b));render()});
$('search-input').oninput=e=>{state.search=e.target.value.toLowerCase();render()};
$('month-pick').onclick=()=>{const m=$('month-hidden');m.value=state.monthKey;
  m.onchange=()=>{if(m.value)state.monthKey=m.value;render()};if(m.showPicker)m.showPicker();else m.focus()};
$('btn-refresh').onclick=()=>render();
function monthTxs(){return Object.entries(curTxs()).filter(([,t])=>(t.date||'').slice(0,7)===state.monthKey)}
function render(){if(!state.user)return;const b=curBook();
  $('book-name-text').textContent=b?b.name:'—';
  $('dash-month').textContent=fmtMonth(state.monthKey);$('page-sub').textContent=fmtMonth(state.monthKey)+(b?' • '+b.name:'');
  const mtx=monthTxs();let tin=0,tout=0;
  mtx.forEach(([,t])=>{t.type==='in'?tin+=+t.amount||0:tout+=+t.amount||0});
  $('dash-in').textContent=fmtMoney(tin);$('dash-out').textContent=fmtMoney(tout);
  $('dash-balance').textContent=fmtMoney(tin-tout);
  let rows=mtx.filter(([,t])=>state.filter==='all'||t.type===state.filter);
  if(state.search)rows=rows.filter(([,t])=>((t.note||'')+' '+(t.category||'')).toLowerCase().includes(state.search));
  rows.sort((a,c)=>(c[1].date||'').localeCompare(a[1].date||'')||((c[1].createdAt||0)-(a[1].createdAt||0)));
  const box=$('tx-list');box.innerHTML='';
  if(!rows.length)box.innerHTML='<div class="empty">No entries in <b>'+esc(b?b.name:'')+'</b> this month.<br>Tap + Add to record cash in / out.</div>';
  let lastDay='';
  rows.forEach(([id,t])=>{if(t.date!==lastDay){lastDay=t.date;
      const g=document.createElement('div');g.className='day-group';
      const day=rows.filter(([,x])=>x.date===lastDay);let dIn=0,dOut=0;
      day.forEach(([,x])=>x.type==='in'?dIn+=+x.amount:dOut+=+x.amount);
      g.innerHTML='<div class="day-head"><span>'+fmtDate(lastDay)+'</span><span>In '+fmtMoney(dIn)+' • Out '+fmtMoney(dOut)+'</span></div>';
      g.id='g-'+lastDay;box.appendChild(g)}
    const el=document.createElement('div');el.className='tx';
    el.innerHTML='<div class="tx-ic '+t.type+'"><span class="material-icons-round">'+(t.type==='in'?'arrow_downward':'arrow_upward')+'</span></div>'+
      '<div class="tx-mid"><strong>'+esc(t.category||(t.type==='in'?'Cash In':'Cash Out'))+'</strong><small>'+esc(t.note||t.method||'')+' • '+esc(t.method||'')+'</small></div>'+
      '<div class="tx-amt '+t.type+'">'+(t.type==='in'?'+':'−')+' '+fmtMoney(t.amount)+'</div>';
    const menu=document.createElement('button');menu.className='tx-menu';
    menu.innerHTML='<span class="material-icons-round">more_vert</span>';menu.onclick=()=>txMenu(id);el.appendChild(menu);
    ($('g-'+CSS.escape(lastDay))||box).appendChild(el)});
  renderReports(mtx,tin,tout);if($('page-books').classList.contains('active'))renderBooks()}
function txMenu(id){const o=$('modal-overlay');$('modal-title').textContent='Entry options';
  $('modal-body').innerHTML='<p style="color:var(--sub);font-size:13px">Edit or delete this transaction.</p>';
  const F=$('modal-footer');F.innerHTML='';
  const e=document.createElement('button');e.className='btn-cancel';e.textContent='Edit';e.onclick=()=>{o.classList.remove('active');editTx(id)};
  const d=document.createElement('button');d.className='btn-danger';d.textContent='Delete';d.onclick=()=>{o.classList.remove('active');delTx(id)};
  const c=document.createElement('button');c.className='btn-cancel';c.textContent='Close';c.onclick=()=>o.classList.remove('active');
  F.append(e,d,c);o.classList.add('active');o.onclick=ev=>{if(ev.target===o)o.classList.remove('active')}}
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
$('fab-add').onclick=()=>{state.editId=null;$('save-tx-btn').textContent='Save Entry';
  $('cancel-edit-btn').style.display='none';$('f-amount').value='';$('f-note').value='';navigate('add')};
$('dlg').addEventListener('click',e=>{if(e.target.id==='dlg')closeDlg()});
setType('out');
})();
