import { createDrawingSession } from './canvas.js?v=8';
import { createWorldStore } from './storage.js?v=6';
import { createRelayRoom, handoff, continueRelay, endRelay } from './relay.js?v=7';
import { createExploreSession } from './explore.js?v=7';

export const ROUTES = ['home', 'studio', 'gallery', 'explore', 'relay', 'lodge', 'plaza'];
const escapeHtml = (value) => String(value).replace(/[&<>"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[character]));

export function renderGallery(works) {
  if (!works.length) return '<div class="gallery-empty"><div class="empty-orbit" aria-hidden="true"></div><h3>还没有作品</h3><p>从一个黑色圆圈出发，画出第一段想象。</p><button class="button primary" type="button" data-go="studio">开始第一幅创作</button></div>';
  return `<div class="work-grid">${works.map((work) => `<article class="work-card"><button class="work-preview" type="button" data-view-work="${escapeHtml(work.id)}" aria-label="查看作品 ${escapeHtml(work.title)}"><img src="${work.image}" alt="${escapeHtml(work.title)}" /></button><div class="work-meta"><div><h3>${escapeHtml(work.title)}</h3><p>${new Date(work.createdAt).toLocaleString('zh-CN', { dateStyle: 'medium', timeStyle: 'short' })}</p></div><button class="delete-button" type="button" data-delete-work="${escapeHtml(work.id)}" aria-label="删除 ${escapeHtml(work.title)}">删除</button></div></article>`).join('')}</div>`;
}

const creationMode = (mode) => ({ free: '自由想象', explore: '想象探索' }[mode] ?? '创作瞬间');
const toLodgeModel = (model) => (Array.isArray(model)
  ? { snapshots: model, photoWall: [], works: [] }
  : {
    snapshots: Array.isArray(model?.snapshots) ? model.snapshots : [],
    photoWall: Array.isArray(model?.photoWall) ? model.photoWall : [],
    works: Array.isArray(model?.works) ? model.works : [],
  });

export function renderLodge(model, activeTab = 'wall') {
  const { snapshots, photoWall, works } = toLodgeModel(model);
  const snapshotById = new Map(snapshots.map((snapshot) => [snapshot.id, snapshot]));
  const placedIds = new Set(photoWall.map((item) => item.snapshotId));
  const tabs = `<div class="lodge-tabs" role="tablist" aria-label="我的小屋内容"><button role="tab" aria-selected="${activeTab === 'wall'}" data-lodge-tab="wall">私人照片墙</button><button role="tab" aria-selected="${activeTab === 'works'}" data-lodge-tab="works">我的作品</button><button role="tab" aria-selected="${activeTab === 'record'}" data-lodge-tab="record">创作记录</button></div>`;
  if (activeTab === 'works') return `${tabs}<section class="lodge-section"><h3>我的作品</h3>${renderGallery(works)}</section>`;
  if (activeTab === 'record') {
    const entries = [...works.map((work) => ({ ...work, kind: '作品' })), ...snapshots.map((snapshot) => ({ ...snapshot, kind: creationMode(snapshot.mode) }))].sort((first, second) => Date.parse(second.createdAt) - Date.parse(first.createdAt));
    const record = entries.length ? `<div class="creation-record">${entries.map((entry) => `<article><img src="${entry.image}" alt="${escapeHtml(entry.kind)}"/><div><strong>${escapeHtml(entry.kind)}</strong><p>${new Date(entry.createdAt).toLocaleString('zh-CN', { dateStyle: 'medium', timeStyle: 'short' })}</p></div></article>`).join('')}</div>` : '<p class="lodge-empty">还没有创作记录。开始画一笔，记录就会在这里出现。</p>';
    return `${tabs}<section class="lodge-section"><h3>创作记录</h3>${record}</section>`;
  }
  const wallItems = photoWall.map((item) => ({ item, snapshot: snapshotById.get(item.snapshotId) })).filter(({ snapshot }) => snapshot);
  const unplaced = snapshots.filter((snapshot) => !placedIds.has(snapshot.id));
  const wall = wallItems.length ? `<div class="photo-wall">${wallItems.map(({ item, snapshot }) => `<figure><img src="${snapshot.image}" alt="创作瞬间" /><figcaption>${escapeHtml(creationMode(snapshot.mode))}<button class="text-button" data-action="remove-wall-item" data-wall-item="${escapeHtml(item.id)}">取下</button></figcaption></figure>`).join('')}</div>` : '<p class="lodge-empty">还没有照片墙素材。创作时点击“截图保存”，把此刻留在小屋里。</p>';
  const library = unplaced.length ? `<div class="snapshot-library"><h4>还没有挂上的创作瞬间</h4>${unplaced.map((snapshot) => `<button data-action="place-snapshot" data-snapshot-id="${escapeHtml(snapshot.id)}"><img src="${snapshot.image}" alt="${escapeHtml(creationMode(snapshot.mode))}"/><span>放进照片墙</span></button>`).join('')}</div>` : '';
  return `${tabs}<section class="lodge-section"><h3>私人照片墙</h3>${wall}${library}</section>`;
}

export function renderPlaza() {
  return '<div class="plaza-shell"><p class="eyebrow">圆圈广场</p><h2>把灵感留给以后相遇</h2><div class="plaza-demo" aria-label="本地演示作品"><i></i><i></i><i></i></div><button class="button ghost" type="button" disabled>发布到广场（即将开放）</button><p>这是本地展示骨架，暂不支持真实发布、点赞或在线互动。</p></div>';
}

export function showScreen(screenName) {
  if (!ROUTES.includes(screenName)) throw new Error(`未知页面：${screenName}`);
  if (typeof document !== 'undefined') {
    document.querySelectorAll('[data-screen]').forEach((screen) => { screen.hidden = screen.dataset.screen !== screenName; });
    document.querySelector(`[data-screen="${screenName}"] h1, [data-screen="${screenName}"] h2`)?.focus();
  }
  return screenName;
}

if (typeof document !== 'undefined') {
  const worldStore = createWorldStore(window.localStorage);
  const store = worldStore.works;
  const session = createDrawingSession(document.querySelector('#drawing-canvas'));
  const gallery = document.querySelector('#gallery-content');
  const lodgeContent = document.querySelector('#lodge-content');
  const toast = document.querySelector('#toast');
  const dialog = document.querySelector('#work-dialog');
  const dialogImage = document.querySelector('#dialog-image');
  const dialogTitle = document.querySelector('#dialog-title');
  const relayContent = document.querySelector('#relay-content');
  const relayWorkspace = document.querySelector('#relay-workspace');
  const relayCanvas = document.querySelector('#relay-canvas');
  const relayCanvasMessage = document.querySelector('#relay-canvas-message');
  const plazaContent = document.querySelector('#plaza-content');
  const exploreCanvas = document.querySelector('#explore-canvas');
  const exploreSession = exploreCanvas ? createExploreSession(exploreCanvas) : null;
  const relaySession = relayCanvas ? createDrawingSession(relayCanvas) : null;
  const savedRelayRoom = worldStore.relayRooms.list()[0] ?? null;
  let relayRoom = savedRelayRoom
    ? {
      ...savedRelayRoom,
      round: Number.isInteger(savedRelayRoom.round) && savedRelayRoom.round > 0 ? savedRelayRoom.round : 1,
      status: ['drawing', 'round-complete', 'ended'].includes(savedRelayRoom.status) ? savedRelayRoom.status : 'drawing',
    }
    : null;
  let lodgeTab = 'wall';
  let studioPrepared = false;
  let relayCanvasPrepared = false;
  const announce = (message) => { toast.textContent = message; window.setTimeout(() => { if (toast.textContent === message) toast.textContent = ''; }, 2800); };
  const refreshGallery = () => { gallery.innerHTML = renderGallery(store.list()); };
  const refreshLodge = () => {
    worldStore.snapshots.list().forEach((snapshot) => worldStore.placeSnapshot(snapshot.id));
    if (lodgeContent) lodgeContent.innerHTML = renderLodge({ works: store.list(), snapshots: worldStore.snapshots.list(), photoWall: worldStore.photoWall.list() }, lodgeTab);
  };
  const refreshPlaza = () => { if (plazaContent) plazaContent.innerHTML = renderPlaza(); };
  const go = (screenName) => {
    showScreen(screenName);
    if (screenName === 'studio' && !studioPrepared) {
      session.resize();
      studioPrepared = true;
    }
    if (screenName === 'gallery') refreshGallery();
    if (screenName === 'lodge') refreshLodge();
    if (screenName === 'plaza') refreshPlaza();
    if (screenName === 'relay') renderRelay();
  };
  const persistRelay = () => {
    if (!relayRoom) return;
    worldStore.relayRooms.remove(relayRoom.id);
    worldStore.relayRooms.save(relayRoom);
  };
  const syncRelayWorkspace = () => {
    if (!relayWorkspace || !relayCanvas || !relaySession) return;
    relayWorkspace.hidden = !relayRoom;
    if (!relayRoom) return;
    if (!relayCanvasPrepared && relayWorkspace.getBoundingClientRect().width > 0) {
      relaySession.reset();
      relayCanvasPrepared = true;
    }
    const canDraw = relayRoom.status === 'drawing';
    relayCanvas.style.pointerEvents = canDraw ? 'auto' : 'none';
    relayCanvas.setAttribute('aria-disabled', String(!canDraw));
    if (!relayCanvasMessage) return;
    if (canDraw) {
      relayCanvasMessage.textContent = `第 ${relayRoom.round} 轮 · ${relayRoom.players[relayRoom.currentPlayer].name} 正在创作，画完后交给下一位。`;
    } else if (relayRoom.status === 'round-complete') {
      relayCanvasMessage.textContent = `第 ${relayRoom.round} 轮完成。选择继续即可从第 ${relayRoom.round + 1} 轮重新开始。`;
    } else {
      relayCanvasMessage.textContent = `接力已结束，共完成 ${relayRoom.round} 轮。画面会保留在这个房间里。`;
    }
  };
  const renderRelay = () => {
    if (!relayContent) return;
    if (!relayRoom) {
      relayContent.innerHTML = '<div class="relay-choice"><p>先选这次接力的人数</p><div class="button-row"><button class="button primary" data-action="create-relay" data-player-count="2">2 人接力</button><button class="button ghost" data-action="create-relay" data-player-count="3">3 人接力</button><button class="button ghost" data-action="create-relay" data-player-count="4">4 人接力</button></div></div>';
      syncRelayWorkspace();
      return;
    }
    const isDrawing = relayRoom.status === 'drawing';
    const players = relayRoom.players.map((player, index) => `<li class="${isDrawing && index === relayRoom.currentPlayer ? 'is-current' : ''}"><span>${index + 1}</span>${escapeHtml(player.name)}${isDrawing && index === relayRoom.currentPlayer ? ' · 正在创作' : ''}</li>`).join('');
    const action = isDrawing
      ? `<p class="relay-round">第 ${relayRoom.round} 轮 · ${escapeHtml(relayRoom.players[relayRoom.currentPlayer].name)} 的回合</p><button class="button primary" data-action="handoff">完成并交给下一位</button>`
      : relayRoom.status === 'round-complete'
        ? `<p class="relay-round">第 ${relayRoom.round} 轮已完成</p><div class="button-row"><button class="button primary" data-action="continue-relay">继续第 ${relayRoom.round + 1} 轮</button><button class="button ghost" data-action="end-relay">结束接力</button></div>`
        : '<p class="relay-round">本次接力已结束</p>';
    relayContent.innerHTML = `<div class="relay-room"><p class="relay-badge">本地同屏接力 · 在线邀请将在联网阶段开放</p><p class="relay-code">邀请码 <strong>${escapeHtml(relayRoom.inviteCode)}</strong><button class="text-button" data-action="copy-relay">复制</button></p><ol class="relay-players">${players}</ol>${action}<button class="text-button" data-action="reset-relay">重新创建房间</button></div>`;
    syncRelayWorkspace();
  };
  const copyRelayInvite = async () => {
    if (!relayRoom) return;
    try {
      if (!window.navigator.clipboard?.writeText) throw new Error('clipboard unavailable');
      await window.navigator.clipboard.writeText(relayRoom.inviteCode);
      announce('邀请码已复制');
    } catch {
      announce(`邀请码是 ${relayRoom.inviteCode}`);
    }
  };
  document.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.go) go(button.dataset.go);
    if (button.dataset.color) {
      session.setColor(button.dataset.color);
      document.querySelector('.circle-companion')?.style.setProperty('--companion-halo', button.dataset.color);
      document.querySelectorAll('[data-color]').forEach((swatch) => swatch.setAttribute('aria-pressed', String(swatch === button)));
    }
    if (button.dataset.size) { session.setSize(button.dataset.size); document.querySelectorAll('[data-size]').forEach((sizeButton) => sizeButton.setAttribute('aria-pressed', String(sizeButton === button))); }
    if (button.dataset.brush) {
      const brushLabels = { pencil: '铅笔', marker: '马克笔', watercolor: '水彩', spray: '喷笔', glow: '荧光笔', charcoal: '炭笔' };
      session.setBrush(button.dataset.brush);
      document.querySelectorAll('[data-brush]').forEach((brushButton) => brushButton.setAttribute('aria-pressed', String(brushButton === button)));
      announce(`已选择${brushLabels[button.dataset.brush]}`);
    }
    if (button.dataset.tool) {
      const toolLabels = { brush: '画笔', eraser: '橡皮擦', fill: '填色', stamp: '圆点素材', text: '文字', circle: '圆圈' };
      session.setTool(button.dataset.tool);
      document.querySelectorAll('[data-tool]').forEach((toolButton) => toolButton.setAttribute('aria-pressed', String(toolButton === button)));
      announce(`已切换${toolLabels[button.dataset.tool] ?? '画笔'}`);
    }
    if (button.matches('[data-action="undo"]')) announce(session.undo() ? '已撤销上一笔' : '还没有可以撤销的笔触');
    if (button.matches('[data-action="redo"]')) announce(session.redo() ? '已重做一笔' : '还没有可以重做的笔触');
    if (button.matches('[data-action="snapshot"]')) { const snapshot = worldStore.snapshots.save(session.exportPng(), { mode: 'free' }); worldStore.placeSnapshot(snapshot.id); announce('此刻已保存到照片墙素材'); }
    if (button.matches('[data-action="create-relay"]')) { relayRoom = createRelayRoom({ playerCount: Number(button.dataset.playerCount) || 2, hostName: '我' }); relayCanvasPrepared = false; persistRelay(); renderRelay(); announce('已创建接力房间，可以开始画第一笔'); }
    if (button.matches('[data-action="handoff"]') && relayRoom) { relayRoom = handoff(relayRoom); persistRelay(); renderRelay(); announce(relayRoom.status === 'round-complete' ? '这一轮完成了，选择继续或结束吧' : '已交给下一位'); }
    if (button.matches('[data-action="continue-relay"]') && relayRoom) { relayRoom = continueRelay(relayRoom); persistRelay(); renderRelay(); announce(`第 ${relayRoom.round} 轮开始，由第一位玩家继续创作`); }
    if (button.matches('[data-action="end-relay"]') && relayRoom) { relayRoom = endRelay(relayRoom); persistRelay(); renderRelay(); announce('本次接力已结束，画面会保留在房间里'); }
    if (button.matches('[data-action="copy-relay"]')) copyRelayInvite();
    if (button.matches('[data-action="reset-relay"]') && relayRoom) { worldStore.relayRooms.remove(relayRoom.id); relayRoom = null; relayCanvasPrepared = false; renderRelay(); announce('可以重新选择接力人数'); }
    if (button.dataset.relayColor && relaySession) {
      relaySession.setColor(button.dataset.relayColor);
      document.querySelectorAll('[data-relay-color]').forEach((swatch) => swatch.setAttribute('aria-pressed', String(swatch === button)));
    }
    if (button.dataset.relaySize && relaySession) {
      relaySession.setSize(button.dataset.relaySize);
      document.querySelectorAll('[data-relay-size]').forEach((sizeButton) => sizeButton.setAttribute('aria-pressed', String(sizeButton === button)));
    }
    if (button.dataset.relayTool && relaySession) {
      relaySession.setTool(button.dataset.relayTool);
      document.querySelectorAll('[data-relay-tool]').forEach((toolButton) => toolButton.setAttribute('aria-pressed', String(toolButton === button)));
    }
    if (button.dataset.exploreTool && exploreSession) {
      exploreSession.setTool(button.dataset.exploreTool);
      document.querySelectorAll('[data-explore-tool]').forEach((toolButton) => toolButton.setAttribute('aria-pressed', String(toolButton === button)));
    }
    if (button.dataset.exploreColor && exploreSession) {
      exploreSession.setColor(button.dataset.exploreColor);
      document.querySelectorAll('[data-explore-color]').forEach((swatch) => swatch.setAttribute('aria-pressed', String(swatch === button)));
    }
    if (button.dataset.exploreSize && exploreSession) {
      exploreSession.setSize(button.dataset.exploreSize);
      document.querySelectorAll('[data-explore-size]').forEach((sizeButton) => sizeButton.setAttribute('aria-pressed', String(sizeButton === button)));
    }
    if (button.matches('[data-action="explore-zoom-in"]') && exploreSession) exploreSession.zoomBy(4);
    if (button.matches('[data-action="explore-zoom-out"]') && exploreSession) exploreSession.zoomBy(-4);
    if (button.matches('[data-action="explore-snapshot"]') && exploreSession) { const snapshot = worldStore.snapshots.save(exploreSession.exportPng(), { mode: 'explore' }); worldStore.placeSnapshot(snapshot.id); announce('探索快照已存到照片墙素材'); }
    if (button.dataset.lodgeTab) { lodgeTab = button.dataset.lodgeTab; refreshLodge(); }
    if (button.matches('[data-action="place-snapshot"]')) { if (worldStore.placeSnapshot(button.dataset.snapshotId)) { refreshLodge(); announce('已放进私人照片墙'); } }
    if (button.matches('[data-action="remove-wall-item"]')) { worldStore.photoWall.remove(button.dataset.wallItem); refreshLodge(); announce('已从照片墙取下'); }
    if (button.matches('[data-action="clear"]') && window.confirm('要清空这张画吗？这一步不能撤销。')) { session.clear(); announce('画板已清空，黑色圆圈回来了'); }
    if (button.matches('[data-action="reset"]')) { session.reset(); announce('已恢复到最初的黑色圆圈'); }
    if (button.matches('[data-action="save"]')) { store.save(session.exportPng()); announce('作品已保存在这个浏览器里'); }
    if (button.dataset.viewWork) { const work = store.list().find(({ id }) => id === button.dataset.viewWork); if (work) { dialogTitle.textContent = work.title; dialogImage.src = work.image; dialogImage.alt = work.title; dialog.showModal(); } }
    if (button.dataset.deleteWork && window.confirm('确定删除这幅作品吗？删除后无法恢复。')) { store.remove(button.dataset.deleteWork); refreshGallery(); announce('作品已删除'); }
  });
  document.querySelector('[data-action="close-dialog"]')?.addEventListener('click', () => dialog.close());
  document.querySelector('[data-opacity]')?.addEventListener('input', (event) => session.setOpacity(event.target.value));
  document.querySelector('[data-text]')?.addEventListener('input', (event) => session.setText(event.target.value));
  renderRelay();
  refreshPlaza();
  refreshGallery();
}
