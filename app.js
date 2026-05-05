const fileInput = document.querySelector("#fileInput");
const dropZone = document.querySelector("#dropZone");
const canvas = document.querySelector("#cropCanvas");
const ctx = canvas.getContext("2d");
const resetButton = document.querySelector("#resetButton");
const downloadButton = document.querySelector("#downloadButton");
const trimButton = document.querySelector("#trimButton");
const fitButton = document.querySelector("#fitButton");
const imageMeta = document.querySelector("#imageMeta");
const cropMeta = document.querySelector("#cropMeta");

const inputs = {
  left: document.querySelector("#leftInput"),
  top: document.querySelector("#topInput"),
  width: document.querySelector("#widthInput"),
  height: document.querySelector("#heightInput"),
};

const HANDLE_SIZE = 13;
const MIN_CROP_SIZE = 8;

let image = null;
let downloadFileName = "cropped-image.png";
let mimeType = "image/png";
let crop = null;
let scale = 1;
let offsetX = 0;
let offsetY = 0;
let activeDrag = null;

function setEnabled(enabled) {
  [resetButton, downloadButton, trimButton, fitButton, ...Object.values(inputs)].forEach(
    (element) => {
      element.disabled = !enabled;
    },
  );
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function normalizeCrop(nextCrop) {
  const x = clamp(Math.round(nextCrop.x), 0, image.width - MIN_CROP_SIZE);
  const y = clamp(Math.round(nextCrop.y), 0, image.height - MIN_CROP_SIZE);
  const width = clamp(Math.round(nextCrop.width), MIN_CROP_SIZE, image.width - x);
  const height = clamp(Math.round(nextCrop.height), MIN_CROP_SIZE, image.height - y);
  return { x, y, width, height };
}

function imageToCanvas(point) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (point.clientX - rect.left - offsetX) / scale,
    y: (point.clientY - rect.top - offsetY) / scale,
  };
}

function getDisplayCrop() {
  return {
    x: offsetX + crop.x * scale,
    y: offsetY + crop.y * scale,
    width: crop.width * scale,
    height: crop.height * scale,
  };
}

