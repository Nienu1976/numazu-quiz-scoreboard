/**
 * 2R 3Dスコアボード用 3Dモデルビルダーモジュール
 * - 厚みのある競り札（木札・金属帯・黒板プレート）
 * - 連答権の回転灯（マスト・八角ガラスドーム・回転反射板・光芒）
 * - 失格時の波型海面シールド
 * - 沼津港桟橋ラック風の背景ステージ
 */
(function (global) {
  'use strict';

  const HT = global.HarborTextures;

  // 共有リソース（ジオメトリ・マテリアルを再利用してGPUメモリとドローコールを節約）
  function createSharedAssets(maxAnisotropy) {
    const toonMap = HT.createToonGradientMap();

    const cardGeo = new THREE.BoxGeometry(1.78, 2.28, 0.12);
    const cardEdgeGeo = new THREE.EdgesGeometry(cardGeo);

    const tagGeo = new THREE.BoxGeometry(1.56, 0.78, 0.055);
    const tagEdgeGeo = new THREE.EdgesGeometry(tagGeo);

    const mastPoleGeo = new THREE.BoxGeometry(0.07, 0.34, 0.07);
    const mastBaseGeo = new THREE.CylinderGeometry(0.14, 0.16, 0.06, 8);
    const domeGeo = new THREE.CylinderGeometry(0.135, 0.155, 0.25, 8);
    const domeCapGeo = new THREE.CylinderGeometry(0.09, 0.135, 0.04, 8);
    const reflectorGeo = new THREE.BoxGeometry(0.16, 0.16, 0.04);

    // 回転灯の放射状光芒（左右に広がる台形ビーム）
    const beamShape = new THREE.Shape();
    beamShape.moveTo(0, -0.04);
    beamShape.lineTo(1.15, -0.26);
    beamShape.lineTo(1.15, 0.26);
    beamShape.lineTo(0, 0.04);
    beamShape.closePath();
    const beamGeo = new THREE.ShapeGeometry(beamShape);

    // 失格時の波型海面プレート
    const seaShape = new THREE.Shape();
    const sw = 1.92;
    const sh = 0.68;
    const teeth = 8;
    seaShape.moveTo(-sw / 2, 0);
    for (let i = 0; i <= teeth; i++) {
      const x = -sw / 2 + (sw * i) / teeth;
      const y = i % 2 === 0 ? sh : sh - 0.11;
      seaShape.lineTo(x, y);
    }
    seaShape.lineTo(sw / 2, 0);
    seaShape.closePath();
    const seaGeo = new THREE.ExtrudeGeometry(seaShape, { depth: 0.04, bevelEnabled: false });

    // 連答権発光枠（札の周囲を囲む4本の細長い枠）
    const glowMat = new THREE.MeshBasicMaterial({ color: 0x3ee08f });
    // リーチ発光枠（さらに一回り外側の黄金枠）
    const reachGlowMat = new THREE.MeshBasicMaterial({ color: 0xffbe0b });

    // ポップアップ看板ジオメトリ
    const popGeo = new THREE.PlaneGeometry(1.62, 0.6);

    const sideWoodMat = new THREE.MeshToonMaterial({ color: 0xe0d4b8, gradientMap: toonMap });
    const sideRustMat = new THREE.MeshToonMaterial({ color: 0x6b2f15, gradientMap: toonMap });
    const tagSideMat = new THREE.MeshToonMaterial({ color: 0x111815, gradientMap: toonMap });
    const blackLineMat = new THREE.LineBasicMaterial({ color: 0x000000 });
    const darkMetalMat = new THREE.MeshToonMaterial({ color: 0x18202c, gradientMap: toonMap });
    const seaMat = new THREE.MeshBasicMaterial({ color: 0x0a1a33 });

    return {
      maxAnisotropy,
      toonMap,
      cardGeo,
      cardEdgeGeo,
      tagGeo,
      tagEdgeGeo,
      mastPoleGeo,
      mastBaseGeo,
      domeGeo,
      domeCapGeo,
      reflectorGeo,
      beamGeo,
      seaGeo,
      popGeo,
      glowMat,
      reachGlowMat,
      sideWoodMat,
      sideRustMat,
      tagSideMat,
      blackLineMat,
      darkMetalMat,
      seaMat
    };
  }

  /**
   * 1人分の立体札リグを生成
   */
  function createCardRig(shared, player, index, loseLimit) {
    const root = new THREE.Group();

    // 跳ね・沈みアニメーション用の内部グループ
    const motionGroup = new THREE.Group();
    root.add(motionGroup);

    // Y軸裏返し用グループ（失格時に180度回転）
    const flipGroup = new THREE.Group();
    motionGroup.add(flipGroup);

    // テクスチャ用キャンバス
    const frontCanvas = HT.makeCanvas(512, 656);
    const backCanvas = HT.makeCanvas(512, 656);
    const tagCanvas = HT.makeCanvas(512, 256);
    const popCanvas = HT.makeCanvas(512, 192);

    HT.drawCardFront(frontCanvas, player, index, false, false);
    HT.drawCardBack(backCanvas, player);
    HT.drawScoreTag(tagCanvas, player, loseLimit);

    const frontTex = HT.configureTexture(new THREE.CanvasTexture(frontCanvas), shared.maxAnisotropy);
    const backTex = HT.configureTexture(new THREE.CanvasTexture(backCanvas), shared.maxAnisotropy);
    const tagTex = HT.configureTexture(new THREE.CanvasTexture(tagCanvas), shared.maxAnisotropy);
    const popTex = HT.configureTexture(new THREE.CanvasTexture(popCanvas), shared.maxAnisotropy);

    const frontMat = new THREE.MeshToonMaterial({ map: frontTex, gradientMap: shared.toonMap });
    const backMat = new THREE.MeshToonMaterial({ map: backTex, gradientMap: toonMapFallback(shared) });

    // BoxGeometry マテリアル順: +x, -x, +y, -y, +z(前), -z(裏)
    const cardMesh = new THREE.Mesh(shared.cardGeo, [
      shared.sideWoodMat,
      shared.sideWoodMat,
      shared.sideWoodMat,
      shared.sideWoodMat,
      frontMat,
      backMat
    ]);
    cardMesh.castShadow = true;
    cardMesh.receiveShadow = true;
    cardMesh.add(new THREE.LineSegments(shared.cardEdgeGeo, shared.blackLineMat));
    flipGroup.add(cardMesh);

    // 下部黒板プレート（X軸でパタッとめくれる）
    const tagPivot = new THREE.Group();
    tagPivot.position.set(0, -0.63, 0.088);
    flipGroup.add(tagPivot);

    const tagFrontMat = new THREE.MeshToonMaterial({ map: tagTex, gradientMap: shared.toonMap });
    const tagMesh = new THREE.Mesh(shared.tagGeo, [
      shared.tagSideMat,
      shared.tagSideMat,
      shared.tagSideMat,
      shared.tagSideMat,
      tagFrontMat,
      shared.tagSideMat
    ]);
    tagMesh.castShadow = true;
    tagMesh.add(new THREE.LineSegments(shared.tagEdgeGeo, shared.blackLineMat));
    tagPivot.add(tagMesh);

    // 連答権保持時の発光フレーム（前面外周）
    const haloGroup = new THREE.Group();
    haloGroup.visible = false;
    haloGroup.position.z = 0.068;
    const barT = 0.045;
    const hTop = new THREE.Mesh(new THREE.BoxGeometry(1.88, barT, 0.02), shared.glowMat);
    hTop.position.y = 1.16;
    const hBot = new THREE.Mesh(new THREE.BoxGeometry(1.88, barT, 0.02), shared.glowMat);
    hBot.position.y = -1.16;
    const hL = new THREE.Mesh(new THREE.BoxGeometry(barT, 2.36, 0.02), shared.glowMat);
    hL.position.x = -0.92;
    const hR = new THREE.Mesh(new THREE.BoxGeometry(barT, 2.36, 0.02), shared.glowMat);
    hR.position.x = 0.92;
    haloGroup.add(hTop, hBot, hL, hR);
    flipGroup.add(haloGroup);

    // リーチ時の黄金発光フレーム（さらに外周に大きく、脈打ち用）
    const reachHaloGroup = new THREE.Group();
    reachHaloGroup.visible = false;
    reachHaloGroup.position.z = 0.062;
    const rBarT = 0.075;
    const rTop = new THREE.Mesh(new THREE.BoxGeometry(2.0, rBarT, 0.025), shared.reachGlowMat);
    rTop.position.y = 1.24;
    const rBot = new THREE.Mesh(new THREE.BoxGeometry(2.0, rBarT, 0.025), shared.reachGlowMat);
    rBot.position.y = -1.24;
    const rL = new THREE.Mesh(new THREE.BoxGeometry(rBarT, 2.55, 0.025), shared.reachGlowMat);
    rL.position.x = -0.98;
    const rR = new THREE.Mesh(new THREE.BoxGeometry(rBarT, 2.55, 0.025), shared.reachGlowMat);
    rR.position.x = 0.98;
    reachHaloGroup.add(rTop, rBot, rL, rR);
    flipGroup.add(reachHaloGroup);

    // 連答権・回転灯マスト（札の上部右側）
    const mastGroup = new THREE.Group();
    mastGroup.position.set(0.58, 1.14, 0.02);
    motionGroup.add(mastGroup);

    const pole = new THREE.Mesh(shared.mastPoleGeo, shared.darkMetalMat);
    pole.position.y = 0.16;
    mastGroup.add(pole);

    const base = new THREE.Mesh(shared.mastBaseGeo, shared.darkMetalMat);
    base.position.y = 0.34;
    mastGroup.add(base);

    const domeMat = new THREE.MeshStandardMaterial({
      color: 0x33425a,
      emissive: 0x000000,
      emissiveIntensity: 0,
      roughness: 0.25,
      metalness: 0.1,
      transparent: true,
      opacity: 0.88,
      flatShading: true
    });
    const dome = new THREE.Mesh(shared.domeGeo, domeMat);
    dome.position.y = 0.49;
    mastGroup.add(dome);

    const domeCap = new THREE.Mesh(shared.domeCapGeo, shared.darkMetalMat);
    domeCap.position.y = 0.63;
    mastGroup.add(domeCap);

    // 回転反射鏡＋放射状光芒
    const rotator = new THREE.Group();
    rotator.position.y = 0.49;
    mastGroup.add(rotator);

    const reflectorMat = new THREE.MeshBasicMaterial({ color: 0xc9ffe0 });
    const reflector = new THREE.Mesh(shared.reflectorGeo, reflectorMat);
    rotator.add(reflector);

    const beamMat = new THREE.MeshBasicMaterial({
      color: 0x3ee08f,
      transparent: true,
      opacity: 0.48,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const beam1 = new THREE.Mesh(shared.beamGeo, beamMat);
    beam1.position.z = 0.01;
    const beam2 = new THREE.Mesh(shared.beamGeo, beamMat);
    beam2.rotation.y = Math.PI;
    beam2.position.z = -0.01;
    const beamsGroup = new THREE.Group();
    beamsGroup.add(beam1, beam2);
    beamsGroup.visible = false;
    rotator.add(beamsGroup);

    // 失格時の波型海面（普段は下に隠れてスケールY=0.001）
    const seaMesh = new THREE.Mesh(shared.seaGeo, shared.seaMat);
    seaMesh.position.set(0, -1.22, 0.16);
    seaMesh.scale.set(1, 0.001, 1);
    seaMesh.visible = false;
    root.add(seaMesh);

    // 飛び出しポップアップ（「+1」 / 「連答 +2」）
    const popMat = new THREE.MeshBasicMaterial({
      map: popTex,
      transparent: true,
      depthTest: false
    });
    const popMesh = new THREE.Mesh(shared.popGeo, popMat);
    popMesh.position.set(0, 1.32, 0.35);
    popMesh.renderOrder = 20;
    popMesh.visible = false;
    root.add(popMesh);

    return {
      root,
      motionGroup,
      flipGroup,
      cardMesh,
      tagPivot,
      haloGroup,
      reachHaloGroup,
      mastGroup,
      domeMat,
      rotator,
      beamsGroup,
      seaMesh,
      popMesh,
      frontCanvas,
      backCanvas,
      tagCanvas,
      popCanvas,
      frontTex,
      backTex,
      tagTex,
      popTex,
      lastFrontKey: '',
      lastTagKey: ''
    };
  }

  function toonMapFallback(shared) {
    return shared.toonMap;
  }

  /**
   * 沼津港 桟橋・看板ラック風の背景ステージを構築
   */
  function createHarborStage(scene, toonMap) {
    const stageGroup = new THREE.Group();

    // 駿河湾の藍の背景壁（フラット）
    const wallMat = new THREE.MeshBasicMaterial({ color: 0x0e2240 });
    const backWall = new THREE.Mesh(new THREE.PlaneGeometry(36, 20), wallMat);
    backWall.position.set(0, 0, -2.5);
    stageGroup.add(backWall);

    // 下部の海面デッキ（濃い海色）
    const deckMat = new THREE.MeshToonMaterial({ color: 0x0a1a33, gradientMap: toonMap });
    const deck = new THREE.Mesh(new THREE.BoxGeometry(30, 0.4, 10), deckMat);
    deck.position.set(0, -3.75, 0);
    deck.receiveShadow = true;
    stageGroup.add(deck);

    // 札を支える上下2本の横木レール（沼津港の競り札掛け風）
    const railMat = new THREE.MeshToonMaterial({ color: 0x162947, gradientMap: toonMap });
    const railEdgeMat = new THREE.LineBasicMaterial({ color: 0x060f1d });
    const railGeo = new THREE.BoxGeometry(13.2, 0.18, 0.24);
    const railEdgeGeo = new THREE.EdgesGeometry(railGeo);

    [0.85, -2.05].forEach((ry) => {
      const rail = new THREE.Mesh(railGeo, railMat);
      rail.position.set(0, ry, -0.22);
      rail.receiveShadow = true;
      rail.add(new THREE.LineSegments(railEdgeGeo, railEdgeMat));
      stageGroup.add(rail);
    });

    // 左右の港湾支柱（鉄骨フレーム）
    const pillarMat = new THREE.MeshToonMaterial({ color: 0x13233d, gradientMap: toonMap });
    const pillarGeo = new THREE.BoxGeometry(0.28, 7.6, 0.34);
    [-6.45, 6.45].forEach((px) => {
      const pillar = new THREE.Mesh(pillarGeo, pillarMat);
      pillar.position.set(px, -0.2, -0.25);
      pillar.add(new THREE.LineSegments(new THREE.EdgesGeometry(pillarGeo), railEdgeMat));
      stageGroup.add(pillar);
    });

    // 遠景の港の係船ビット（ボラード）風シルエット（左右端の低い位置に控えめに）
    const bollardGeo = new THREE.CylinderGeometry(0.18, 0.24, 0.7, 8);
    [-5.95, 5.95].forEach((bx) => {
      const b = new THREE.Mesh(bollardGeo, pillarMat);
      b.position.set(bx, -3.25, 0.7);
      stageGroup.add(b);
    });

    scene.add(stageGroup);
    return stageGroup;
  }

  global.HarborModels = {
    createSharedAssets,
    createCardRig,
    createHarborStage
  };
})(window);
