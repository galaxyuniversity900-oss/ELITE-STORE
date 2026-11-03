/* MES Fabric Ripple + Gravity Lensing: one WebGL texture pass, no overlay graphics. */
(function (global) {
'use strict';
const VS = 'attribute vec2 aPosition; varying vec2 vUv; void main(){vUv=aPosition*0.5+0.5;gl_Position=vec4(aPosition,0.0,1.0);}';
const FS = [
'precision highp float; varying vec2 vUv; uniform sampler2D uTexture;',
'uniform float uTime,uAmplitude,uFrequency,uSpeed,uGrainAmplitude,uGrainFrequency;',
'uniform vec2 uMouse; uniform float uMouseActive,uMouseRadius,uMouseStrength;',
'uniform float uLensEnabled; uniform vec2 uLensPoints[8];',
'uniform float uLensStrength,uLensRadius,uLensSwirl,uLensCount; uniform vec2 uUvMin,uUvMax;',
'void main(){',
' vec2 uv=mix(uUvMin,uUvMax,vUv); float aspect=(uUvMax.x-uUvMin.x)/max(uUvMax.y-uUvMin.y,0.0001); vec2 metric=vec2(max(aspect,0.0001),1.0);',
' float wx=sin(uv.y*uFrequency+uTime*uSpeed)*uAmplitude;',
' float wy=cos(uv.x*uFrequency*0.7+uTime*uSpeed*0.8)*uAmplitude*0.6;',
' float grain=sin(uv.x*uGrainFrequency+uTime*2.0)*sin(uv.y*uGrainFrequency-uTime*1.5)*uGrainAmplitude;',
' vec2 offset=vec2(wx+grain,wy+grain);',
' if(uMouseActive>0.5){vec2 d=(uv-uMouse)*metric;float dist=length(d);float fall=1.0-smoothstep(0.0,max(uMouseRadius,0.0001),dist);offset+=(d/max(dist,0.0001))*fall*uMouseStrength*sin(uTime*4.0-dist*32.0)/metric;}',
' if(uLensEnabled>0.5){for(int i=0;i<8;i++){if(float(i)>=uLensCount)break;vec2 d=(uv-uLensPoints[i])*metric;float dist=max(length(d),0.012);float influence=1.0-smoothstep(0.0,max(uLensRadius,0.0001),dist);float pull=clamp(uLensStrength*influence/(dist*dist+0.035),0.0,uLensStrength*5.0);float angle=uLensSwirl*influence/(dist+0.12);float sn=sin(angle),cs=cos(angle);vec2 rotated=vec2(d.x*cs-d.y*sn,d.x*sn+d.y*cs);vec2 bent=uLensPoints[i]+rotated*(1.0-pull)/metric;offset+=(bent-uv)*influence;}}',
' vec2 sampleUv=clamp(uv+offset,uUvMin,uUvMax);gl_FragColor=texture2D(uTexture,sampleUv);',
'}'
].join('\n');

class FabricRippleEffect {
 constructor(img, options) {
  if (!(img instanceof HTMLImageElement)) throw new TypeError('Expected an HTMLImageElement');
  this.img=img; this.opts=Object.assign({amplitude:0.0055,frequency:5.5,speed:0.9,grainAmp:0.0007,grainFreq:52,mouseRadius:0.28,mouseStrength:0.014,lensEnabled:true,lensStrength:0.018,lensRadius:0.28,lensSwirl:1,lensFollowMouse:true,lensFixedPoint:[0.5,0.5],lensPoints:null,maxDpr:1.5,pauseWhenOffscreen:true},options||{});
  this.mouse={x:0.5,y:0.5,active:false};this.destroyed=false;this.visible=true;this.raf=0;this.start=0;this.oldVisibility=img.style.visibility;
  this.move=this._move.bind(this);this.leave=this._leave.bind(this);this.frame=this._frame.bind(this);
  if(!this._init()){this._fallback();return;}this._events();this._resize();this._observe();this.raf=requestAnimationFrame(this.frame);
 }
 _shader(type,source){const gl=this.gl,s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){const e=gl.getShaderInfoLog(s);gl.deleteShader(s);throw new Error(e);}return s;}
 _init(){
  const img=this.img;if(!img.complete||!img.naturalWidth||!img.naturalHeight||!img.parentNode)return false;
  try{
   const r=img.getBoundingClientRect();if(!r.width||!r.height)return false;
   const c=document.createElement('canvas'),cs=getComputedStyle(img);
   c.className=img.className;c.setAttribute('role','img');c.setAttribute('aria-label',img.alt||'Animated product image');c.dataset.fabricRippleCanvas='true';
   c.style.cssText=img.style.cssText;c.style.width=r.width+'px';c.style.height=r.height+'px';c.style.display=cs.display==='inline'?'inline-block':cs.display;c.style.position=cs.position;c.style.top=cs.top;c.style.right=cs.right;c.style.bottom=cs.bottom;c.style.left=cs.left;c.style.margin=cs.margin;c.style.maxWidth=cs.maxWidth;c.style.maxHeight=cs.maxHeight;c.style.borderRadius=cs.borderRadius;c.style.pointerEvents='auto';
   const gl=c.getContext('webgl',{alpha:true,premultipliedAlpha:true,antialias:false,depth:false,stencil:false,preserveDrawingBuffer:false,powerPreference:'high-performance'});if(!gl)return false;
   this.canvas=c;this.gl=gl;
   const p=gl.createProgram(),v=this._shader(gl.VERTEX_SHADER,VS),f=this._shader(gl.FRAGMENT_SHADER,FS);gl.attachShader(p,v);gl.attachShader(p,f);gl.linkProgram(p);gl.deleteShader(v);gl.deleteShader(f);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));this.program=p;gl.useProgram(p);
   const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);const a=gl.getAttribLocation(p,'aPosition');gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,2,gl.FLOAT,false,0,0);
   this.u={};['uTexture','uTime','uAmplitude','uFrequency','uSpeed','uGrainAmplitude','uGrainFrequency','uMouse','uMouseActive','uMouseRadius','uMouseStrength','uLensEnabled','uLensPoints[0]','uLensStrength','uLensRadius','uLensSwirl','uLensCount','uUvMin','uUvMax'].forEach(n=>this.u[n]=gl.getUniformLocation(p,n));
   this.texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,this.texture);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,img);
   gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
   img.parentNode.insertBefore(c,img);img.style.visibility='hidden';img.dataset.fabricRippleActive='true';return true;
  }catch(e){console.warn('[FabricRippleEffect] WebGL init failed',e);this._restore();return false;}
 }
 _events(){this.canvas.addEventListener('pointermove',this.move,{passive:true});this.canvas.addEventListener('pointerleave',this.leave,{passive:true});this.canvas.addEventListener('pointerdown',this.move,{passive:true});if('ResizeObserver'in global){this.ro=new ResizeObserver(()=>this._resize());this.ro.observe(this.img.parentElement||this.img);}else global.addEventListener('resize',()=>this._resize(),{passive:true});this.canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();this.destroy(true);this._fallback();});}
 _observe(){if('IntersectionObserver'in global&&this.opts.pauseWhenOffscreen){this.io=new IntersectionObserver(es=>{this.visible=!!es[0]&&es[0].isIntersecting;if(this.visible&&!this.raf&&!this.destroyed)this.raf=requestAnimationFrame(this.frame);if(!this.visible&&this.raf){cancelAnimationFrame(this.raf);this.raf=0;}},{rootMargin:'100px'});this.io.observe(this.canvas);}}
 _resize(){if(!this.canvas||this.destroyed)return;const r=this.canvas.getBoundingClientRect();if(!r.width||!r.height)return;const dpr=Math.min(global.devicePixelRatio||1,Number(this.opts.maxDpr)||1.5);this.canvas.width=Math.max(1,Math.round(r.width*dpr));this.canvas.height=Math.max(1,Math.round(r.height*dpr));const ia=this.img.naturalWidth/this.img.naturalHeight,ba=r.width/r.height;this.uvMin=[0,0];this.uvMax=[1,1];if(getComputedStyle(this.img).objectFit==='cover'){if(ia>ba){const s=ba/ia;this.uvMin[0]=(1-s)/2;this.uvMax[0]=this.uvMin[0]+s;}else{const s=ia/ba;this.uvMin[1]=(1-s)/2;this.uvMax[1]=this.uvMin[1]+s;}}}
 _move(e){const r=this.canvas.getBoundingClientRect();this.mouse.x=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width));this.mouse.y=Math.max(0,Math.min(1,1-(e.clientY-r.top)/r.height));this.mouse.active=true;}
 _leave(){this.mouse.active=false;}
 _points(){if(Array.isArray(this.opts.lensPoints)&&this.opts.lensPoints.length)return this.opts.lensPoints.slice(0,8);if(this.opts.lensFollowMouse)return this.mouse.active?[[this.mouse.x,this.mouse.y]]:[];return [this.opts.lensFixedPoint||[0.5,0.5]];}
 _frame(t){if(this.destroyed||!this.gl||!this.visible){this.raf=0;return;}if(!this.start)this.start=t;const gl=this.gl,u=this.u,o=this.opts,tm=(t-this.start)/1000;gl.viewport(0,0,this.canvas.width,this.canvas.height);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.useProgram(this.program);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.texture);
  gl.uniform1i(u.uTexture,0);gl.uniform1f(u.uTime,tm);gl.uniform1f(u.uAmplitude,Number(o.amplitude)||0);gl.uniform1f(u.uFrequency,Number(o.frequency)||6);gl.uniform1f(u.uSpeed,Number(o.speed)||1);gl.uniform1f(u.uGrainAmplitude,Number(o.grainAmp)||0);gl.uniform1f(u.uGrainFrequency,Number(o.grainFreq)||40);gl.uniform2f(u.uMouse,this.mouse.x,this.mouse.y);gl.uniform1f(u.uMouseActive,this.mouse.active?1:0);gl.uniform1f(u.uMouseRadius,Number(o.mouseRadius)||0.3);gl.uniform1f(u.uMouseStrength,Number(o.mouseStrength)||0);
  const pts=this._points(),packed=new Float32Array(16);pts.forEach((p,i)=>{packed[i*2]=Math.max(0,Math.min(1,Number(p[0])||0));packed[i*2+1]=Math.max(0,Math.min(1,Number(p[1])||0));});gl.uniform1f(u.uLensEnabled,o.lensEnabled?1:0);gl.uniform2fv(u['uLensPoints[0]'],packed);gl.uniform1f(u.uLensStrength,Number(o.lensStrength)||0);gl.uniform1f(u.uLensRadius,Number(o.lensRadius)||0.3);gl.uniform1f(u.uLensSwirl,Number(o.lensSwirl)||0);gl.uniform1f(u.uLensCount,pts.length);gl.uniform2f(u.uUvMin,this.uvMin[0],this.uvMin[1]);gl.uniform2f(u.uUvMax,this.uvMax[0],this.uvMax[1]);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);this.raf=requestAnimationFrame(this.frame);
 }
 _fallback(){if(!this.img)return;this.img.style.visibility='visible';this.img.classList.add('fabric-ripple-fallback');if(!document.getElementById('fabric-ripple-fallback-style')){const s=document.createElement('style');s.id='fabric-ripple-fallback-style';s.textContent='@keyframes mesFabricFallback{0%,100%{transform:skewY(0) scale(1)}50%{transform:skewY(.22deg) scale(1.003)}}.fabric-ripple-fallback{animation:mesFabricFallback 4s ease-in-out infinite;transform-origin:center}@media(prefers-reduced-motion:reduce){.fabric-ripple-fallback{animation:none}}';document.head.appendChild(s);}}
 _restore(){if(this.canvas)this.canvas.remove();if(this.img){this.img.style.visibility=this.oldVisibility;delete this.img.dataset.fabricRippleActive;}}
 destroy(){this.destroyed=true;if(this.raf)cancelAnimationFrame(this.raf);if(this.ro)this.ro.disconnect();if(this.io)this.io.disconnect();if(this.gl){if(this.texture)this.gl.deleteTexture(this.texture);if(this.program)this.gl.deleteProgram(this.program);}if(this.canvas)this.canvas.remove();if(this.img){this.img.style.visibility=this.oldVisibility;delete this.img.dataset.fabricRippleActive;}}
}
const mounted=new WeakMap(),defaults={amplitude:0.0055,frequency:5.5,speed:0.9,grainAmp:0.0007,grainFreq:52,mouseRadius:0.28,mouseStrength:0.014,lensEnabled:true,lensStrength:0.018,lensRadius:0.28,lensSwirl:1,lensFollowMouse:true};
function mount(img){if(!(img instanceof HTMLImageElement)||mounted.has(img)||img.dataset.fabricRipple==='off')return;const run=()=>{if(!img.isConnected||mounted.has(img))return;try{mounted.set(img,new FabricRippleEffect(img,Object.assign({},defaults)));}catch(e){console.warn('[MES Fabric Ripple]',e);}};if(img.complete&&img.naturalWidth)run();else img.addEventListener('load',run,{once:true});}
function scan(root){if(root instanceof HTMLImageElement)mount(root);if(root&&root.querySelectorAll)root.querySelectorAll('img[data-fabric-ripple]').forEach(mount);}
global.FabricRippleEffect=FabricRippleEffect;global.MESFabricRipple={mount:mount,scan:scan,instances:mounted};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>scan(document),{once:true});else scan(document);
if('MutationObserver'in global)new MutationObserver(records=>records.forEach(rec=>rec.addedNodes.forEach(n=>{if(n.nodeType===1)scan(n);}))).observe(document.documentElement,{childList:true,subtree:true});
})(window);