function resizeCanvas() {
  const rect = dropZone.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.floor(rect.width * dpr));
  canvas.height = Math.max(1, Math.floor(rect.height * dpr));
  canvas.style.width = `${rect.width}px`;
  canvas.style.height = `${rect.height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  render();
}

function render() {
  const rect = canvas.getBoundingClientRect();
  ctx.clearRect(0, 0, rect.width, rect.height);

  if (!image || !crop) return;

  const fitScale = Math.min(rect.width / image.width, rect.height / image.height);
  scale = Math.max(0.01, fitScale);
  offsetX = (rect.width - image.width * scale) / 2;
  offsetY = (rect.height - image.height * scale) / 2;

  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image, offsetX, offsetY, image.width * scale, image.height * scale);

  const display = getDisplayCrop();
  ctx.save();
  ctx.fillStyle = "rgba(10, 19, 28, 0.55)";
  ctx.beginPath();
  ctx.rect(0, 0, rect.width, rect.height);
  ctx.rect(display.x, display.y, display.width, display.height);
  ctx.fill("evenodd");
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 3;
  ctx.strokeRect(display.x, display.y, display.width, display.height);
  ctx.strokeStyle = "#0f7b6c";
  ctx.lineWidth = 2;
  ctx.strokeRect(display.x + 1, display.y + 1, display.width - 2, display.height - 2);
  drawHandles(display);
  ctx.restore();
}

function drawHandles(display) {
  const handles = getHandles(display);
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#0f7b6c";
  ctx.lineWidth = 2;

  Object.values(handles).forEach(({ x, y }) => {
    ctx.beginPath();
    ctx.rect(x - HANDLE_SIZE / 2, y - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
    ctx.fill();
    ctx.stroke();
  });
}

function getHandles(display) {
  const x1 = display.x;
  const y1 = display.y;
  const x2 = display.x + display.width;
  const y2 = display.y + display.height;
  const cx = display.x + display.width / 2;
  const cy = display.y + display.height / 2;
  return {
    nw: { x: x1, y: y1 },
    n: { x: cx, y: y1 },
    ne: { x: x2, y: y1 },
    e: { x: x2, y: cy },
    se: { x: x2, y: y2 },
    s: { x: cx, y: y2 },
    sw: { x: x1, y: y2 },
    w: { x: x1, y: cy },
  };
}

function updateMeta() {
  if (!image || !crop) {
    imageMeta.textContent = "No image loaded";
    cropMeta.textContent = "Crop size will appear here.";
    return;
  }

  imageMeta.textContent = `${image.width} x ${image.height}px source`;
  cropMeta.textContent = `${crop.width} x ${crop.height}px crop, exported at original pixel size`;
  inputs.left.value = crop.x;
  inputs.top.value = crop.y;
  inputs.width.value = crop.width;
  inputs.height.value = crop.height;
}

function loadFile(file) {
  if (!file || !file.type.startsWith("image/")) return;

  const reader = new FileReader();
  reader.onload = () => {
    const nextImage = new Image();
    nextImage.onload = () => {
      image = nextImage;
      downloadFileName = file.name || "cropped-image.png";
      mimeType = ["image/jpeg", "image/png", "image/webp"].includes(file.type)
        ? file.type
        : "image/png";
      crop = autoTrim() ?? { x: 0, y: 0, width: image.width, height: image.height };
      dropZone.classList.add("has-image");
      setEnabled(true);
      updateInputLimits();
      updateMeta();
      resizeCanvas();
    };
    nextImage.src = reader.result;
  };
  reader.readAsDataURL(file);
}

function updateInputLimits() {
  if (!image) return;
  inputs.left.max = image.width - MIN_CROP_SIZE;
  inputs.top.max = image.height - MIN_CROP_SIZE;
  inputs.width.max = image.width;
  inputs.height.max = image.height;
}

function autoTrim() {
  if (!image) return null;

  const probe = document.createElement("canvas");
  const probeCtx = probe.getContext("2d", { willReadFrequently: true });
  probe.width = image.width;
  probe.height = image.height;
  probeCtx.drawImage(image, 0, 0);

  const { data, width, height } = probeCtx.getImageData(0, 0, probe.width, probe.height);
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const alpha = data[index + 3];
      const red = data[index];
      const green = data[index + 1];
      const blue = data[index + 2];
      const isWhite = alpha === 0 || (red > 244 && green > 244 && blue > 244);

      if (!isWhite) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (maxX < 0 || maxY < 0) return null;

  const padding = 2;
  return normalizeCrop({
    x: minX - padding,
    y: minY - padding,
    width: maxX - minX + 1 + padding * 2,
    height: maxY - minY + 1 + padding * 2,
  });
}

function handlePointerDown(event) {
  if (!image || !crop) return;
  canvas.setPointerCapture(event.pointerId);
  const display = getDisplayCrop();
  const pointer = { x: event.offsetX, y: event.offsetY };
  const handle = findHandle(pointer, display);
  const imagePoint = imageToCanvas(event);
  const inside =
    imagePoint.x >= crop.x &&
    imagePoint.x <= crop.x + crop.width &&
    imagePoint.y >= crop.y &&
    imagePoint.y <= crop.y + crop.height;

  if (!handle && !inside) {
    crop = normalizeCrop({ x: imagePoint.x, y: imagePoint.y, width: 1, height: 1 });
    activeDrag = {
      mode: "create",
      start: imagePoint,
      initial: { ...crop },
    };
  } else {
    activeDrag = {
      mode: handle || "move",
      start: imagePoint,
      initial: { ...crop },
    };
  }
}

function findHandle(pointer, display) {
  const handles = getHandles(display);
  return Object.entries(handles).find(([, handle]) => {
    return (
      Math.abs(pointer.x - handle.x) <= HANDLE_SIZE &&
      Math.abs(pointer.y - handle.y) <= HANDLE_SIZE
    );
  })?.[0];
}

function handlePointerMove(event) {
  if (!image || !crop) return;

  if (!activeDrag) {
    updateCursor(event);
    return;
  }

  const point = imageToCanvas(event);
  const dx = point.x - activeDrag.start.x;
  const dy = point.y - activeDrag.start.y;
  const initial = activeDrag.initial;
  let next = { ...initial };

  if (activeDrag.mode === "move") {
    next.x = initial.x + dx;
    next.y = initial.y + dy;
  } else if (activeDrag.mode === "create") {
    next = cropFromCorners(activeDrag.start.x, activeDrag.start.y, point.x, point.y);
  } else {
    next = resizeCrop(initial, activeDrag.mode, dx, dy);
  }

  crop = normalizeCrop(next);
  updateMeta();
  render();
}

function cropFromCorners(x1, y1, x2, y2) {
  const left = clamp(Math.min(x1, x2), 0, image.width - MIN_CROP_SIZE);
  const top = clamp(Math.min(y1, y2), 0, image.height - MIN_CROP_SIZE);
  const right = clamp(Math.max(x1, x2), left + MIN_CROP_SIZE, image.width);
  const bottom = clamp(Math.max(y1, y2), top + MIN_CROP_SIZE, image.height);
  return { x: left, y: top, width: right - left, height: bottom - top };
}

function resizeCrop(initial, mode, dx, dy) {
  let left = initial.x;
  let top = initial.y;
  let right = initial.x + initial.width;
  let bottom = initial.y + initial.height;

  if (mode.includes("w")) left += dx;
  if (mode.includes("e")) right += dx;
  if (mode.includes("n")) top += dy;
  if (mode.includes("s")) bottom += dy;

  left = clamp(left, 0, right - MIN_CROP_SIZE);
  top = clamp(top, 0, bottom - MIN_CROP_SIZE);
  right = clamp(right, left + MIN_CROP_SIZE, image.width);
  bottom = clamp(bottom, top + MIN_CROP_SIZE, image.height);

  return { x: left, y: top, width: right - left, height: bottom - top };
}

function updateCursor(event) {
  const display = getDisplayCrop();
  const handle = findHandle({ x: event.offsetX, y: event.offsetY }, display);
  const cursors = {
    n: "ns-resize",
    s: "ns-resize",
    e: "ew-resize",
    w: "ew-resize",
    nw: "nwse-resize",
    se: "nwse-resize",
    ne: "nesw-resize",
    sw: "nesw-resize",
  };

  if (handle) {
    canvas.style.cursor = cursors[handle];
    return;
  }

  const point = imageToCanvas(event);
  const inside =
    point.x >= crop.x &&
    point.x <= crop.x + crop.width &&
    point.y >= crop.y &&
    point.y <= crop.y + crop.height;
  canvas.style.cursor = inside ? "move" : "crosshair";
}

function handlePointerUp(event) {
  if (!activeDrag) return;
  activeDrag = null;
  canvas.releasePointerCapture(event.pointerId);
}

function downloadCrop() {
  if (!image || !crop) return;

  const output = document.createElement("canvas");
  output.width = crop.width;
  output.height = crop.height;
  const outputCtx = output.getContext("2d");
  if (mimeType === "image/jpeg") {
    outputCtx.fillStyle = "#ffffff";
    outputCtx.fillRect(0, 0, output.width, output.height);
  }
  outputCtx.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    crop.width,
    crop.height,
  );

  const anchor = document.createElement("a");
  anchor.download = downloadFileName;
  anchor.href = output.toDataURL(mimeType, 0.95);
  anchor.click();
}

function setCropFromInputs() {
  if (!image) return;
  crop = normalizeCrop({
    x: Number(inputs.left.value),
    y: Number(inputs.top.value),
    width: Number(inputs.width.value),
    height: Number(inputs.height.value),
  });
  updateMeta();
  render();
}

fileInput.addEventListener("change", (event) => {
  loadFile(event.target.files[0]);
  fileInput.value = "";
});

dropZone.addEventListener("dragover", (event) => {
  event.preventDefault();
  dropZone.classList.add("is-over");
});

dropZone.addEventListener("dragleave", () => {
  dropZone.classList.remove("is-over");
});

dropZone.addEventListener("drop", (event) => {
  event.preventDefault();
  dropZone.classList.remove("is-over");
  loadFile(event.dataTransfer.files[0]);
});

dropZone.addEventListener("click", (event) => {
  if (!image && event.target !== fileInput) fileInput.click();
});

canvas.addEventListener("pointerdown", handlePointerDown);
canvas.addEventListener("pointermove", handlePointerMove);
canvas.addEventListener("pointerup", handlePointerUp);
canvas.addEventListener("pointercancel", handlePointerUp);

resetButton.addEventListener("click", () => {
  if (!image) return;
  image = null;
  crop = null;
  dropZone.classList.remove("has-image");
  setEnabled(false);
  updateMeta();
  render();
});

fitButton.addEventListener("click", () => {
  if (!image) return;
  crop = { x: 0, y: 0, width: image.width, height: image.height };
  updateMeta();
  render();
});

trimButton.addEventListener("click", () => {
  const trimmed = autoTrim();
  if (!trimmed) return;
  crop = trimmed;
  updateMeta();
  render();
});

downloadButton.addEventListener("click", downloadCrop);
Object.values(inputs).forEach((input) => input.addEventListener("input", setCropFromInputs));
window.addEventListener("resize", resizeCanvas);

setEnabled(false);
updateMeta();
