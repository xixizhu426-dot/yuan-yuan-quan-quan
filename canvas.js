const safeDpr = () => Math.min(globalThis.devicePixelRatio || 1, 2);

export function createDrawingSession(canvas) {
  const context = canvas.getContext('2d');
  const snapshots = [];
  const redoSnapshots = [];
  let color = '#433059';
  let size = 8;
  let tool = 'brush';
  let brush = 'pencil';
  let opacity = 1;
  let text = '梦';
  let drawing = false;
  let activePointerId = null;
  let previousPoint = null;
  let logicalSize = null;

  const dimensions = () => {
    if (logicalSize) return logicalSize;
    const rect = canvas.getBoundingClientRect();
    return { width: rect.width || canvas.width, height: rect.height || canvas.height };
  };
  const pointFor = (event) => {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };
  const drawStartCircle = () => {
    const { width, height } = dimensions();
    context.fillStyle = '#17131d';
    context.beginPath();
    context.arc(width / 2, height / 2, Math.max(16, Math.min(width, height) * 0.045), 0, Math.PI * 2);
    context.fill();
  };
  const fillBackground = () => {
    const { width, height } = dimensions();
    context.fillStyle = '#fffdfb';
    context.fillRect(0, 0, width, height);
    drawStartCircle();
  };
  const pushSnapshot = () => {
    snapshots.push(canvas.toDataURL('image/png'));
    redoSnapshots.length = 0;
  };
  const hexToRgba = (value) => {
    const normalized = String(value).replace('#', '');
    if (!/^[0-9a-f]{6}$/i.test(normalized)) return [67, 48, 89, 255];
    return [Number.parseInt(normalized.slice(0, 2), 16), Number.parseInt(normalized.slice(2, 4), 16), Number.parseInt(normalized.slice(4, 6), 16), 255];
  };
  const inStartCircle = ({ x, y }) => {
    const { width, height } = dimensions();
    const radius = Math.max(16, Math.min(width, height) * 0.045);
    return Math.hypot(x - width / 2, y - height / 2) <= radius;
  };
  const fillRegion = (point) => {
    if (!context.getImageData || !context.putImageData || inStartCircle(point)) return;
    const image = context.getImageData(0, 0, canvas.width, canvas.height);
    const { width, height, data } = image;
    const { width: logicalWidth, height: logicalHeight } = dimensions();
    const startX = Math.max(0, Math.min(width - 1, Math.floor(point.x * (width / logicalWidth))));
    const startY = Math.max(0, Math.min(height - 1, Math.floor(point.y * (height / logicalHeight))));
    const indexAt = (x, y) => (y * width + x) * 4;
    const firstIndex = indexAt(startX, startY);
    const target = [data[firstIndex], data[firstIndex + 1], data[firstIndex + 2], data[firstIndex + 3]];
    const replacement = hexToRgba(color);
    if (target.every((channel, index) => channel === replacement[index])) return;
    const sameColor = (index) => target.every((channel, offset) => data[index + offset] === channel);
    const stack = [[startX, startY]];
    while (stack.length) {
      const [x, y] = stack.pop();
      if (x < 0 || y < 0 || x >= width || y >= height) continue;
      const index = indexAt(x, y);
      if (!sameColor(index)) continue;
      replacement.forEach((channel, offset) => { data[index + offset] = channel; });
      stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
    context.putImageData(image, 0, 0);
    drawStartCircle();
  };
  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return false;
    const { width, height } = rect;
    logicalSize = { width, height };
    const dpr = safeDpr();
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    context.setTransform?.(dpr, 0, 0, dpr, 0, 0);
    fillBackground();
    return true;
  };
  const drawSegment = (from, to) => {
    const settings = {
      pencil: { alpha: 1, width: 1 },
      marker: { alpha: .72, width: 1.45 },
      watercolor: { alpha: .2, width: 2.5 },
      spray: { alpha: .32, width: 1 },
      glow: { alpha: .88, width: 1.2, glow: 14 },
      charcoal: { alpha: .58, width: 1.8 },
    }[brush] ?? { alpha: 1, width: 1 };
    context.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over';
    context.globalAlpha = opacity * settings.alpha;
    context.strokeStyle = color;
    context.fillStyle = color;
    context.lineWidth = size * settings.width;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.shadowColor = settings.glow ? color : 'transparent';
    context.shadowBlur = settings.glow ?? 0;
    if (brush === 'spray' && tool !== 'eraser') {
      const distance = Math.hypot(to.x - from.x, to.y - from.y);
      const steps = Math.max(2, Math.ceil(distance / 5));
      for (let step = 0; step <= steps; step += 1) {
        const progress = step / steps;
        const x = from.x + (to.x - from.x) * progress + (Math.random() - .5) * size * 1.4;
        const y = from.y + (to.y - from.y) * progress + (Math.random() - .5) * size * 1.4;
        context.beginPath();
        context.arc(x, y, Math.max(1, size * .13), 0, Math.PI * 2);
        context.fill();
      }
    } else {
      context.beginPath();
      context.moveTo(from.x, from.y);
      context.lineTo(to.x, to.y);
      context.stroke();
    }
    context.globalAlpha = 1;
    context.globalCompositeOperation = 'source-over';
    context.shadowBlur = 0;
  };
  const restore = (dataUrl) => {
    if (typeof Image === 'undefined') {
      fillBackground();
      return;
    }
    const image = new Image();
    image.onload = () => {
      const { width, height } = dimensions();
      context.drawImage(image, 0, 0, width, height);
    };
    image.src = dataUrl;
  };
  const finishStroke = (event) => {
    if (!drawing || (event && event.pointerId !== activePointerId)) return;
    if (event && previousPoint) drawSegment(previousPoint, pointFor(event));
    drawing = false;
    activePointerId = null;
    previousPoint = null;
    drawStartCircle();
    pushSnapshot();
  };
  const onPointerDown = (event) => {
    event.preventDefault();
    const point = pointFor(event);
    if (tool === 'circle') {
      context.globalAlpha = opacity;
      context.strokeStyle = color;
      context.lineWidth = size;
      context.beginPath();
      context.arc(point.x, point.y, Math.max(12, size * 3), 0, Math.PI * 2);
      context.stroke();
      context.globalAlpha = 1;
      drawStartCircle();
      pushSnapshot();
      return;
    }
    if (tool === 'text') {
      context.globalAlpha = opacity;
      context.fillStyle = color;
      context.font = `${Math.max(18, size * 3)}px system-ui, sans-serif`;
      context.fillText(text, point.x, point.y);
      context.globalAlpha = 1;
      drawStartCircle();
      pushSnapshot();
      return;
    }
    if (tool === 'stamp') {
      context.globalAlpha = opacity;
      context.fillStyle = color;
      [[0, 0, size * 1.6], [size * 1.9, -size, size * .8], [-size * 1.6, size, size * .65]].forEach(([offsetX, offsetY, radius]) => {
        context.beginPath();
        context.arc(point.x + offsetX, point.y + offsetY, Math.max(5, radius), 0, Math.PI * 2);
        context.fill();
      });
      context.globalAlpha = 1;
      drawStartCircle();
      pushSnapshot();
      return;
    }
    if (tool === 'fill') {
      fillRegion(point);
      pushSnapshot();
      return;
    }
    drawing = true;
    activePointerId = event.pointerId;
    previousPoint = point;
    canvas.setPointerCapture?.(event.pointerId);
  };
  const onPointerMove = (event) => {
    if (!drawing || event.pointerId !== activePointerId) return;
    event.preventDefault();
    const point = pointFor(event);
    drawSegment(previousPoint, point);
    previousPoint = point;
  };

  canvas.style.touchAction = 'none';
  resize();
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', finishStroke);
  canvas.addEventListener('pointercancel', finishStroke);
  canvas.addEventListener('lostpointercapture', finishStroke);

  return {
    setColor(nextColor) { color = nextColor; },
    setSize(nextSize) { size = Number(nextSize); },
    setTool(nextTool) { tool = ['eraser', 'circle', 'fill', 'stamp', 'text'].includes(nextTool) ? nextTool : 'brush'; },
    setBrush(nextBrush) {
      brush = ['pencil', 'marker', 'watercolor', 'spray', 'glow', 'charcoal'].includes(nextBrush) ? nextBrush : 'pencil';
      return brush;
    },
    setOpacity(nextOpacity) { opacity = Math.max(0.05, Math.min(1, Number(nextOpacity) || 1)); },
    setText(nextText) { text = String(nextText ?? '').trim().slice(0, 24) || '梦'; },
    undo() {
      if (!snapshots.length) return false;
      redoSnapshots.push(snapshots.pop());
      const prior = snapshots.at(-1);
      if (prior) restore(prior); else fillBackground();
      return true;
    },
    redo() {
      const next = redoSnapshots.pop();
      if (!next) return false;
      snapshots.push(next);
      restore(next);
      return true;
    },
    clear() { snapshots.length = 0; redoSnapshots.length = 0; fillBackground(); },
    exportPng() { return canvas.toDataURL('image/png'); },
    reset() { snapshots.length = 0; redoSnapshots.length = 0; resize(); },
    resize,
    destroy() {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', finishStroke);
      canvas.removeEventListener('pointercancel', finishStroke);
      canvas.removeEventListener('lostpointercapture', finishStroke);
    },
  };
}
