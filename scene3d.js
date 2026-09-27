(() => {
  const vertexShader = `
    attribute vec3 aPosition;
    attribute vec3 aNormal;
    uniform mat4 uProjection;
    uniform mat4 uView;
    uniform mat4 uModel;
    uniform vec3 uLight;
    varying float vLight;
    void main() {
      vec3 normal = normalize(mat3(uModel) * aNormal);
      vLight = 0.43 + 0.66 * max(dot(normal, normalize(uLight)), 0.0);
      gl_Position = uProjection * uView * uModel * vec4(aPosition, 1.0);
    }
  `;
  const fragmentShader = `
    precision mediump float;
    uniform vec3 uColor;
    uniform float uGlow;
    varying float vLight;
    void main() {
      vec3 shaded = uColor * vLight;
      gl_FragColor = vec4(mix(shaded, uColor, uGlow), 1.0);
    }
  `;

  function multiply(a, b) {
    const out = new Float32Array(16);
    for (let column = 0; column < 4; column += 1) {
      for (let row = 0; row < 4; row += 1) {
        out[column * 4 + row] = a[row] * b[column * 4] + a[4 + row] * b[column * 4 + 1] + a[8 + row] * b[column * 4 + 2] + a[12 + row] * b[column * 4 + 3];
      }
    }
    return out;
  }
  function translation(x, y, z) { return new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, x,y,z,1]); }
  function scaleMatrix(x, y, z) { return new Float32Array([x,0,0,0, 0,y,0,0, 0,0,z,0, 0,0,0,1]); }
  function rotateX(a) { const c=Math.cos(a),s=Math.sin(a); return new Float32Array([1,0,0,0, 0,c,s,0, 0,-s,c,0, 0,0,0,1]); }
  function rotateY(a) { const c=Math.cos(a),s=Math.sin(a); return new Float32Array([c,0,-s,0, 0,1,0,0, s,0,c,0, 0,0,0,1]); }
  function rotateZ(a) { const c=Math.cos(a),s=Math.sin(a); return new Float32Array([c,s,0,0, -s,c,0,0, 0,0,1,0, 0,0,0,1]); }
  function modelMatrix(position, rotation, scale) {
    let matrix = translation(...position);
    matrix = multiply(matrix, rotateY(rotation[1]));
    matrix = multiply(matrix, rotateX(rotation[0]));
    matrix = multiply(matrix, rotateZ(rotation[2]));
    return multiply(matrix, scaleMatrix(...scale));
  }
  function normalize(v) { const length = Math.hypot(...v) || 1; return v.map((value) => value / length); }
  function dot(a, b) { return a[0]*b[0] + a[1]*b[1] + a[2]*b[2]; }
  function cross(a, b) { return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]; }
  function lookAt(eye, target, up) {
    const z = normalize([eye[0]-target[0], eye[1]-target[1], eye[2]-target[2]]);
    const x = normalize(cross(up, z));
    const y = cross(z, x);
    return new Float32Array([x[0],y[0],z[0],0, x[1],y[1],z[1],0, x[2],y[2],z[2],0, -dot(x,eye),-dot(y,eye),-dot(z,eye),1]);
  }
  function perspective(fov, aspect, near, far) {
    const f = 1 / Math.tan(fov / 2);
    return new Float32Array([f/aspect,0,0,0, 0,f,0,0, 0,0,(far+near)/(near-far),-1, 0,0,(2*far*near)/(near-far),0]);
  }
  function color(hex) {
    const value = hex.replace('#', '');
    return [0,2,4].map((index) => parseInt(value.slice(index,index+2),16)/255);
  }

  function sphereGeometry(rows = 10, columns = 14) {
    const positions=[]; const normals=[]; const indices=[];
    for(let row=0;row<=rows;row+=1) {
      const latitude=Math.PI*row/rows;
      for(let col=0;col<=columns;col+=1) {
        const longitude=2*Math.PI*col/columns;
        const x=-Math.cos(longitude)*Math.sin(latitude), y=Math.cos(latitude), z=Math.sin(longitude)*Math.sin(latitude);
        positions.push(x,y,z); normals.push(x,y,z);
      }
    }
    for(let row=0;row<rows;row+=1) for(let col=0;col<columns;col+=1) {
      const a=row*(columns+1)+col,b=a+columns+1;
      indices.push(a,b,a+1,b,b+1,a+1);
    }
    return {positions,normals,indices};
  }
  function boxGeometry() {
    const faces=[
      [[0,0,1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]], [[0,0,-1],[1,-1,-1],[-1,-1,-1],[-1,1,-1],[1,1,-1]],
      [[1,0,0],[1,-1,1],[1,-1,-1],[1,1,-1],[1,1,1]], [[-1,0,0],[-1,-1,-1],[-1,-1,1],[-1,1,1],[-1,1,-1]],
      [[0,1,0],[-1,1,1],[1,1,1],[1,1,-1],[-1,1,-1]], [[0,-1,0],[-1,-1,-1],[1,-1,-1],[1,-1,1],[-1,-1,1]],
    ];
    const positions=[]; const normals=[]; const indices=[];
    faces.forEach(([normal,...points])=>{ const base=positions.length/3; points.forEach((point)=>{positions.push(...point);normals.push(...normal);}); indices.push(base,base+1,base+2,base,base+2,base+3); });
    return {positions,normals,indices};
  }
  function cylinderGeometry(segments = 12, topRadius = 1, bottomRadius = 1) {
    const positions=[]; const normals=[]; const indices=[];
    for(let index=0;index<=segments;index+=1) {
      const angle=index/segments*Math.PI*2; const x=Math.cos(angle),z=Math.sin(angle);
      positions.push(bottomRadius*x,-1,bottomRadius*z, topRadius*x,1,topRadius*z);
      const slope=bottomRadius-topRadius; const normal=normalize([x,slope/2,z]); normals.push(...normal,...normal);
    }
    for(let index=0;index<segments;index+=1) { const base=index*2; indices.push(base,base+1,base+2,base+1,base+3,base+2); }
    for(const [radius,y,reverse] of [[bottomRadius,-1,true],[topRadius,1,false]]) {
      const center=positions.length/3; positions.push(0,y,0); normals.push(0,reverse?-1:1,0);
      for(let index=0;index<=segments;index+=1) { const angle=index/segments*Math.PI*2; positions.push(radius*Math.cos(angle),y,radius*Math.sin(angle)); normals.push(0,reverse?-1:1,0); }
      for(let index=0;index<segments;index+=1) { const rim=center+index+1; indices.push(center,reverse?rim:rim+1,reverse?rim+1:rim); }
    }
    return {positions,normals,indices};
  }
  function torusGeometry(segments = 18, sides = 7) {
    const positions=[]; const normals=[]; const indices=[]; const radius=.9; const tube=.1;
    for(let index=0;index<=segments;index+=1) {
      const around=index/segments*Math.PI*2;
      for(let side=0;side<=sides;side+=1) {
        const radial=side/sides*Math.PI*2; const cosine=Math.cos(radial),sine=Math.sin(radial);
        const normal=[Math.cos(around)*cosine,sine,Math.sin(around)*cosine];
        positions.push((radius+tube*cosine)*Math.cos(around),tube*sine,(radius+tube*cosine)*Math.sin(around)); normals.push(...normal);
      }
    }
    for(let index=0;index<segments;index+=1) for(let side=0;side<sides;side+=1) {
      const a=index*(sides+1)+side,b=a+sides+1; indices.push(a,a+1,b,b,a+1,b+1);
    }
    return {positions,normals,indices};
  }

  class TideScene {
    constructor(canvas) {
      this.canvas=canvas; this.gl=canvas.getContext('webgl',{alpha:false,antialias:true,powerPreference:'low-power'});
      this.mode='title'; this.party=[]; this.enemy=null; this.activeId=null; this.effect=null; this.focusId=null; this.meshes={}; this.time=0; this.fallback=!this.gl;
      this.reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if(this.gl){try{this.init();}catch(error){this.fallback=true;console.warn('Tidebound 3D renderer unavailable:',error);}}
      this.frame=(time)=>{ if(!this.reducedMotion)this.time=time*.001; if(this.canvas.getClientRects().length) this.draw(); requestAnimationFrame(this.frame); };
      requestAnimationFrame(this.frame);
    }
    init() {
      const gl=this.gl;
      const compile=(type,source)=>{ const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(shader));return shader; };
      const program=gl.createProgram();gl.attachShader(program,compile(gl.VERTEX_SHADER,vertexShader));gl.attachShader(program,compile(gl.FRAGMENT_SHADER,fragmentShader));gl.linkProgram(program);
      if(!gl.getProgramParameter(program,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
      gl.useProgram(program); this.program=program;
      this.attributes={position:gl.getAttribLocation(program,'aPosition'),normal:gl.getAttribLocation(program,'aNormal')};
      this.uniforms={projection:gl.getUniformLocation(program,'uProjection'),view:gl.getUniformLocation(program,'uView'),model:gl.getUniformLocation(program,'uModel'),color:gl.getUniformLocation(program,'uColor'),glow:gl.getUniformLocation(program,'uGlow'),light:gl.getUniformLocation(program,'uLight')};
      gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);gl.cullFace(gl.BACK);
      this.mesh('sphere',sphereGeometry());this.mesh('box',boxGeometry());this.mesh('cylinder',cylinderGeometry());this.mesh('cone',cylinderGeometry(12,0,1));this.mesh('ring',torusGeometry());
    }
    mesh(name,geometry) {
      const gl=this.gl;const entry={count:geometry.indices.length};
      entry.position=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,entry.position);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(geometry.positions),gl.STATIC_DRAW);
      entry.normal=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,entry.normal);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(geometry.normals),gl.STATIC_DRAW);
      entry.index=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,entry.index);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(geometry.indices),gl.STATIC_DRAW);
      this.meshes[name]=entry;
    }
    setMode(mode) { this.mode=mode; }
    setFocus(id) { this.focusId=id; }
    setState(party,enemy,activeId) {
      if(this.lastEnemyHp>0&&enemy?.hp<=0)this.enemyDefeatAt=this.time;
      this.lastEnemyHp=enemy?.hp??null;
      this.party=party;this.enemy=enemy;this.activeId=activeId;
    }
    animate(source,target,kind='strike') { this.effect=this.reducedMotion?null:{source,target,kind,start:this.time,duration:kind==='cast'?.9:.62}; }
    resize() {
      const ratio=Math.min(window.devicePixelRatio||1,1.6);const width=Math.round(this.canvas.clientWidth*ratio),height=Math.round(this.canvas.clientHeight*ratio);
      if(this.canvas.width!==width||this.canvas.height!==height){this.canvas.width=width;this.canvas.height=height;}
      this.gl.viewport(0,0,width,height);
    }
    draw() {
      if(this.fallback){this.drawFallback();return;}
      const gl=this.gl;this.resize();gl.clearColor(.055,.11,.13,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(this.program);
      const aspect=this.canvas.width/Math.max(1,this.canvas.height);
      const wideEye=this.mode==='title'?[0,4.6,10.8]:[0,6.1,aspect<1.1?16.4:13.7];
      const wideTarget=this.mode==='title'?[0,1.05,0]:[0,.95,0];
      const focuses={kael:[-3.05,1.3,.45],ilea:[-4.32,1.3,-.52],ren:[-4.05,1.3,1.25],brinebound:[3.22,1.3,-.18]};
      const focus=this.mode==='battle'&&this.focusId?focuses[this.focusId]:null;
      const desiredTarget=focus||wideTarget;
      const desiredEye=focus?[focus[0]*.76,3.6,focus[2]+7.3]:wideEye;
      if(!this.cameraEye){this.cameraEye=[...desiredEye];this.cameraTarget=[...desiredTarget];}
      const delta=this.lastCameraTime===undefined?0:Math.min(.1,this.time-this.lastCameraTime);this.lastCameraTime=this.time;
      const blend=this.reducedMotion?1:1-Math.exp(-delta*4.6);
      this.cameraEye=this.cameraEye.map((value,index)=>value+(desiredEye[index]-value)*blend);
      this.cameraTarget=this.cameraTarget.map((value,index)=>value+(desiredTarget[index]-value)*blend);
      const shake=this.effect&&['strike','enemy'].includes(this.effect.kind)?Math.sin(this.time*58)*Math.max(0,1-(this.time-this.effect.start)/this.effect.duration)*.035:0;
      const eye=[this.cameraEye[0]+shake,this.cameraEye[1],this.cameraEye[2]];const target=[this.cameraTarget[0]+shake,this.cameraTarget[1],this.cameraTarget[2]];
      gl.uniformMatrix4fv(this.uniforms.projection,false,perspective(this.mode==='title'?.7:.68,aspect,.1,50));
      gl.uniformMatrix4fv(this.uniforms.view,false,lookAt(eye,target,[0,1,0]));
      gl.uniform3fv(this.uniforms.light,new Float32Array([-.4,.85,.33]));
      this.drawWorld();
    }
    drawObject(mesh,position,rotation,scale,hex,glow=0) {
      const gl=this.gl;const item=this.meshes[mesh];if(!item)return;
      gl.bindBuffer(gl.ARRAY_BUFFER,item.position);gl.enableVertexAttribArray(this.attributes.position);gl.vertexAttribPointer(this.attributes.position,3,gl.FLOAT,false,0,0);
      gl.bindBuffer(gl.ARRAY_BUFFER,item.normal);gl.enableVertexAttribArray(this.attributes.normal);gl.vertexAttribPointer(this.attributes.normal,3,gl.FLOAT,false,0,0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,item.index);gl.uniformMatrix4fv(this.uniforms.model,false,modelMatrix(position,rotation,scale));gl.uniform3fv(this.uniforms.color,new Float32Array(color(hex)));gl.uniform1f(this.uniforms.glow,glow);gl.drawElements(gl.TRIANGLES,item.count,gl.UNSIGNED_SHORT,0);
    }
    drawWorld() {
      const t=this.time;
      this.drawObject('box',[0,-.68,-1.7],[0,0,0],[12,.22,12],'#12343b');
      this.drawObject('cylinder',[0,-.23,0],[0,0,0],[5.7,.43,4.15],'#455c50');
      this.drawObject('ring',[0,.207,0],[0,0,0],[5.62,.18,4.1],'#89c6b2',.35);
      this.drawObject('cylinder',[0,.06,0],[0,0,0],[5.47,.12,3.93],'#62745a');
      this.drawObject('sphere',[0,.08,-3.7],[0,0,0],[6.7,1.6,.32],'#1a3438');
      this.drawObject('sphere',[-4,.1,-3.3],[0,0,0],[1.3,1.05,.6],'#203b3c');
      this.drawObject('sphere',[4.3,.1,-4],[0,0,0],[1.8,1.45,.5],'#19383b');
      this.drawObject('cone',[-4.4,.85,-3.5],[0,0,-.14],[.55,1.35,.55],'#31504b');
      this.drawObject('cone',[4.5,.95,-3.8],[0,0,.17],[.7,1.55,.7],'#31514b');
      this.drawObject('sphere',[3.9,5.05,-5.5],[0,0,0],[.9,.9,.9],'#d9dfc1',.76);
      for(let i=0;i<11;i+=1){const x=-5.1+i*.98;const z=-2.1+Math.sin(i*2.4)*.48;this.drawObject('cone',[x,.26,z],[0,0,((i%3)-1)*.12],[.09+(.5+.5*Math.sin(i))*0.07,.2+(.5+.5*Math.cos(i))*0.18,.1],'#6e927d',.06);}
      for(let i=0;i<13;i+=1){const x=-5.6+(i*1.08)%11;const z=4.15+Math.sin(i*1.71)*.8;const wave=Math.sin(t*1.5+i)*.05;this.drawObject('ring',[x,-.39+wave,z],[0,0,0],[.24+(i%3)*.12,.035,.1],'#6eb6a8',.2);}
      if(this.mode==='title') {
        this.drawUnit({id:'traveler',color:'#8bc3aa',hair:'#273a39',mark:'✦',role:'tideguard'},-.15,-.12,.55,0,t,false);
        return;
      }
      for(let i=0;i<this.party.length;i+=1){
        const unit=this.party[i];const spots=[[-3.05,.45],[-4.32,-.52],[-4.05,1.25]][i];
        if(unit.hp<=0)continue;
        const active=this.activeId===unit.id;
        this.drawObject('sphere',[spots[0],.225,spots[1]],[0,0,0],[.53,.035,.36],active?'#b78e4e':'#182f31',.1);
        if(active)this.drawObject('ring',[spots[0],.25,spots[1]],[0,0,0],[.62,.05,.43],unit.color,.62);
        const effect=this.effect&&(this.effect.source===unit.id||this.effect.target===unit.id)?this.effect:null;
        const progress=effect?Math.max(0,1-(t-effect.start)/effect.duration):0;
        const lunge=effect?.source===unit.id&&effect.kind==='strike'?Math.sin(progress*Math.PI)*.83:0;
        const flinch=effect?.target===unit.id&&effect.kind==='enemy'?Math.sin(progress*Math.PI)*.2:0;
        this.drawUnit(unit,spots[0]+lunge-flinch,-.12,spots[1],i,t,active,effect);
      }
      if(this.enemy&&(this.enemy.hp>0||t-(this.enemyDefeatAt||0)<1.2))this.drawEnemy(t);
    }
    drawUnit(unit,x,y,z,index,t,active,effect=null) {
      const idle=Math.sin(t*2.35+index*1.9)*.055;const progress=effect?Math.max(0,1-(t-effect.start)/effect.duration):0;const stride=effect&&effect.source===unit.id&&effect.kind==='strike'?Math.sin(progress*Math.PI)*.52:Math.sin(t*1.8+index)*.06;
      const c=unit.color||'#91c8b4';const dark=unit.hair||'#31453e';const bodyY=y+.98+idle;const sway=Math.sin(t*1.1+index)*.05;
      this.drawObject('cone',[x,bodyY-.23,z-.08],[0,0,sway*.3],[.49,.81,.35],unit.id==='ilea'?'#325b61':unit.id==='ren'?'#714c42':'#69573a');
      this.drawObject('box',[x,bodyY+.24,z],[0,0,sway],[.4,.5,.29],c);
      this.drawObject('sphere',[x,bodyY+.93,z],[0,0,sway*.35],[.27,.31,.25],'#d5c6a1');
      this.drawObject('sphere',[x,bodyY+1.08,z-.015],[0,0,sway*.5],[.29,.18,.27],dark);
      this.drawObject('sphere',[x+.1,bodyY+.94,z+.218],[0,0,0],[.035,.025,.015],'#172729',.25);
      this.drawObject('sphere',[x-.22,bodyY+.25,z],[0,0,sway],[.15,.19,.31],unit.id==='ilea'?'#426a6b':unit.id==='ren'?'#754e43':'#aa8850');
      this.drawObject('cylinder',[x-.17,bodyY-.26,z],[0,0,-stride*.34],[.13,.42,.13],'#253739');
      this.drawObject('cylinder',[x+.17,bodyY-.26,z],[0,0,stride*.34],[.13,.42,.13],'#253739');
      const guarding=effect?.source===unit.id&&effect.kind==='guard'&&progress>0;
      this.drawObject('cylinder',[x-.5,bodyY+.25,z],[0,0,guarding?-.95:-.42+stride*.18],[.11,.36,.11],c);
      this.drawObject('cylinder',[x+.5,bodyY+.25,z],[0,0,guarding?.95:.42-stride*.18],[.11,.36,.11],c);
      this.drawObject('sphere',[x-.65,bodyY-.03,z],[0,0,0],[.13,.13,.13],'#d1bd94');
      this.drawObject('sphere',[x+.65,bodyY-.03,z],[0,0,0],[.13,.13,.13],'#d1bd94');
      if(unit.id==='ilea'){
        this.drawObject('cylinder',[x-.56,bodyY+.22,z],[0,0,-.09],[.045,.94,.045],'#d0bb83',.1);
        this.drawObject('sphere',[x-.56,bodyY+1.2,z],[0,0,0],[.18,.18,.18],'#90e0d2',.75);
      } else if(unit.id==='ren') {
        this.drawObject('ring',[x+.72,bodyY+.22,z],[1.57,0,0],[.34,.32,.1],'#d0a981',.15);
        this.drawObject('cylinder',[x+.72,bodyY+.22,z],[0,0,0],[.018,.39,.018],'#dce2c8',.12);
      } else {
        const swing=effect?.source===unit.id&&effect.kind==='strike'?Math.sin(progress*Math.PI)*1.35:0;
        this.drawObject('box',[x+.68,bodyY+.39,z],[0,0,-.23+swing],[.075,.66,.06],'#d8dfcf',.16);
        this.drawObject('box',[x+.68,bodyY+.17,z],[0,0,-.23+swing],[.2,.035,.08],'#d2b36e',.24);
      }
      if(active||(effect?.kind==='heal'&&progress>0)){
        for(let i=0;i<4;i+=1){const a=t*2+i*Math.PI/2;const radius=.69+Math.sin(t*2+i)*.04;this.drawObject('sphere',[x+Math.cos(a)*radius,bodyY+.45+Math.sin(a*1.3+t)*.35,z+Math.sin(a)*.26],[0,0,0],[.045,.045,.045],effect?.kind==='heal'?'#9cffe0':c,.8);}
      }
    }
    drawEnemy(t) {
      const defeated=this.enemy?.hp<=0?Math.min(1,Math.max(0,(t-(this.enemyDefeatAt||t))/.9)):0;
      const shrink=1-defeated*.68;
      const progress=this.effect?Math.max(0,1-(t-this.effect.start)/this.effect.duration):0;
      const hit=this.effect?.target==='brinebound'&&progress>0;
      const attacking=this.effect?.source==='brinebound'&&progress>0;
      const recoil=hit?Math.sin(progress*Math.PI)*.25:0;
      const lunge=attacking?Math.sin(progress*Math.PI)*.55:0;
      const x=3.22+recoil-lunge,y=.11+Math.sin(t*1.6)*.045-defeated*.9,z=-.18;
      const S=(a,b,c)=>[a*shrink,b*shrink,c*shrink];
      this.drawObject('sphere',[x,y+1.1*shrink,z],[0,0,Math.sin(t*1.5)*.035],[1.03*shrink,1.06*shrink,.84*shrink],'#304943');
      this.drawObject('sphere',[x+.08*shrink,y+1.48*shrink,z-.08],[0,0,0],S(1.11,.68,.86),'#526a58');
      this.drawObject('sphere',[x+.36*shrink,y+1.53*shrink,z+.69],[0,0,0],S(.095,.06,.035),'#f2c77d',.88);
      this.drawObject('sphere',[x-.05*shrink,y+1.53*shrink,z+.69],[0,0,0],S(.095,.06,.035),'#f2c77d',.88);
      this.drawObject('cone',[x-.55*shrink,y+1.95*shrink,z],[0,0,.46],S(.31,.72,.32),'#789078');
      this.drawObject('cone',[x+.59*shrink,y+1.91*shrink,z],[0,0,-.55],S(.3,.7,.3),'#718873');
      for(let side of [-1,1]){
        this.drawObject('sphere',[x+side*.91*shrink,y+.83*shrink,z],[0,0,side*.27],[.43*shrink,.27*shrink,.32*shrink],'#3f5a50');
        this.drawObject('cylinder',[x+side*1.05*shrink,y+.47*shrink,z+side*.13],[0,0,side*.94+Math.sin(t*2+side)*.18],[.19*shrink,.56*shrink,.18*shrink],'#344d48');
        this.drawObject('cone',[x+side*1.46*shrink,y+.16*shrink,z+side*.2],[0,0,Math.PI+side*.4],[.24*shrink,.38*shrink,.22*shrink],'#516958');
      }
      this.drawObject('ring',[x,y+.23,z],[0,0,0],[1.27,.05,.72],'#31504b',.15);
    }
    drawFallback() {
      const ctx=this.canvas.getContext('2d');if(!ctx)return;const w=this.canvas.width=this.canvas.clientWidth,h=this.canvas.height=this.canvas.clientHeight;ctx.fillStyle='#163038';ctx.fillRect(0,0,w,h);ctx.fillStyle='#234448';ctx.beginPath();ctx.ellipse(w*.5,h*.83,w*.48,h*.24,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#d8ddc5';ctx.globalAlpha=.8;ctx.beginPath();ctx.arc(w*.77,h*.21,Math.min(w,h)*.07,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
      const units=this.mode==='title'?[{id:'traveler',name:'',color:'#8bc3aa',hair:'#273a39'}]:this.party;
      units.forEach((unit,index)=>{if(unit.hp===0)return;const x=this.mode==='title'?w*.5:w*(.21+index*.1);const y=h*.7;ctx.fillStyle=unit.color;ctx.fillRect(x-15,y-66,30,54);ctx.fillStyle='#d5c6a1';ctx.beginPath();ctx.arc(x,y-78,12,0,Math.PI*2);ctx.fill();});
      if(this.mode==='battle'&&this.enemy?.hp>0){ctx.fillStyle='#526a58';ctx.beginPath();ctx.ellipse(w*.78,h*.67,54,62,0,0,Math.PI*2);ctx.fill();}
    }
  }
  window.TideScene=TideScene;
})();
