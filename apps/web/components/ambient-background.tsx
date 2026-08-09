"use client";

import { useEffect, useRef } from "react";

const vertexShader = `
  attribute vec2 p;
  void main(){ gl_Position=vec4(p,0.0,1.0); }
`;

const fragmentShader = `
  precision highp float;
  uniform vec2 r;
  uniform vec2 m;
  uniform float t;

  float hash21(vec2 p){
    p = fract(p*vec2(123.34,456.21));
    p += dot(p,p+45.32);
    return fract(p.x*p.y);
  }

  float noise(vec2 p){
    vec2 i=floor(p), f=fract(p);
    f=f*f*(3.0-2.0*f);
    return mix(
      mix(hash21(i),hash21(i+vec2(1.,0.)),f.x),
      mix(hash21(i+vec2(0.,1.)),hash21(i+vec2(1.,1.)),f.x),f.y
    );
  }

  float fbm(vec2 p){
    float s=0.,a=.5;
    mat2 q=mat2(.80,-.60,.60,.80);
    for(int i=0;i<5;i++){
      s += a*noise(p);
      p = q*p*2.05 + 1.7;
      a *= .48;
    }
    return s;
  }

  void main(){
    vec2 uv=(gl_FragCoord.xy-.5*r.xy)/r.y;
    vec2 mouse=(m-.5*r.xy)/r.y;

    float tt = mod(t, 24.0);
    vec2 p = uv;
    p.x += .10*sin(p.y*2.8 + tt*.20);
    p.y += .06*cos(p.x*3.2 - tt*.16);

    float field = 0.0;
    float glow = 0.0;

    for(int i=0;i<7;i++){
      float fi=float(i);
      float z = fract(fi/7.0 + tt*.045);
      float scale = mix(1.1,5.6,z);
      float fade = smoothstep(0.,.18,z)*(1.-smoothstep(.76,1.,z));

      vec2 q = p*scale;
      q.x += sin(q.y*1.18 + fi*1.71 + tt*.11)*.22;
      q.y += sin(q.x*.77 - fi*1.13 - tt*.09)*.15;

      float n = fbm(q*.62 + vec2(fi*2.1,-tt*.025));
      float contour = abs(fract(n*5.0 + z*2.2)-.5);
      float line = exp(-55.0*contour);

      field += line*fade/scale;
      glow  += exp(-9.0*contour)*fade/scale;
    }

    float n2=fbm(p*3.2+vec2(tt*.018,-tt*.024));
    float threads=pow(max(0.,.5-abs(fract(n2*11.0)-.5))*2.0,8.0);

    vec2 c=vec2(.34,.0);
    float d=length(uv-c);
    float ring=exp(-95.0*abs(d-.31))*0.16;
    float inner=exp(-5.5*d*d)*.13;
    float cursor=exp(-5.8*dot(uv-mouse*.28,uv-mouse*.28));

    float ang=atan(uv.y-c.y,uv.x-c.x);
    float rays=pow(.5+.5*sin(ang*26.0 + tt*.55 + fbm(uv*4.0)*4.0),18.0);
    rays*=exp(-2.1*d)*.08;

    vec3 col=vec3(.017,.027,.020);
    col += vec3(.035,.23,.055)*field*2.4;
    col += vec3(.025,.105,.034)*glow*.48;
    col += vec3(.055,.28,.07)*threads*.18;
    col += vec3(.075,.32,.085)*ring;
    col += vec3(.025,.10,.035)*inner;
    col += vec3(.055,.22,.065)*rays;
    col += vec3(.025,.085,.032)*cursor*.10;

    float sweep=exp(-75.0*abs(uv.y-.17*sin(tt*.22)-.03))*0.035;
    col += vec3(.05,.22,.06)*sweep;

    float v=1.0-smoothstep(.45,1.16,length(uv*vec2(.68,1.0)));
    col*=.72+.28*v;

    gl_FragColor=vec4(col,1.);
  }
`;

export function AmbientBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl", {
      alpha: false,
      antialias: false,
      powerPreference: "high-performance",
    });
    if (!gl) return;

    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const vertex = compile(gl.VERTEX_SHADER, vertexShader);
    const fragment = compile(gl.FRAGMENT_SHADER, fragmentShader);
    const program = gl.createProgram();
    if (!vertex || !fragment || !program) return;

    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );

    const position = gl.getAttribLocation(program, "p");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    const resolution = gl.getUniformLocation(program, "r");
    const mousePosition = gl.getUniformLocation(program, "m");
    const time = gl.getUniformLocation(program, "t");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const mouse = { x: window.innerWidth * 0.7, y: window.innerHeight * 0.52 };
    let animationFrame = 0;

    const onPointerMove = (event: PointerEvent) => {
      mouse.x = event.clientX;
      mouse.y = window.innerHeight - event.clientY;
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.6);
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      gl.viewport(0, 0, canvas.width, canvas.height);
    };

    const start = performance.now();
    const draw = (now: number) => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.6);
      gl.uniform2f(resolution, canvas.width, canvas.height);
      gl.uniform2f(mousePosition, mouse.x * dpr, mouse.y * dpr);
      gl.uniform1f(time, reducedMotion ? 4.5 : (now - start) / 1000);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      if (!reducedMotion) animationFrame = window.requestAnimationFrame(draw);
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("resize", resize, { passive: true });
    resize();
    animationFrame = window.requestAnimationFrame(draw);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("resize", resize);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
    };
  }, []);

  return (
    <div className="ambient-background" aria-hidden="true">
      <canvas ref={canvasRef} className="ambient-background-shader" />
      <div className="ambient-background-vignette" />
      <div className="ambient-background-noise" />
    </div>
  );
}
