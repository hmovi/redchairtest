/* Red Chair Marketing: motion layer (no dependencies except the self-hosted globe bundle). */
(function(){
'use strict';
var reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
var root=document.documentElement;
var $=function(s,e){return (e||document).querySelector(s)};
var $$=function(s,e){return [].slice.call((e||document).querySelectorAll(s))};
var clamp=function(v,a,b){return Math.max(a,Math.min(b,v))};
var sleep=function(ms){return new Promise(function(r){setTimeout(r,ms)})};
if(!reduce)root.classList.add('rc-motion');

/* ---------- Scroll progress, header, hero parallax ---------- */
var bar=document.createElement('div');bar.id='rc-progress';bar.setAttribute('aria-hidden','true');document.body.appendChild(bar);
var ticking=false;
function onScroll(){
  if(ticking)return;ticking=true;
  requestAnimationFrame(function(){
    var y=window.scrollY||0,h=document.documentElement.scrollHeight-innerHeight;
    bar.style.setProperty('--sp',h>0?clamp(y/h,0,1).toFixed(4):0);
    var hd=$('header');if(hd)hd.classList.toggle('scrolled',y>12);
    if(!reduce){var hero=$('.hero');if(hero&&y<innerHeight*1.2)hero.style.setProperty('--py',(y*0.22).toFixed(1)+'px')}
    ticking=false;
  });
}
addEventListener('scroll',onScroll,{passive:true});addEventListener('resize',onScroll);onScroll();

/* ---------- Magnetic buttons + card spotlight ---------- */
if(matchMedia('(hover:hover)').matches){
  document.addEventListener('pointermove',function(e){
    var t=e.target.closest&&e.target.closest('.btn,.card');if(!t)return;
    var r=t.getBoundingClientRect();
    if(t.classList.contains('btn')&&!reduce){
      var dx=(e.clientX-(r.left+r.width/2))/r.width,dy=(e.clientY-(r.top+r.height/2))/r.height;
      t.style.setProperty('--mx',(dx*10).toFixed(1)+'px');t.style.setProperty('--my',(dy*8).toFixed(1)+'px');
    }else if(t.classList.contains('card')){
      t.style.setProperty('--cx',(e.clientX-r.left)+'px');t.style.setProperty('--cy',(e.clientY-r.top)+'px');
    }
  },{passive:true});
  document.addEventListener('pointerout',function(e){
    var t=e.target.closest&&e.target.closest('.btn');if(t&&!t.contains(e.relatedTarget)){t.style.removeProperty('--mx');t.style.removeProperty('--my')}
  });
}

/* ---------- Reveal on scroll ---------- */
var io=null;
function reveal(){
  if(reduce||!('IntersectionObserver' in window))return;
  if(io)io.disconnect();
  io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}})},{threshold:.1,rootMargin:'0px 0px -5% 0px'});
  var sel='main section:not(.hero):not(.mq-sec) .w>*, main .g>*, main .split>*, main .globe-grid>*, main .ecom-grid>*';
  $$(sel).forEach(function(el,n){
    if(el.closest('.hero')||el.matches('.g,.split,.globe-grid,.ecom-grid,.ec-grid'))return;
    var sib=el.parentNode?[].indexOf.call(el.parentNode.children,el):0;
    el.classList.add('rv');el.style.setProperty('--i',Math.min(sib,5));io.observe(el);
  });
}

/* ---------- Hero headline: word-by-word ---------- */
function splitHero(){
  var h=$('main .hero h1');if(!h||h.dataset.sp)return;h.dataset.sp='1';
  var n=0;
  (function walk(node){
    [].slice.call(node.childNodes).forEach(function(c){
      if(c.nodeType===3){
        var frag=document.createDocumentFragment();
        c.textContent.split(/(\s+)/).forEach(function(tok){
          if(!tok)return;
          if(/^\s+$/.test(tok)){frag.appendChild(document.createTextNode(' '));return}
          var w=document.createElement('span');w.className='wd';var i=document.createElement('span');i.textContent=tok;
          w.style.setProperty('--w',n++);w.appendChild(i);frag.appendChild(w);
        });
        c.parentNode.replaceChild(frag,c);
      }else if(c.nodeType===1)walk(c);
    });
  })(h);
}

