/** 所属などの自由記述を札幅に収める（収まらなければ縮小、最小でも収まらなければ省略記号） */
function drawFit(ctx, text, x, y, maxW, size, minSize) {
  let f = size;
  ctx.font = `700 ${f}px "BIZ UDPGothic", sans-serif`;
  while (ctx.measureText(text).width > maxW && f > minSize) { f -= 2; ctx.font = `700 ${f}px "BIZ UDPGothic", sans-serif`; }
  let t = text;
  while (ctx.measureText(t).width > maxW && t.length > 1) t = t.slice(0, -1);
  ctx.fillText(t === text ? t : t.slice(0, -1) + '…', x, y);
}
/**
 * 2R 3Dスコアボード用 プロシージャルテクスチャ生成モジュール
 * - 沼津港モチーフ（生成り・黒板・船体の赤・錆・駿河湾の藍）
 * - グラデーション禁止制約に従い、すべてフラット塗り＋離散トーンで描画
 */
(function (global) {
  'use strict';

  const PALETTE = {
    ai: '#0e2240',
    sea: '#0a1a33',
    kinari: '#f5efe0',
    kinari2: '#e5dbc2',
    shiro: '#fcfaf5',
    aka: '#d61434',
    sabi: '#8c3f1e',
    koku: '#1f2b26',
    chalk: '#f4f6ee',
    sig: '#3ee08f',
    reach: '#ffbe0b',
    ink: '#101010',
    plate: {
      r: { bg: '#d61434', fg: '#fcfaf5' },
      b: { bg: '#2260cc', fg: '#fcfaf5' },
      y: { bg: '#f5b800', fg: '#101010' },
      g: { bg: '#209954', fg: '#fcfaf5' }
    }
  };

  /**
   * 3段階トゥーンランプテクスチャ（グラデーションのないくっきりした陰影用）
   * 最小輝度を高めに保ち、プロジェクターでも札の面が暗くならないようにする
   */
  function createToonGradientMap() {
    const data = new Uint8Array([
      205, 205, 205, 255,
      235, 235, 235, 255,
      255, 255, 255, 255
    ]);
    const tex = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat);
    tex.minFilter = THREE.NearestFilter;
    tex.magFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    tex.needsUpdate = true;
    return tex;
  }

  function makeCanvas(w, h) {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    return canvas;
  }

  function configureTexture(tex, anisotropy) {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = anisotropy || 4;
    tex.needsUpdate = true;
    return tex;
  }

  /**
   * 札の前面テクスチャを描画・更新する
   * 下部黒板は別メッシュ（tagPivot）でめくれるため、ここは上部の帯・名前・期＋下地を描画
   */
  function drawCardFront(canvas, player, index, hasStreak, isWin, isReach) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const plate = PALETTE.plate[player.c] || PALETTE.plate.g;
    const pad = String(index + 1).padStart(2, '0');

    // 背景（通常: 明るい生成り、勝ち抜け: 白）
    ctx.fillStyle = isWin ? PALETTE.shiro : PALETTE.kinari;
    ctx.fillRect(0, 0, w, h);

    // わずかな木目ストライプ（フラットな離散色）
    if (!isWin) {
      ctx.fillStyle = '#ece3cc';
      for (let y = 110; y < h; y += 28) {
        ctx.fillRect(0, y, w, 4);
      }
    }

    // 上部金属プレート帯
    const bandH = 112;
    ctx.fillStyle = plate.bg;
    ctx.fillRect(0, 0, w, bandH);

    // 席番号（港の番号標識風ステンシル）
    ctx.fillStyle = plate.fg;
    ctx.font = '900 84px "Big Shoulders Stencil Display", Impact, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText(pad, 24, bandH / 2 + 4);

    // 連答権チップ（保持中のみ）
    if (hasStreak) {
      const chipW = 148;
      const chipH = 54;
      const cx = w - chipW - 22;
      const cy = (bandH - chipH) / 2;
      ctx.fillStyle = PALETTE.sig;
      ctx.fillRect(cx, cy, chipW, chipH);
      ctx.lineWidth = 5;
      ctx.strokeStyle = '#000000';
      ctx.strokeRect(cx, cy, chipW, chipH);

      ctx.fillStyle = '#062814';
      ctx.font = '400 32px "Dela Gothic One", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('連答権', cx + chipW / 2, cy + chipH / 2 + 2);
    }

    // 外枠線（黒・直角）
    ctx.lineWidth = 10;
    ctx.strokeStyle = '#000000';
    ctx.strokeRect(5, 5, w - 10, h - 10);
    // 帯の境界線
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, bandH, w, 6);

    // プレイヤー名（最も大きく、常に正面から読める）
    ctx.fillStyle = PALETTE.ink;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    const maxNameW = w - 52;
    let fontSize = 86;
    ctx.font = `400 ${fontSize}px "Dela Gothic One", "Hiragino Kaku Gothic ProN", sans-serif`;
    while (ctx.measureText(player.n).width > maxNameW && fontSize > 42) {
      fontSize -= 4;
      ctx.font = `400 ${fontSize}px "Dela Gothic One", "Hiragino Kaku Gothic ProN", sans-serif`;
    }
    ctx.fillText(player.n, 26, 224);

    // 所属（左）＋ リーチバッジ（右、名前を隠さない位置）
    ctx.fillStyle = '#474035';
    drawFit(ctx, String(player.k || ""), 28, 286, 250, 38, 22);

    if (isReach && !isWin) {
      const rw = 204;
      const rh = 54;
      const rx = w - rw - 24;
      const ry = 242;
      ctx.fillStyle = PALETTE.reach;
      ctx.fillRect(rx, ry, rw, rh);
      ctx.lineWidth = 6;
      ctx.strokeStyle = '#000000';
      ctx.strokeRect(rx, ry, rw, rh);

      ctx.fillStyle = '#101010';
      ctx.font = '400 36px "Dela Gothic One", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('リーチ!', rx + rw / 2, ry + rh / 2 + 2);
    }

    // 状態枠アクセント
    if (isWin) {
      ctx.lineWidth = 14;
      ctx.strokeStyle = PALETTE.aka;
      ctx.strokeRect(12, 12, w - 24, h - 24);
    } else if (isReach) {
      ctx.lineWidth = 16;
      ctx.strokeStyle = PALETTE.reach;
      ctx.strokeRect(12, 12, w - 24, h - 24);
      if (hasStreak) {
        ctx.lineWidth = 8;
        ctx.strokeStyle = PALETTE.sig;
        ctx.strokeRect(24, 24, w - 48, h - 48);
      }
    } else if (hasStreak) {
      ctx.lineWidth = 12;
      ctx.strokeStyle = PALETTE.sig;
      ctx.strokeRect(11, 11, w - 22, h - 22);
    }
  }

  /**
   * 札の裏面テクスチャ（失格時の錆色面）
   */
  function drawCardBack(canvas, player) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    ctx.fillStyle = PALETTE.sabi;
    ctx.fillRect(0, 0, w, h);

    // 錆の離散テクスチャ（フラット矩形）
    ctx.fillStyle = '#753216';
    for (let i = 0; i < 18; i++) {
      const rx = (i * 97) % (w - 60);
      const ry = (i * 131) % (h - 40);
      ctx.fillRect(rx, ry, 44 + (i % 3) * 18, 14);
    }

    ctx.lineWidth = 10;
    ctx.strokeStyle = '#000000';
    ctx.strokeRect(5, 5, w - 10, h - 10);

    // 名前（裏面にも出す）
    ctx.fillStyle = PALETTE.kinari;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let fontSize = 72;
    ctx.font = `400 ${fontSize}px "Dela Gothic One", sans-serif`;
    while (ctx.measureText(player.n).width > w - 60 && fontSize > 38) {
      fontSize -= 4;
      ctx.font = `400 ${fontSize}px "Dela Gothic One", sans-serif`;
    }
    ctx.fillText(player.n, w / 2, 132);

    ctx.fillStyle = 'rgba(233, 223, 198, 0.85)';
    drawFit(ctx, String(player.k || ""), w / 2, 206, w - 60, 38, 22);

    // 大きな「失格」枠
    const boxW = 300;
    const boxH = 148;
    const bx = (w - boxW) / 2;
    const by = 276;
    ctx.lineWidth = 12;
    ctx.strokeStyle = PALETTE.kinari;
    ctx.strokeRect(bx, by, boxW, boxH);

    ctx.fillStyle = PALETTE.kinari;
    ctx.font = '400 100px "Dela Gothic One", sans-serif';
    ctx.fillText('失格', w / 2, by + boxH / 2 + 4);
  }

  /**
   * 下部黒板 / 勝ち抜け赤板テクスチャ
   */
  function drawScoreTag(canvas, player, loseLimit) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const isWin = player.st === 'win';

    if (isWin) {
      ctx.fillStyle = PALETTE.aka;
      ctx.fillRect(0, 0, w, h);

      ctx.lineWidth = 8;
      ctx.strokeStyle = '#000000';
      ctx.strokeRect(4, 4, w - 8, h - 8);

      // 「1抜け」
      ctx.fillStyle = PALETTE.shiro;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.font = '900 190px "Big Shoulders Stencil Display", Impact, sans-serif';
      const rankStr = String(player.rank || 1);
      ctx.fillText(rankStr, 28, h - 32);
      const numW = ctx.measureText(rankStr).width;

      ctx.font = '400 84px "Dela Gothic One", sans-serif';
      ctx.fillText('抜け', 28 + numW + 12, h - 42);

      // 右側に縦書き風「勝ち抜け」
      ctx.font = '400 44px "Dela Gothic One", sans-serif';
      ctx.textAlign = 'center';
      const chars = ['勝', 'ち', '抜', 'け'];
      chars.forEach((ch, idx) => {
        ctx.fillText(ch, w - 48, 56 + idx * 50);
      });
    } else {
      // 黒板地
      ctx.fillStyle = PALETTE.koku;
      ctx.fillRect(0, 0, w, h);

      // チョークの擦れ（離散ドット・線）
      ctx.fillStyle = 'rgba(238, 240, 230, 0.06)';
      for (let i = 0; i < 14; i++) {
        ctx.fillRect((i * 73) % w, (i * 41) % h, 50, 3);
      }

      ctx.lineWidth = 8;
      ctx.strokeStyle = '#000000';
      ctx.strokeRect(4, 4, w - 8, h - 8);

      // ○の数字
      ctx.fillStyle = PALETTE.chalk;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.font = '900 206px "Big Shoulders Stencil Display", Impact, sans-serif';
      const numStr = String(player.o);
      ctx.fillText(numStr, 28, h - 26);
      const nw = ctx.measureText(numStr).width;

      ctx.fillStyle = '#b9c2b2';
      ctx.font = '400 56px "Dela Gothic One", sans-serif';
      ctx.fillText('○', 28 + nw + 10, h - 38);

      // 右側の×枠（2つ縦並び）
      const boxSize = 76;
      const bx = w - boxSize - 26;
      for (let k = 0; k < loseLimit; k++) {
        const by = 28 + k * (boxSize + 18);
        const on = k < player.x;
        if (on) {
          ctx.fillStyle = PALETTE.sabi;
          ctx.fillRect(bx, by, boxSize, boxSize);
          ctx.lineWidth = 6;
          ctx.strokeStyle = PALETTE.sabi;
          ctx.strokeRect(bx, by, boxSize, boxSize);
          ctx.fillStyle = PALETTE.kinari;
          ctx.font = '700 62px "BIZ UDPGothic", sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('×', bx + boxSize / 2, by + boxSize / 2 + 2);
        } else {
          ctx.lineWidth = 6;
          ctx.strokeStyle = '#8a7e6e';
          ctx.strokeRect(bx, by, boxSize, boxSize);
        }
      }
    }
  }

  /**
   * 飛び出しポップアップ（「+1」 / 「連答 +2」 / 「リーチ!!」）用テクスチャ
   */
  function drawPopup(canvas, text, mode) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const isRen = mode === true || mode === 'ren';
    const isReach = mode === 'reach';

    ctx.fillStyle = isReach ? PALETTE.reach : isRen ? PALETTE.sig : PALETTE.ink;
    ctx.fillRect(6, 6, w - 12, h - 12);

    ctx.lineWidth = 12;
    ctx.strokeStyle = (isReach || isRen) ? '#000000' : PALETTE.shiro;
    ctx.strokeRect(6, 6, w - 12, h - 12);

    ctx.fillStyle = (isReach || isRen) ? '#101010' : PALETTE.shiro;
    ctx.font = `400 ${isReach ? 82 : isRen ? 72 : 66}px "Dela Gothic One", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, w / 2, h / 2 + 3);
  }

  global.HarborTextures = {
    PALETTE,
    createToonGradientMap,
    makeCanvas,
    configureTexture,
    drawCardFront,
    drawCardBack,
    drawScoreTag,
    drawPopup
  };
})(window);
