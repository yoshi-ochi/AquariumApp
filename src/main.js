import './style.css';
import * as THREE from 'three';
import { SceneManager } from './core/scene.js';
import { CameraController } from './core/controls.js';
import { generatePreviews } from './core/previewRenderer.js';
import { Economy } from './management/economy.js';
import { HALL_DEFS, INTERIOR_DEFS, ALL_DEFS, getDef } from './tanks/tankData.js';
import { buildObject, disposeObject } from './tanks/tankBuilder.js';
import { TankManager } from './tanks/tankManager.js';
import { TankCustomizer } from './tanks/tankCustom.js';
import { HallInteraction } from './interaction/hallInteraction.js';
import { InteriorInteraction } from './interaction/interiorInteraction.js';
import { ViewInteraction } from './interaction/viewInteraction.js';
import { ShapeInteraction } from './interaction/shapeInteraction.js';
import { LightInteraction } from './interaction/lightInteraction.js';
import { InteriorCamera } from './interior/interiorCamera.js';
import { Room } from './room/room.js';
import { CELL } from './room/floorPlan.js';
import { defaultRoomSettings, normalizeLight } from './room/roomData.js';
import { findRunByKey, placeEmbedded, holeFor } from './room/embed.js';
import { normalizeLook } from './tanks/tankLook.js';
import { Splash } from './ui/splash.js';
import { Catalog } from './ui/catalog.js';
import { AppShell } from './ui/shell.js';
import { RoomPanel } from './ui/roomPanel.js';
import { toast } from './ui/toast.js';
import { WAVE_PARAMS, bakeWaves, waveCacheKey } from './water/waveBaker.js';
import { loadCached, saveCached } from './water/waveCache.js';
import { setWaveData, updateWater } from './water/waterSurface.js';
import { LAYOUT_VERSION, downloadJSON, readLayoutFile } from './io/layoutIO.js';
import { Online } from './online/online.js';
import { FriendPanel } from './ui/friendPanel.js';

const $ = (id) => document.getElementById(id);
const MIN_SPLASH_MS = 1800;
const HINT = {
  home: '水槽をタップすると近くで見られます ・ ドラッグで回転 / 2本指でズーム',
  hall: 'タップで選択・ドラッグで移動 ・ 何もない所のドラッグで視点を回転',
  place: '床をタップして設置 ・ もう一度カードを押すとキャンセル',
  interior: 'ドラッグで移動（岩の上にも積める）・ はみ出した部分はガラス面でカット',
  sculpt: '岩肌をなぞって{mode} ・ 2本指で視点操作',
  grow: 'パネルの説明どおりに本体をドラッグ ・ 2本指で視点操作',
  shape: '床のマスをタップして形を変更（面積は一定）',
};