/* ---------- Globe ---------- */
var geoP=null;
function loadGeo(){
  if(geoP)return geoP;
  geoP=new Promise(function(res,rej){
    function go(){fetch('assets/globe/land-50m.json').then(function(r){return r.json()}).then(function(t){res(window.RCGeo.feature(t,t.objects.land))}).catch(rej)}
    if(window.RCGeo)return go();
    var s=document.createElement('script');s.src='assets/globe/globe.bundle.js';s.onload=go;s.onerror=rej;document.head.appendChild(s);
  });
  return geoP;
}
var CITIES=[
  {n:'Vancouver',c:[-123.1207,49.2827],t:'Startups, studios, restaurants and retailers competing for local search.'},
  {n:'Squamish',c:[-123.1558,49.7016],t:'Outdoor brands, guides, builders and trades at the start of the Sea to Sky.'},
  {n:'Whistler',c:[-122.9574,50.1163],t:'Resorts, lodges, tour operators and seasonal businesses that need to be found first.'}
];
var STOPS=[
  {id:'all',lon:-128,lat:42,z:.42,spin:true,hold:3200,fly:0,label:'The Sea to Sky corridor',text:'Three places, one local team. Watch the globe fly in.'},
  {id:'reg',lon:-123.15,lat:49.7,z:19,hold:2000,fly:2600,label:'Vancouver to Whistler',text:'About 120 km of highway, ocean and mountains. This is where we live and work.'},
  {id:'van',city:0,lon:-123.1207,lat:49.2827,z:34,hold:3400,fly:1900},
  {id:'squ',city:1,lon:-123.1558,lat:49.7016,z:34,hold:3400,fly:1900},
  {id:'whi',city:2,lon:-122.9574,lat:50.1163,z:34,hold:3400,fly:1900}
];
function initGlobe(){
  var cv=$('#gc');if(!cv||cv.dataset.on)return;cv.dataset.on='1';
  var ctx=cv.getContext('2d'),loading=$('#gl'),info=$('#gi'),tabs=$$('#gt button');
  var land=null,W=0,H=0,dpr=1,size=0;
  var view={lon:-150,lat:42,s:Math.log(1)},stopIdx=0,tween=null,holdUntil=0,visible=false,raf=0,t0=performance.now(),manualUntil=0;
  function resize(){var r=cv.getBoundingClientRect();dpr=Math.min(devicePixelRatio||1,2);W=Math.max(1,r.width);H=Math.max(1,r.height);size=Math.min(W,H);cv.width=Math.round(W*dpr);cv.height=Math.round(H*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);if(land&&(!visible||reduce))draw(performance.now())}
  function S(logz){return size*Math.exp(logz)}
  function setInfo(i){
    var st=STOPS[i],h,p;
    if(st.city!=null){h=CITIES[st.city].n;p=CITIES[st.city].t}else{h=st.label;p=st.text}
    info.classList.remove('sw');void info.offsetWidth;info.classList.add('sw');
    info.innerHTML='<h3></h3><p></p>';info.firstChild.textContent=h;info.lastChild.textContent=p;
    tabs.forEach(function(b){b.setAttribute('aria-pressed',String(+b.dataset.city===st.city))});
  }
  function ease(t){return t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2}
  function flyTo(i,now,instant){
    var st=STOPS[i],lz=Math.log(st.z),dist=Math.hypot(st.lon-view.lon,st.lat-view.lat);
    stopIdx=i;setInfo(i);
    if(instant||!st.fly&&i!==0){view.lon=st.lon;view.lat=st.lat;view.s=lz;tween=null;holdUntil=now+st.hold;return}
    var dur=st.fly||2200;
    tween={a:{lon:view.lon,lat:view.lat,s:view.s},b:{lon:st.lon,lat:st.lat,s:lz},t0:now,dur:dur,arc:clamp(dist/6,.35,1.1)};
    holdUntil=now+dur+st.hold;
  }
  function step(now){
    if(tween){
      var t=clamp((now-tween.t0)/tween.dur,0,1),e=ease(t);
      var dl=tween.b.lon-tween.a.lon;if(dl>180)dl-=360;if(dl<-180)dl+=360;
      view.lon=tween.a.lon+dl*e;view.lat=tween.a.lat+(tween.b.lat-tween.a.lat)*e;
      view.s=tween.a.s+(tween.b.s-tween.a.s)*e-tween.arc*Math.sin(Math.PI*t)*1.1;
      if(t>=1)tween=null;
    }else if(STOPS[stopIdx].spin){view.lon+=0.06;}
    if(now>holdUntil&&now>manualUntil&&!reduce){flyTo((stopIdx+1)%STOPS.length,now)}
  }
  function draw(now){
    var G=window.RCGeo;if(!G||!land)return;
    var sc=S(view.s),proj=G.geoOrthographic().rotate([-view.lon,-view.lat]).scale(sc).translate([W/2,H/2]).clipAngle(90).precision(.3);
    var path=G.geoPath(proj,ctx),far=sc<size*1.4;
    ctx.clearRect(0,0,W,H);
    if(far){var gl=ctx.createRadialGradient(W/2,H/2,sc*.92,W/2,H/2,sc*1.12);gl.addColorStop(0,'rgba(231,184,174,.38)');gl.addColorStop(1,'rgba(231,184,174,0)');ctx.fillStyle=gl;ctx.beginPath();ctx.arc(W/2,H/2,sc*1.12,0,7);ctx.fill()}
    // ocean
    var og=ctx.createRadialGradient(W/2-sc*.3,H/2-sc*.35,sc*.1,W/2,H/2,sc*1.05);og.addColorStop(0,'#27425a');og.addColorStop(1,'#0c1620');
    ctx.fillStyle=og;ctx.beginPath();path({type:'Sphere'});ctx.fill();
    // graticule
    ctx.strokeStyle='rgba(255,255,255,'+(far?.07:.05)+')';ctx.lineWidth=1;ctx.beginPath();path(G.geoGraticule10());ctx.stroke();
    // land
    ctx.beginPath();path(land);ctx.fillStyle='#2f4a3c';ctx.fill();
    ctx.lineWidth=far?.7:1.4;ctx.strokeStyle='rgba(222,196,170,.75)';ctx.stroke();
    // shading
    if(far){var sh=ctx.createRadialGradient(W/2-sc*.25,H/2-sc*.3,sc*.2,W/2,H/2,sc);sh.addColorStop(0,'rgba(255,255,255,.10)');sh.addColorStop(.7,'rgba(0,0,0,0)');sh.addColorStop(1,'rgba(0,0,0,.55)');ctx.fillStyle=sh;ctx.beginPath();path({type:'Sphere'});ctx.fill();
      ctx.strokeStyle='rgba(231,184,174,.55)';ctx.lineWidth=1.5;ctx.beginPath();path({type:'Sphere'});ctx.stroke()}
    // route
    var zl=sc/size,routeA=clamp((zl-6)/6,0,1);
    if(routeA>0){
      ctx.save();ctx.globalAlpha=routeA;ctx.strokeStyle='#E7B8AE';ctx.lineWidth=2;ctx.setLineDash([7,7]);ctx.lineDashOffset=-(now/60)%14;
      ctx.beginPath();path({type:'LineString',coordinates:[CITIES[0].c,CITIES[1].c,CITIES[2].c]});ctx.stroke();ctx.restore();
    }
    // pins
    var active=STOPS[stopIdx].city,tt=now/1000;
    CITIES.forEach(function(c,i){
      if(G.geoDistance(c.c,[view.lon,view.lat])>1.45)return;
      var p=proj(c.c);if(!p)return;
      var lblA=clamp((zl-4)/5,0,1),isA=active===i,R=isA?7:5.5;
      var pr=(tt*0.9+i*.33)%1;
      ctx.beginPath();ctx.arc(p[0],p[1],R+pr*(isA?26:18),0,7);ctx.strokeStyle='rgba(179,60,58,'+(.55*(1-pr))+')';ctx.lineWidth=2;ctx.stroke();
      ctx.beginPath();ctx.arc(p[0],p[1],R+2.5,0,7);ctx.fillStyle='#fff';ctx.fill();
      ctx.beginPath();ctx.arc(p[0],p[1],R,0,7);ctx.fillStyle='#B33C3A';ctx.fill();
      if(lblA>0.02){
        ctx.save();ctx.globalAlpha=lblA;ctx.font='600 '+(isA?17:14)+'px Jost,system-ui,sans-serif';ctx.textBaseline='middle';
        var tw=ctx.measureText(c.n).width,lx=p[0]+R+10,ly=p[1];
        if(lx+tw+16>W)lx=p[0]-R-10-tw-16;
        ctx.fillStyle='rgba(20,17,16,.78)';var bw=tw+16,bh=26;ctx.beginPath();ctx.roundRect?ctx.roundRect(lx,ly-bh/2,bw,bh,13):ctx.rect(lx,ly-bh/2,bw,bh);ctx.fill();
        ctx.fillStyle='#fff';ctx.fillText(c.n,lx+8,ly+.5);ctx.restore();
      }
    });
    if(far){var bc=proj([-123.1,49.3]);if(bc&&G.geoDistance([-123.1,49.3],[view.lon,view.lat])<1.4){/* BC marker handled by Vancouver pin */}}
  }
  function frame(now){
    raf=0;if(!visible||document.hidden)return;
    step(now);draw(now);raf=requestAnimationFrame(frame);
  }
  function start(){if(!raf&&visible&&!reduce)raf=requestAnimationFrame(frame)}
  function manual(ci){
    var idx=STOPS.findIndex(function(s){return s.city===ci}),now=performance.now();
    manualUntil=now+9000;flyTo(idx,now,reduce);holdUntil=now+(STOPS[idx].fly||0)+9000;
    if(reduce){draw(now)}
  }
  tabs.forEach(function(b){b.addEventListener('click',function(){manual(+b.dataset.city)})});
  var ro=window.ResizeObserver?new ResizeObserver(resize):null;if(ro)ro.observe(cv);else addEventListener('resize',resize);
  resize();setInfo(0);
  var vio=new IntersectionObserver(function(es){visible=es[0].isIntersecting;if(visible){if(!land)loadGeo().then(function(l){land=l;loading.classList.add('off');var n=performance.now();if(reduce){flyTo(1,n,true);draw(n)}else{view.lon=-150;flyTo(0,n,true);holdUntil=n+STOPS[0].hold}start()}).catch(function(){loading.textContent='Globe unavailable'});else start()}},{threshold:.15,rootMargin:'120px'});
  vio.observe(cv);
  document.addEventListener('visibilitychange',function(){if(!document.hidden)start()});
}

