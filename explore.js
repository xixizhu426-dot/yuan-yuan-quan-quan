const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

export function createExploreModel() {
  let zoom = 1;
  const offset = { x: 0, y: 0 };
  return {
    zoomBy(delta) { zoom = clamp(zoom + delta * 0.05, 0.5, 3); },
    panBy(x, y) { offset.x += x; offset.y += y; },
    view() { return { zoom, offset: { ...offset } }; },
  };
}

export function createExploreSession(canvas) {
  const context = canvas.getContext('2d');
  const model = createExploreModel();
  const marks = [];
  const strokes = [];
  let tool = 'brush';
  let color = '#ff8ca7';
  let size = 10;
  let activePointerId = null;
  let lastPoint = null;

  const pointFor = (event) => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (canvas.width / (rect.width || canvas.width)),
      y: (event.clientY - rect.top) * (canvas.height / (rect.height || canvas.height)),
    };
  };
  const canvasPointToWorld = ({ x, y }) => {
    const { zoom, offset } = model.view();
    return { x: (x - offset.x) / zoom, y: (y - offset.y) / zoom };
  };
  const draw = () => {
    const { zoom, offset } = model.view();
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#fff9f2';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.save();
    context.translate(offset.x, offset.y);
    context.scale(zoom, zoom);
    context.fillStyle = '#ffca5b';
    context.beginPath();
    context.arc(450, 250, 42, 0, Math.PI * 2);
    context.fill();
    strokes.forEach((stroke) => {
      if (!stroke.points.length) return;
      context.strokeStyle = stroke.color;
      context.fillStyle = stroke.color;
      context.lineWidth = stroke.size;
      context.lineCap = 'round';
      context.lineJoin = 'round';
      context.beginPath();
      context.moveTo(stroke.points[0].x, stroke.points[0].y);
      stroke.points.slice(1).forEach((point) => context.lineTo(point.x, point.y));
      if (stroke.points.length === 1) {
        context.arc(stroke.points[0].x, stroke.points[0].y, Math.max(2, stroke.size / 2), 0, Math.PI * 2);
        context.fill();
      } else {
        context.stroke();
      }
    });
    marks.forEach((mark) => {
      context.fillStyle = mark.color;
      context.beginPath();
      context.arc(mark.x, mark.y, 20, 0, Math.PI * 2);
      context.fill();
    });
    context.restore();
  };
  const drawCircle = (x, y, color = '#ff8ca7') => {
    const mark = { x, y, color };
    marks.push(mark);
    draw();
    return mark;
  };
  const onPointerDown = (event) => {
    event.preventDefault();
    activePointerId = event.pointerId;
    lastPoint = pointFor(event);
    const worldPoint = canvasPointToWorld(lastPoint);
    if (tool === 'circle') {
      drawCircle(worldPoint.x, worldPoint.y, color);
      activePointerId = null;
      lastPoint = null;
      return;
    }
    if (tool === 'brush') {
      strokes.push({ color, size, points: [worldPoint] });
      draw();
    }
    canvas.setPointerCapture?.(event.pointerId);
  };
  const onPointerMove = (event) => {
    if (event.pointerId !== activePointerId || !lastPoint) return;
    event.preventDefault();
    const point = pointFor(event);
    const moveX = point.x - lastPoint.x;
    const moveY = point.y - lastPoint.y;
    if (tool === 'move') {
      model.panBy(moveX, moveY);
    } else if (tool === 'brush') {
      strokes.at(-1)?.points.push(canvasPointToWorld(point));
    }
    draw();
    lastPoint = point;
  };
  const onPointerUp = (event) => {
    if (event.pointerId !== activePointerId || !lastPoint) return;
    activePointerId = null;
    lastPoint = null;
    canvas.releasePointerCapture?.(event.pointerId);
  };
  const onWheel = (event) => {
    event.preventDefault();
    model.zoomBy(event.deltaY > 0 ? -1 : 1);
    draw();
  };

  canvas.style.touchAction = 'none';
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  draw();

  return {
    zoomBy(delta) { model.zoomBy(delta); draw(); },
    panBy(x, y) { model.panBy(x, y); draw(); },
    view: () => model.view(),
    setTool(nextTool) {
      tool = ['move', 'circle'].includes(nextTool) ? nextTool : 'brush';
      return tool;
    },
    setColor(nextColor) { color = nextColor; },
    setSize(nextSize) { size = Math.max(1, Number(nextSize) || 10); },
    drawCircle,
    exportPng: () => canvas.toDataURL('image/png'),
    destroy() {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      canvas.removeEventListener('wheel', onWheel);
    },
  };
}