async function boot() {
  const startedAt = performance.now();
  const splash = new Splash({ root: $('splash'), canvas: $('splash-canvas'), bar: $('splash-bar'), label: $('splash-label') });

  // ---- コア -----------------------------------------------------------------
  const sceneMgr = new SceneManager($('viewport'));
  const cameraCtl = new CameraController(sceneMgr.camera, sceneMgr.renderer.domElement);
  const economy = new Economy();
  const manager = new TankManager(sceneMgr.scene);
  const room = new Room(sceneMgr.scene, sceneMgr);
  let roomSettings = defaultRoomSettings();

  // ---- 事前準備（スプラッシュの裏で）：サムネイル撮影と水面モーション ----------
  const previews = await generatePreviews(ALL_DEFS, buildObject, {
    dispose: disposeObject,
    onProgress: (i, n, def) => splash.setProgress(i / n, `${def.name} を撮影中… (${i}/${n})`),
  });
  const waveKey = waveCacheKey();
  let waves = await loadCached(waveKey);
  if (!waves) {
    waves = await bakeWaves(WAVE_PARAMS, (r) => splash.setProgress(r, `水面の動きを計算中… ${Math.round(r * 100)}%`));
    await saveCached(waveKey, waves);
  }
  setWaveData(waves);

  // ---- 部屋 -----------------------------------------------------------------
  let wallsDirty = false;
  /** 埋め込み水槽を壁に合わせ直し、穴あきの壁を作り直す */
  function refreshRoom() {
    const runs = room.plan.runs();
    const holes = [];
    for (const tank of manager.embeddedObjects()) {
      const def = manager.defOf(tank);
      const e = tank.userData.embed;
      const run = findRunByKey(runs, e.key, e.along);
      if (run && placeEmbedded(tank, def, run, e)) {
        holes.push(holeFor(def, e));
      } else if (def.wallMount) {
        manager.remove(tank);
        economy.earn(def.price);
        toast(`${def.name} の取り付け先の壁がなくなったため、撤去しました（全額返金）`);
      } else {
        delete tank.userData.embed;
        const b = room.plan.bounds(CELL.FLOOR);
        tank.position.set(b.cx, 0, b.cz);
        toast(`${def.name} の埋め込み先の壁がなくなったため、床に戻しました`);
      }
    }
    manager.refreshElevations();
    room.rebuild(holes);
    wallsDirty = false;
  }
  function applyRoom(reframe) {
    room.setStage(economy.stage, roomSettings.plan);
    room.applyLook(roomSettings);
    room.setLights(roomSettings.lights);
    refreshRoom();
    if (reframe) cameraCtl.frameBounds(room.plan.bounds());
  }
  applyRoom(true);

  // ---- 選択パネル・カタログ ---------------------------------------------------
  const customizer = new TankCustomizer({
    scene: sceneMgr.scene,
    camera: sceneMgr.camera,
    panelEl: $('detail-panel'),
    gizmoEl: $('gizmo'),
    getDef,
    getBrush: () => interior.brush,
    getGrowMode: () => interior.growMode,
    onAction: (action, obj, value) => {
      if (action.startsWith('brush-')) return interior.setBrush('mode', action === 'brush-off' ? null : action.slice(6));
      if (action.startsWith('grow-')) return interior.setGrowMode(action === 'grow-off' ? null : action.slice(5));
      if (action === 'param-brush-radius') return interior.setBrush('radius', value);
      if (action === 'param-brush-strength') return interior.setBrush('strength', value);
      if (action === 'param-embed-ratio') return hall.setEmbedParam(obj, 'ratio', value);
      if (action === 'param-embed-bottom') return hall.setEmbedParam(obj, 'bottom', value);
      if (action === 'embed') return hall.embed(obj);
      if (action === 'param-bubbles') return (obj.userData.bubbles = value);
      if (action.startsWith('look-') || action === 'param-tanklight-intensity' || action === 'param-side-alpha') return changeTankLook(obj, action, value);
      if (action === 'unembed') return hall.unembed(obj);
      if (action === 'lock') {
        obj.userData.locked = !obj.userData.locked;
        customizer.syncLock();
        customizer.renderPanel();
        return;
      }
      if (obj.userData.locked && (action.startsWith('rotate') || action === 'delete')) return;
      const target = obj.userData.interiorItem ? interior : hall;
      if (action === 'rotate-left') target.rotate(obj, 1);
      else if (action === 'rotate-right') target.rotate(obj, -1);
      else if (action === 'delete') target.remove(obj);
      else if (action === 'interior') enterInteriorEdit(obj, 'hall');
    },
  });

  /** 水槽の見た目パネルの操作 */
  function changeTankLook(tank, action, value) {
    const look = normalizeLook(tank.userData.look);
    const side = customizer.lookSide;
    let rerender = true;
    if (action.startsWith('look-side-')) customizer.lookSide = action.slice(10);
    else if (action.startsWith('look-swatch-')) {
      // 透明（0%）のまま色を選んだら、見えるように不透明にする
      manager.setTankLook(tank, { [side]: { color: action.slice(12), alpha: look[side].alpha > 0 ? look[side].alpha : 1 } });
    } else if (action === 'param-side-alpha') {
      manager.setTankLook(tank, { [side]: { ...look[side], alpha: value } });
      rerender = false;
    } else if (action === 'look-frame-on') manager.setTankLook(tank, { frame: true });
    else if (action === 'look-frame-off') manager.setTankLook(tank, { frame: false });
    else if (action.startsWith('look-framecolor-')) manager.setTankLook(tank, { frameColor: action.slice(16) });
    else if (action === 'look-light') manager.setTankLook(tank, { light: { on: !look.light.on } });
    else if (action.startsWith('look-lightpreset-')) manager.setTankLook(tank, { light: { color: action.slice(17) } });
    else if (action === 'look-color-lightColor') {
      manager.setTankLook(tank, { light: { color: value } });
      rerender = false;
    } else if (action === 'param-tanklight-intensity') {
      manager.setTankLook(tank, { light: { intensity: value } });
      rerender = false;
    }
    if (rerender) customizer.renderPanel();
  }

  const roomPanel = new RoomPanel({
    el: $('room-panel'),
    getSettings: () => roomSettings,
    getPlan: () => room.plan,
    onChange: (kind, value) => {
      if (kind === 'look') room.applyLook(roomSettings);
      else if (kind === 'lights') room.setLights(roomSettings.lights);
      else if (kind === 'light-update') room.updateLight(value, roomSettings.lights[value]);
      else if (kind === 'light-mode') lightCtl.enabled = value;
      else if (kind === 'shape-mode') {
        shape.enabled = value;
        hall.setEnabled(!value && mode === 'hall-edit');
        customizer.deselect();
        room.showGrid(value);
        shell.setHint(value ? HINT.shape : HINT.hall);
      } else if (kind === 'shape-reset') {
        const saved = room.plan;
        room.setStage(economy.stage, null);
        if (!allObjectsFit()) {
          room.plan = saved;
          refreshRoom();
          room.showGrid(true);
          return toast('長方形に戻すと床からはみ出すオブジェがあります', { error: true });
        }
        room.showGrid(true);
        roomSettings.plan = room.plan.toJSON();
        refreshRoom();
        roomPanel.refresh();
      }
    },
  });

  const catalog = new Catalog({
    tabsEl: $('catalog-tabs'),
    cardsEl: $('catalog-cards'),
    previews,
    economy,
    onSelect: (id) => {
      const active = mode === 'interior-edit' ? interior : hall;
      if (active.placing?.def.id === id) active.cancelPlacement();
      else active.startPlacement(id);
    },
    onTab: (id, extra) => {
      if (mode !== 'hall-edit') return;
      hall.cancelPlacement();
      roomPanel.setVisible(extra && id === 'room');
      if (!extra) shell.setHint(HINT.hall);
    },
  });

  /** 床形状を変えたとき・戻すときに、置いてある物がすべて床に収まるか */
  function allObjectsFit() {
    for (const o of manager.objects.values()) {
      if (o.userData.embed) continue;
      const { hx, hz } = TankManager.footprintHalf(manager.defOf(o), o.rotation.y);
      if (!room.plan.containsRect(o.position.x, o.position.z, hx, hz)) return false;
    }
    return true;
  }

  // ---- 操作 -----------------------------------------------------------------
  // ライトのハンドルは他の操作より先にイベントを取るため、最初に作る
  const lightCtl = new LightInteraction({
    sceneMgr, cameraCtl, room,
    getSettings: () => roomSettings,
    onSelect: (i) => roomPanel.selectLight(i),
  });
  const view = new ViewInteraction({ sceneMgr, manager, onTankTap: (tank) => openTank(tank) });
  const hall = new HallInteraction({
    sceneMgr, cameraCtl, manager, economy, customizer, room, toast,
    onPlacementChange: (id) => {
      catalog.setActive(id);
      shell.setHint(id ? HINT.place : HINT.hall);
    },
    onChanged: () => shell.update(),
    onWallsChanged: () => (wallsDirty = true),
  });
  const shape = new ShapeInteraction({
    sceneMgr, room, manager, toast,
    getBrush: () => roomPanel.brush,
    onChanged: () => {
      roomSettings.plan = room.plan.toJSON();
      refreshRoom();
      roomPanel.refresh();
    },
  });
  const interiorCam = new InteriorCamera(cameraCtl);
  const interior = new InteriorInteraction({
    sceneMgr, cameraCtl, manager, economy, customizer, toast,
    onPlacementChange: (id) => {
      catalog.setActive(id);
      shell.setHint(id ? HINT.place : HINT.interior);
    },
    onChanged: () => shell.update(),
    onExitRequest: () => onDone(),
    onBrushChange: (m) => shell.setHint(m ? HINT.sculpt.replace('{mode}', m === 'inflate' ? '盛る' : '削る') : HINT.interior),
    onGrowChange: (m) => shell.setHint(m ? HINT.grow : HINT.interior),
  });

  // ---- モード ---------------------------------------------------------------
  //   home（館内の閲覧）→ 水槽タップ → tank（水槽の閲覧）→ ✎ → interior-edit
  //   home → ✎ → hall-edit（館内レイアウト編集）→ 水槽の「水槽内」→ interior-edit
  let mode = 'home';
  let focusTank = null;
  let interiorFrom = null;

  function goHome() {
    mode = 'home';
    hall.setEnabled(false);
    shape.enabled = false;
    room.showGrid(false);
    room.setEditVisible(false);
    roomPanel.setVisible(false);
    customizer.deselect();
    view.enabled = true;
    shell.setMode('home');
    shell.setHint(HINT.home);
  }

  function openTank(tank) {
    if (interiorCam.busy) return;
    focusTank = tank;
    mode = 'tank';
    view.enabled = false;
    interiorCam.enter(tank);
    shell.setMode('tank', manager.defOf(tank).name);
    shell.setHint('');
  }

  function enterHallEdit() {
    mode = 'hall-edit';
    view.enabled = false;
    customizer.allowEmbed = true;
    hall.setEnabled(true);
    room.setEditVisible(true);
    catalog.setDefs(HALL_DEFS, [{ id: 'room', label: '部屋' }]);
    shell.setMode('hall-edit', '館内レイアウト編集');
    shell.setHint(HINT.hall);
  }

  function enterInteriorEdit(tank, from) {
    if (interiorCam.busy) return;
    interiorFrom = from;
    focusTank = tank;
    hall.setEnabled(false);
    shape.enabled = false;
    room.showGrid(false);
    roomPanel.setVisible(false);
    customizer.deselect();
    customizer.allowEmbed = false;
    if (from === 'hall') interiorCam.enter(tank);
    interior.attach(tank);
    mode = 'interior-edit';
    catalog.setDefs(INTERIOR_DEFS);
    shell.setMode('interior-edit', `${manager.defOf(tank).name} の水槽内`);
    shell.setHint(HINT.interior);
  }

  function onDone() {
    if (interiorCam.busy) return;
    if (mode === 'hall-edit') return goHome();
    if (mode === 'interior-edit') {
      interior.detach();
      if (interiorFrom === 'tank') {
        mode = 'tank';
        shell.setMode('tank', manager.defOf(focusTank).name);
        shell.setHint('');
      } else {
        interiorCam.exit();
        enterHallEdit();
      }
    }
  }

  const shell = new AppShell({
    economy,
    manager,
    onBack: () => {
      if (mode !== 'tank' || interiorCam.busy) return;
      interiorCam.exit();
      goHome();
    },
    onEdit: () => {
      if (visiting) return;
      if (mode === 'home') enterHallEdit();
      else if (mode === 'tank') enterInteriorEdit(focusTank, 'tank');
    },
    onDone,
    onFloorChange: (floor) => {
      if (!economy.setFloor(floor)) return;
      hall.cancelPlacement();
      customizer.deselect();
      manager.setFloor(economy.floor);
      refreshRoom();
    },
    onUpgrade: () => {
      const res = economy.upgradeStage();
      if (!res.ok) return toast(res.reason, { error: true });
      roomSettings.plan = null; // 新しい広さの長方形から
      applyRoom(true);
      roomPanel.refresh();
      toast(`「${economy.stage.name}」に拡張しました！`);
    },
    onSave: () => {
      downloadJSON(snapshot(), `aquarium-layout-${Date.now()}.json`);
      toast('レイアウトをファイルに保存しました');
    },
    onLoad: async (file) => {
      try {
        applySnapshot(await readLayoutFile(file));
        toast('レイアウトを読み込みました');
      } catch (err) {
        console.error(err);
        toast(`読み込みに失敗しました: ${err.message}`, { error: true });
      }
    },
  });

  /** 現在の状態を保存用データにする */
  function snapshot() {
    roomSettings.plan = room.plan.toJSON();
    return { version: LAYOUT_VERSION, savedAt: new Date().toISOString(), economy: economy.toJSON(), room: roomSettings, objects: manager.serialize() };
  }

  /** 保存用データから状態を復元する */
  function applySnapshot(data) {
    if (mode !== 'home') goHome();
    economy.fromJSON(data.economy);
    roomSettings = { ...defaultRoomSettings(), ...(data.room ?? {}) };
    roomSettings.lights = roomSettings.lights.map(normalizeLight);
    manager.deserialize(data.objects);
    manager.setFloor(economy.floor);
    applyRoom(true);
    shell.update();
  }

  // ---- オンライン：クラウド保存・フレンド・訪問 -------------------------------
  const online = new Online();
  let visiting = null; // { mine: 自分のスナップショット }
  const friendPanel = new FriendPanel({
    el: $('friend-sheet'),
    online,
    toast,
    onSave: async () => {
      if (visiting) return toast('訪問中は保存できません', { error: true });
      toast('クラウドに保存中…');
      await online.save(snapshot());
      toast('クラウドに保存しました');
    },
    onLoad: async () => {
      if (visiting) return toast('訪問中は読み込めません', { error: true });
      const data = await online.load();
      if (!data) return toast('クラウドにまだ保存がありません');
      applySnapshot(data);
      toast('クラウドから読み込みました');
    },
    onVisit: async (id, name) => {
      const data = await online.load(id);
      if (!data) return toast(`${name} さんはまだ水族館を保存していません`, { error: true });
      if (!visiting) visiting = { mine: snapshot() };
      applySnapshot(data);
      document.body.classList.add('visiting');
      $('visit-label').textContent = `${name} さんの水族館`;
      $('visit-bar').hidden = false;
      toast(`${name} さんの水族館を訪問中`);
    },
  });
  $('btn-online').addEventListener('click', () => {
    shell.toggleMenu(false);
    friendPanel.open();
  });
  $('btn-visit-end').addEventListener('click', () => {
    if (!visiting) return;
    applySnapshot(visiting.mine);
    visiting = null;
    document.body.classList.remove('visiting');
    $('visit-bar').hidden = true;
    toast('自分の水族館に戻りました');
  });

  // 初期レイアウト（無料）：バックヤードとの仕切り壁の前に水槽台＋60cm水槽、右寄りに飼育員用ドア
  const b = room.plan.bounds(CELL.FLOOR);
  manager.add('stand60', { x: b.x0 + 0.6, z: b.z0 + 0.2 });
  manager.add('tank60', { x: b.x0 + 0.6, z: b.z0 + 0.2 });
  const doorRun = room.plan.runs().find((r) => r.kind === 'partition');
  if (doorRun) manager.add('staffDoor', { embed: { key: doorRun.key, along: doorRun.to - 0.8, ratio: 0.5, bottom: 0 } });
  refreshRoom();
  goHome();

  // 開発時だけ：ブラウザのコンソールから状態を調べられるようにする
  if (import.meta.env.DEV) window.__app = { sceneMgr, manager, room, economy };

  // ---- ループ ---------------------------------------------------------------
  /**
   * 編集シート（＋詳細パネル）に隠れない領域の中央に視点の中心が来るよう、
   * カメラの投影をずらす（OrbitControls の注視点は変えない）。
   */
  let viewShift = 0;
  const editorEl = $('editor');
  const panelEl = $('detail-panel');
  function updateViewShift() {
    const h = window.innerHeight;
    let top = h;
    if (!editorEl.hidden) top = editorEl.getBoundingClientRect().top;
    if (!editorEl.hidden && !panelEl.hidden) top = Math.min(top, panelEl.getBoundingClientRect().top);
    const target = Math.max(0, (h - top) / 2 - 20);
    viewShift += (target - viewShift) * 0.2;
    const cam = sceneMgr.camera;
    if (viewShift < 0.5) {
      if (cam.view?.enabled) cam.clearViewOffset();
    } else {
      cam.setViewOffset(window.innerWidth, h, 0, viewShift, window.innerWidth, h);
    }
  }

  const clock = new THREE.Clock();
  sceneMgr.renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.1);
    updateViewShift();
    if (wallsDirty) refreshRoom();
    interiorCam.update(dt);
    updateWater(clock.elapsedTime);
    cameraCtl.update();
    manager.updateClips();
    manager.updateAeration(clock.elapsedTime);
    interior.update();
    economy.update(dt, manager.totalAppeal());
    customizer.update();
    sceneMgr.render();
  });

  const wait = MIN_SPLASH_MS - (performance.now() - startedAt);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  splash.setProgress(1, '読み込み中…');
  // 確認用：URL に ?splash を付けるとスプラッシュを閉じない
  if (new URLSearchParams(location.search).has('splash')) return;

  // オンラインにログイン済みなら、そのセーブで始める
  try {
    if (await online.restore()) {
      const data = await online.load();
      if (data) applySnapshot(data);
    }
  } catch (err) {
    console.error(err);
  }
  await splash.hide();
}

boot().catch((err) => {
  console.error(err);
  const label = document.getElementById('splash-label');
  if (label) label.textContent = `起動に失敗しました: ${err.message}`;
});