/* ---------- E-commerce demo ---------- */
function initEcom(){
  var ec=$('#ec');if(!ec||ec.dataset.on)return;ec.dataset.on='1';
  var bar=$('#ecb'),txt=$('#ect'),steps=$$('#ecs li'),prods=$$('.ec-p',ec),cart=$('#ecc'),ord=$('#eco'),rev=$('#ecr'),toast=$('#ect2'),stats=$('.ec-stats',ec),sp=$('#ecpath'),visible=false,looping=false;
  var msgs=['Setting up your store','Adding your products','Connecting payments','Setting shipping and tax','Launching'];
  var money=function(n){return '$'+n.toLocaleString('en-CA',{minimumFractionDigits:0,maximumFractionDigits:0})};
  function alive(){return document.body.contains(ec)}
  function reset(){ec.classList.remove('live');bar.style.transition='none';bar.style.width='0%';steps.forEach(function(s){s.classList.remove('on')});prods.forEach(function(p){p.classList.remove('in','add')});cart.textContent='0';ord.textContent='0';rev.textContent='$0';toast.classList.remove('show');stats.classList.remove('draw');txt.textContent=msgs[0]}
  function finalState(){ec.classList.add('live');prods.forEach(function(p){p.classList.add('in')});cart.textContent='3';ord.textContent='24';rev.textContent='$2,160';stats.classList.add('draw')}
  async function count(el,to,ms,fmt){var s=performance.now();await new Promise(function(r){(function f(n){var t=clamp((n-s)/ms,0,1);el.textContent=fmt(Math.round(to*(1-Math.pow(1-t,3))));if(t<1&&alive())requestAnimationFrame(f);else r()})(s)})}
  async function run(){
    if(looping)return;looping=true;
    while(alive()){
      if(!visible){await sleep(400);continue}
      reset();await sleep(500);
      void bar.offsetWidth;bar.style.transition='width 3.4s cubic-bezier(.4,.1,.2,1)';bar.style.width='100%';
      for(var i=0;i<steps.length&&alive();i++){txt.textContent=msgs[i];steps[i].classList.add('on');await sleep(700)}
      await sleep(350);if(!alive())break;
      ec.classList.add('live');await sleep(500);
      for(var p=0;p<prods.length;p++){prods[p].classList.add('in');await sleep(180)}
      await sleep(500);
      for(var a=0;a<3&&alive();a++){prods[a].classList.add('add');cart.textContent=String(a+1);cart.classList.add('pop');await sleep(260);cart.classList.remove('pop');await sleep(420);prods[a].classList.remove('add')}
      toast.classList.add('show');stats.classList.add('draw');
      await Promise.all([count(ord,24,1800,String),count(rev,2160,1800,money)]);
      await sleep(3200);toast.classList.remove('show');await sleep(500);
      ec.classList.remove('live');await sleep(700);
    }
    looping=false;
  }
  if(reduce){finalState();return}
  var vio=new IntersectionObserver(function(es){visible=es[0].isIntersecting},{threshold:.25});vio.observe(ec);
  run();
}

/* ---------- Mount on every route render ---------- */
var mo=null,lastHTML=null;
function mount(){
  var m=$('#m');if(!m)return;
  m.classList.remove('pg');void m.offsetWidth;if(!reduce)m.classList.add('pg');
  splitHero();reveal();initGlobe();initEcom();onScroll();
}
var m=$('#m');
if(m){
  mo=new MutationObserver(function(){
    // route renders replace #m contents in one go; debounce to the next frame
    if(mount.q)return;mount.q=requestAnimationFrame(function(){mount.q=0;mount()});
  });
  mo.observe(m,{childList:true});
}
mount();
})();
