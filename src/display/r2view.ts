// 2R 3D 表示。見た目・演出は docs/.../mock/2r_mock_3d.html が正。ルール計算はせず、受信状態だけで描く。
import './three-global';
import './three3d/textures.js';
import './three3d/models.js';
import * as THREE from 'three';
import { gsap as G } from 'gsap';
import type { PlateKey } from '../shared/protocol';
import { isReach as seatReach, planTransition, type R2 } from './diff';

/* eslint-disable @typescript-eslint/no-explicit-any */
const HT = (window as any).HarborTextures;
const HM = (window as any).HarborModels;
const LOSE = 2;
const PLATE_C: Record<PlateKey, string> = { red: 'r', blue: 'b', yellow: 'y', green: 'g' };
const pad = (i: number) => String(i + 1).padStart(2, '0');

interface P { n: string; k: string; c: string; o: number; x: number; st: 'play' | 'win' | 'out'; rank: number; holder: boolean }

export interface R2View {
  apply(r2: R2): void;
  resize(): void;
  setActive(on: boolean): void;
}

export function createR2View(stage: HTMLElement, canvas: HTMLCanvasElement, flash: HTMLElement, hud: { label: HTMLElement; left: HTMLElement }): R2View {
  const reducedMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const lite = reducedMotion || /[?&]lite=1/.test(location.search); // 軽量: アニメ即時（確認用・動きを減らす設定）
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !lite, powerPreference: 'high-performance' });
  renderer.setPixelRatio(lite ? 1 : Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = !lite;
  renderer.shadowMap.type = THREE.BasicShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0e2240);
  const camera = new THREE.PerspectiveCamera(28, 16 / 9, 0.1, 60);
  camera.position.set(0, 0.14, 14.1); // 正面固定（design_system.md）
  camera.lookAt(0, 0.14, 0);
  scene.add(new THREE.AmbientLight(0xffffff, 1.05));
  const dirLight = new THREE.DirectionalLight(0xfffaf0, 1.15);
  dirLight.position.set(2.5, 6.0, 12.0);
  dirLight.castShadow = !lite;
  dirLight.shadow.mapSize.set(1024, 1024);
  Object.assign(dirLight.shadow.camera, { near: 1, far: 26, left: -8, right: 8, top: 5, bottom: -5 });
  scene.add(dirLight);
  const fill = new THREE.DirectionalLight(0xeef6ff, 0.42);
  fill.position.set(-3.5, 2.0, 10.0);
  scene.add(fill);

  const shared = HM.createSharedAssets(Math.min(renderer.capabilities.getMaxAnisotropy(), 4));
  HM.createHarborStage(scene, shared.toonMap);

  let S: P[] = [];
  let prev: R2 | null = null;
  let rigs: any[] = [];
  let doneNow = false;
  let timers: number[] = [];
  let active = false;
  let rafId: number | null = null;
  let last = performance.now();
  let fontsReady = false;

  const holderIdx = () => S.findIndex((p) => p.holder);
  const reachOf = (i: number) => {
    const p = S[i]!;
    return p.st === 'play' && (p.o >= 4 || (p.o >= 3 && p.holder));
  };
  void reachOf;

  function buildRigs(n: number) {
    rigs.forEach((r) => scene.remove(r.root));
    const rows = Math.ceil(n / 6);
    rigs = S.map((p, i) => {
      const rig = HM.createCardRig(shared, p, i, LOSE);
      const row = Math.floor(i / 6);
      const inRow = Math.min(6, n - row * 6);
      const col = i % 6;
      rig.root.position.set((col - (inRow - 1) / 2) * 1.98, rows === 1 ? -0.6 : row === 0 ? 0.85 : -2.05, 0);
      scene.add(rig.root);
      return rig;
    });
  }

  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(stage);

  function syncTex(i: number, front: boolean, tag: boolean) {
    const p = S[i]!, rig = rigs[i];
    const reach = reachOf(i);
    if (front) {
      const key = `${p.n}|${p.k}|${p.c}|${p.holder}|${p.st === 'win'}|${reach}`;
      if (rig.lastFrontKey !== key) {
        HT.drawCardFront(rig.frontCanvas, p, i, p.holder, p.st === 'win', reach);
        rig.frontTex.needsUpdate = true;
        rig.lastFrontKey = key;
      }
    }
    if (tag) {
      const key = `${p.o}|${p.x}|${p.st}|${p.rank}`;
      if (rig.lastTagKey !== key) {
        HT.drawScoreTag(rig.tagCanvas, p, LOSE);
        rig.tagTex.needsUpdate = true;
        rig.lastTagKey = key;
      }
    }
  }

  function syncMast(i: number) {
    const p = S[i]!, rig = rigs[i];
    const reach = reachOf(i);
    rig.haloGroup.visible = p.holder;
    rig.reachHaloGroup.visible = reach;
    rig.reachHaloGroup.scale.set(1, 1, 1);
    rig.mastGroup.visible = p.st === 'play';
    if (p.holder) {
      rig.domeMat.color.setHex(0xc9ffe0);
      rig.domeMat.emissive.setHex(0x3ee08f);
      rig.domeMat.emissiveIntensity = 1.4;
      rig.beamsGroup.visible = !lite;
    } else {
      rig.domeMat.color.setHex(0x33425a);
      rig.domeMat.emissive.setHex(0x000000);
      rig.domeMat.emissiveIntensity = 0;
      rig.beamsGroup.visible = false;
      rig.rotator.rotation.y = 0;
    }
  }

  function immediate(i: number) {
    const p = S[i]!, rig = rigs[i];
    G.killTweensOf([rig.motionGroup.position, rig.motionGroup.scale, rig.flipGroup.rotation, rig.tagPivot.rotation, rig.seaMesh.scale, rig.popMesh.position, rig.popMesh.scale]);
    rig.motionGroup.position.set(0, p.st === 'out' ? -0.18 : 0, 0);
    rig.motionGroup.scale.set(1, 1, 1);
    rig.flipGroup.rotation.set(0, p.st === 'out' ? Math.PI : 0, 0);
    rig.tagPivot.rotation.set(0, 0, 0);
    rig.popMesh.visible = false;
    rig.seaMesh.visible = p.st === 'out';
    rig.seaMesh.scale.set(1, p.st === 'out' ? 1 : 0.001, 1);
    syncTex(i, true, true);
    syncMast(i);
  }

  function clearTimers() { timers.forEach(clearTimeout); timers = []; }
  function renderAll() {
    clearTimers();
    G.killTweensOf(flash);
    G.killTweensOf(scene.position);
    G.set(flash, { clearProps: 'all' });
    scene.position.set(0, 0, 0);
    S.forEach((_, i) => immediate(i));
    flash.style.visibility = doneNow ? 'visible' : 'hidden';
    if (doneNow) flash.textContent = `${hud.label.dataset.group ?? ''} 終了`;
  }

  /* ---- 演出（mock と同一） ---- */
  const fast = () => lite || reducedMotion;
  function flipTag(i: number) {
    const rig = rigs[i];
    if (fast()) { syncTex(i, false, true); return; }
    G.timeline()
      .to(rig.tagPivot.rotation, { x: Math.PI / 2, duration: 0.13, ease: 'power1.in', onComplete: () => syncTex(i, false, true) })
      .fromTo(rig.tagPivot.rotation, { x: -Math.PI / 2 }, { x: 0, duration: 0.44, ease: 'back.out(2.8)' });
  }
  function hop(i: number) {
    if (fast()) return;
    const rig = rigs[i];
    G.timeline()
      .to(rig.motionGroup.position, { y: 0.24, z: 0.22, duration: 0.14, ease: 'power2.out' })
      .to(rig.motionGroup.position, { y: 0, z: 0, duration: 0.55, ease: 'bounce.out' });
  }
  function popBanner(i: number, text: string, mode: boolean | string) {
    const rig = rigs[i];
    const isRen = mode === true || mode === 'ren';
    const isReachPop = mode === 'reach';
    HT.drawPopup(rig.popCanvas, text, mode);
    rig.popTex.needsUpdate = true;
    rig.popMesh.visible = true;
    if (fast()) {
      rig.popMesh.position.set(0, 1.38, 0.42);
      rig.popMesh.scale.set(1, 1, 1);
      timers.push(window.setTimeout(() => { rig.popMesh.visible = false; }, isRen || isReachPop ? 1000 : 500));
      return;
    }
    const startScale = isReachPop ? 2.1 : isRen ? 1.7 : 0.7;
    const long = isRen || isReachPop;
    G.timeline({ onComplete: () => { rig.popMesh.visible = false; } })
      .fromTo(rig.popMesh.position, { y: 0.9, z: 0.25 }, { y: isReachPop ? 1.58 : 1.48, z: isReachPop ? 0.75 : 0.55, duration: long ? 0.36 : 0.24, ease: 'back.out(2.8)' })
      .fromTo(rig.popMesh.scale, { x: startScale, y: startScale }, { x: isReachPop ? 1.15 : 1, y: isReachPop ? 1.15 : 1, duration: long ? 0.36 : 0.24, ease: 'back.out(2.5)' }, '<')
      .to(rig.popMesh.position, { y: 2.02, duration: 0.42, ease: 'power1.in', delay: isReachPop ? 1.25 : isRen ? 1.05 : 0.55 })
      .to(rig.popMesh.scale, { x: 0.01, y: 0.01, duration: 0.32, ease: 'power1.in' }, '<0.1');
  }
  function reachShow(i: number) {
    const rig = rigs[i];
    popBanner(i, 'リーチ!!', 'reach');
    if (fast()) return;
    G.timeline()
      .to(rig.motionGroup.scale, { x: 1.1, y: 1.1, z: 1.1, duration: 0.16, ease: 'power2.out' })
      .to(rig.motionGroup.position, { z: 0.42, duration: 0.16, ease: 'power2.out' }, '<')
      .to(rig.motionGroup.scale, { x: 1, y: 1, z: 1, duration: 0.45, ease: 'elastic.out(1.2, 0.35)' })
      .to(rig.motionGroup.position, { z: 0, duration: 0.45, ease: 'elastic.out(1.2, 0.35)' }, '<');
  }
  function endShow() {
    flash.textContent = `${hud.label.dataset.group ?? ''} 終了`;
    flash.style.visibility = 'visible';
    if (!fast()) G.fromTo(flash, { scaleY: 0 }, { scaleY: 1, duration: 0.4, ease: 'back.out(2)' });
  }
  function winShow(i: number, final: boolean) {
    const p = S[i]!;
    if (fast()) { syncTex(i, true, true); syncMast(i); if (final) endShow(); return; }
    const rig = rigs[i];
    G.timeline({ delay: 0.42 })
      .to(rig.tagPivot.rotation, { x: Math.PI / 2, duration: 0.16, ease: 'power1.in', onComplete: () => { syncTex(i, true, true); syncMast(i); } })
      .fromTo(rig.tagPivot.rotation, { x: -Math.PI / 2 }, { x: 0, duration: 0.5, ease: 'back.out(2.5)' })
      .fromTo(scene.position, { x: -0.18 }, { x: 0, duration: 0.45, ease: 'elastic.out(1.2, 0.25)' }, '<')
      .add(() => {
        flash.innerHTML = `<small>${p.rank}抜け</small>${escapeHtml(p.n)}<small>${pad(i)}</small>`;
        flash.style.visibility = 'visible';
      }, '<')
      .fromTo(flash, { xPercent: -100 }, { xPercent: 0, duration: 0.28, ease: 'power3.out' }, '<')
      .to(flash, { xPercent: 100, duration: 0.3, ease: 'power3.in', delay: 0.9 })
      .add(() => {
        flash.style.visibility = 'hidden';
        G.set(flash, { clearProps: 'all' });
        if (final) endShow();
      });
  }
  function sink(i: number) {
    const rig = rigs[i];
    syncMast(i);
    rig.seaMesh.visible = true;
    if (fast()) { immediate(i); return; }
    G.timeline({ delay: 0.32 })
      .to(rig.flipGroup.rotation, { y: Math.PI, duration: 0.72, ease: 'power2.inOut' })
      .to(rig.seaMesh.scale, { y: 1, duration: 0.95, ease: 'power1.inOut' }, '-=0.2')
      .to(rig.motionGroup.position, { y: -0.18, duration: 0.95, ease: 'power1.inOut' }, '<');
  }

  /* ---- 状態の受信 ---- */
  function toState(r2: R2): P[] {
    return r2.seats.map((s) => ({
      n: s.displayName, k: s.ki, c: s.plate ? PLATE_C[s.plate] : 'g',
      o: s.o, x: s.x, st: s.status, rank: s.winOrder ?? 0, holder: s.isHolder,
    }));
  }

  function apply(r2: R2) {
    hud.label.textContent = r2.phase === 'sd' ? `${r2.label}　サドンデス` : r2.phase === 'needSD' ? `${r2.label}　同点・サドンデス待ち` : r2.label;
    hud.label.dataset.group = r2.label;
    hud.left.textContent = String(Math.max(0, r2.seatsToWin - r2.winCount));
    const plan = planTransition(prev, r2);
    // 演出中に次の状態が来たら、前の演出は即座に完了させる
    if (rigs.length) renderAll();
    const sameLayout = rigs.length === r2.seats.length && S.length === r2.seats.length;
    S = toState(r2);
    doneNow = r2.phase === 'done';
    if (!sameLayout) buildRigs(r2.seats.length);
    prev = r2;
    if (plan.instant || !fontsReady) { renderAll(); return; }

    // 状態は即時に新しい値へ。札の表面は先に更新し、黒板だけ演出で遅らせて切り替える
    scene.position.set(0, 0, 0);
    flash.style.visibility = 'hidden';
    S.forEach((_, i) => { syncTex(i, true, false); syncMast(i); });
    const oldTagKey: Record<number, string> = {};
    void oldTagKey;
    const stagger = plan.wins.length > 1;
    const winIdx = (i: number) => plan.wins.indexOf(i);
    const step = fast() ? 500 : 1900;
    const first = fast() ? 300 : 1500;
    const lastWin = plan.wins[plan.wins.length - 1];

    plan.events.forEach((e) => {
      const i = e.i;
      switch (e.type) {
        case 'o':
          if (S[i]!.st === 'win') { hop(i); popBanner(i, e.gain === 2 ? '連答 +2' : '+1', e.gain === 2 ? 'ren' : false); }
          else { flipTag(i); hop(i); if (!plan.events.some((q) => q.type === 'reach' && q.i === i)) popBanner(i, e.gain === 2 ? '連答 +2' : '+1', e.gain === 2 ? 'ren' : false); }
          break;
        case 'reach': reachShow(i); break;
        case 'x':
          syncTex(i, false, true);
          if (!fast()) G.fromTo(rigs[i].motionGroup.position, { x: -0.14 }, { x: 0, duration: 0.45, ease: 'elastic.out(1.4, 0.2)' });
          break;
        case 'out': sink(i); break;
        case 'win': {
          const final = i === lastWin && plan.endShow;
          if (stagger && !e.real) {
            const k = winIdx(i) - (plan.events.some((q) => q.type === 'win' && q.real) ? 1 : 0);
            timers.push(window.setTimeout(() => { syncTex(i, true, false); winShow(i, final); }, first + k * step));
          } else winShow(i, final);
          break;
        }
      }
    });
    // 勝ち抜けなしで組が終わった場合（打ち切り・サドンデス決着）
    if (plan.endShow && plan.wins.length === 0) timers.push(window.setTimeout(endShow, fast() ? 300 : 1200));
    // 即時に黒板へ反映しておく必要がある席（演出を持たない変化）
    S.forEach((_, i) => { if (!plan.events.some((q) => q.i === i)) syncTex(i, false, true); });
  }

  /* ---- 描画ループ ---- */
  function tick(now: number) {
    if (document.hidden || !active) { rafId = null; return; }
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    const h = holderIdx();
    if (h >= 0 && rigs[h]) {
      const rig = rigs[h];
      if (!reducedMotion) rig.rotator.rotation.y += dt * 5.2;
      if (!lite) rig.domeMat.emissiveIntensity = 1.0 + 0.5 * Math.sin(now * 0.008);
    }
    if (!lite && !reducedMotion) {
      const pulse = 1.0 + 0.024 * (0.5 + 0.5 * Math.sin(now * 0.006));
      rigs.forEach((r) => { if (r.reachHaloGroup.visible) r.reachHaloGroup.scale.set(pulse, pulse, 1); });
    }
    renderer.render(scene, camera);
    rafId = requestAnimationFrame(tick);
  }
  function setActive(on: boolean) {
    active = on;
    if (on && rafId === null) { last = performance.now(); resize(); rafId = requestAnimationFrame(tick); }
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden && active && rafId === null) { last = performance.now(); rafId = requestAnimationFrame(tick); } });

  /* ---- フォント読込完了後に全テクスチャを再描画（unicode-range 分割対応） ---- */
  const loadFonts = () => {
    const txt = S.map((p) => p.n).join('') + '失格抜け勝ち○×第期リーチ連答権正解+0123456789';
    return Promise.all([
      document.fonts.load('900 40px "Big Shoulders Stencil Display"', '0123456789'),
      document.fonts.load('400 40px "Dela Gothic One"', txt),
      document.fonts.load('700 40px "BIZ UDPGothic"', txt),
    ]).catch(() => undefined).then(() => document.fonts.ready);
  };
  const refreshFonts = () => loadFonts().then(() => {
    fontsReady = true;
    rigs.forEach((rig, i) => {
      rig.lastFrontKey = ''; rig.lastTagKey = '';
      HT.drawCardBack(rig.backCanvas, S[i]);
      rig.backTex.needsUpdate = true;
      syncTex(i, true, true);
    });
  });
  const origApply = apply;
  let fontsRequested = false;
  return {
    apply(r2: R2) {
      origApply(r2);
      if (!fontsRequested) { fontsRequested = true; void refreshFonts(); }
      else if (fontsReady) {
        // 名前が増えたときの未読込グリフ対策
        void loadFonts().then(() => { rigs.forEach((rig, i) => { rig.lastFrontKey = ''; rig.lastTagKey = ''; HT.drawCardBack(rig.backCanvas, S[i]); rig.backTex.needsUpdate = true; syncTex(i, true, true); }); });
      }
    },
    resize,
    setActive,
  };
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}
