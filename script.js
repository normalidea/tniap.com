const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const colorPicker = document.getElementById('colorPicker');
const brushSizeInput = document.getElementById('brushSize');
const sizeDisplay = document.getElementById('sizeDisplay');
const clearBtn = document.getElementById('clearBtn');
const saveBtn = document.getElementById('saveBtn');
const cursorIndicator = document.getElementById('cursorIndicator');
const canvasWrapper = document.getElementById('canvasWrapper');
const zoomSlider = document.getElementById('zoomSlider');
const zoomDisplay = document.getElementById('zoomDisplay');
const zoomInBtn = document.getElementById('zoomInBtn');
const zoomOutBtn = document.getElementById('zoomOutBtn');

// Set canvas size
function resizeCanvas() {
    const container = canvas.parentElement;
    // Get viewport dimensions
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    const bodyPadding = 20;
    const toolbarWidth = 230;
    const containerPadding = 40;
    const containerBorder = 4;
    
    // Calculate available space for canvas
    const availableWidth = viewportWidth - toolbarWidth - containerPadding - containerBorder - bodyPadding;
    const availableHeight = viewportHeight - containerPadding - containerBorder - bodyPadding;
    
    // Use the smaller dimension to ensure canvas fits at 100% zoom without scrolling
    const size = Math.min(availableWidth, availableHeight);
    
    canvas.width = size;
    canvas.height = size;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Show canvas wrapper once it's properly sized
    canvasWrapper.classList.add('ready');
}

resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// Undo/Redo history
let history = [];
let historyIndex = -1;
const MAX_HISTORY = 50;

// Initialize history with blank canvas
function saveState() {
    // Remove any future states if we're not at the end
    if (historyIndex < history.length - 1) {
        history = history.slice(0, historyIndex + 1);
    }
    
    // Save current canvas state
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    history.push(imageData);
    historyIndex = history.length - 1; // Always point to the last state
    
    // Limit history size
    if (history.length > MAX_HISTORY) {
        history.shift();
        historyIndex = history.length - 1; // Update index after shift
    }
    console.log('State saved, history length:', history.length, 'index:', historyIndex);
}

function restoreState() {
    if (historyIndex >= 0 && historyIndex < history.length) {
        console.log('Restoring state at index:', historyIndex);
        ctx.putImageData(history[historyIndex], 0, 0);
        console.log('State restored');
    } else {
        console.log('Cannot restore - invalid index:', historyIndex, 'history.length:', history.length);
    }
}

function undo() {
    console.log('Undo called, historyIndex:', historyIndex, 'history.length:', history.length);
    if (historyIndex > 0) {
        historyIndex--;
        restoreState();
        console.log('Undone, new historyIndex:', historyIndex);
    } else {
        console.log('Cannot undo - already at beginning');
    }
}

function redo() {
    console.log('Redo called, historyIndex:', historyIndex, 'history.length:', history.length);
    if (historyIndex < history.length - 1) {
        historyIndex++;
        restoreState();
        console.log('Redone, new historyIndex:', historyIndex);
    } else {
        console.log('Cannot redo - already at end');
    }
}

// Save initial blank canvas state after first resize
saveState();

// State
let currentTool = 'brush';
let currentColor = '#000000';
let brushSize = 3;
let isDrawing = false;
let startX = 0;
let startY = 0;
let lastX = 0;
let lastY = 0;
let zoomLevel = 100;
let isPanning = false;
let panStartX = 0;
let panStartY = 0;
let panStartScrollLeft = 0;
let panStartScrollTop = 0;
let panOffsetX = 0;
let panOffsetY = 0;

// Tool selection
document.querySelectorAll('.tool-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentTool = btn.dataset.tool;
        updateCursorIndicator();
        
        // Update cursor style
        if (currentTool === 'pan') {
            canvas.style.cursor = 'grab';
        } else {
            canvas.style.cursor = 'none';
        }
    });
});

// Color picker
colorPicker.addEventListener('input', (e) => {
    currentColor = e.target.value;
});

// Brush size
brushSizeInput.addEventListener('input', (e) => {
    brushSize = parseInt(e.target.value);
    sizeDisplay.textContent = brushSize;
    updateCursorIndicator();
});

// Zoom functionality
function updateZoom(zoom) {
    zoomLevel = zoom;
    zoomSlider.value = zoom;
    zoomDisplay.textContent = `${zoom}%`;
    const scale = zoom / 100;
    canvasWrapper.style.transform = `scale(${scale}) translate(${panOffsetX / scale}px, ${panOffsetY / scale}px)`;
    updateCursorIndicator();
}

function zoomAtPoint(x, y, zoomIn = true) {
    const container = canvas.parentElement;
    const containerRect = container.getBoundingClientRect();
    const wrapperRect = canvasWrapper.getBoundingClientRect();
    
    // Get click position relative to container
    const clickX = x - containerRect.left;
    const clickY = y - containerRect.top;
    
    // Get current scroll position
    const scrollLeft = container.scrollLeft;
    const scrollTop = container.scrollTop;
    
    // Calculate the point on the canvas (accounting for current zoom and scroll)
    // The wrapper is centered, so we need to account for that
    const wrapperCenterX = wrapperRect.left - containerRect.left + wrapperRect.width / 2;
    const wrapperCenterY = wrapperRect.top - containerRect.top + wrapperRect.height / 2;
    
    const canvasX = (clickX - wrapperCenterX + scrollLeft) / (zoomLevel / 100) + canvas.width / 2;
    const canvasY = (clickY - wrapperCenterY + scrollTop) / (zoomLevel / 100) + canvas.height / 2;
    
    // Calculate new zoom
    const newZoom = zoomIn 
        ? Math.min(400, zoomLevel + 50)
        : Math.max(25, zoomLevel - 50);
    
    // Update zoom
    updateZoom(newZoom);
    
    // After zoom, calculate where the canvas point should be and adjust scroll
    // Force a reflow to get updated wrapper dimensions
    void canvasWrapper.offsetWidth;
    const newWrapperRect = canvasWrapper.getBoundingClientRect();
    const newWrapperCenterX = newWrapperRect.left - containerRect.left + newWrapperRect.width / 2;
    const newWrapperCenterY = newWrapperRect.top - containerRect.top + newWrapperRect.height / 2;
    
    // Calculate where the canvas point is now
    const newPointX = (canvasX - canvas.width / 2) * (newZoom / 100) + newWrapperCenterX;
    const newPointY = (canvasY - canvas.height / 2) * (newZoom / 100) + newWrapperCenterY;
    
    // Adjust scroll to keep the clicked point under the cursor
    const newScrollX = scrollLeft + (clickX - newPointX);
    const newScrollY = scrollTop + (clickY - newPointY);
    
    // Update scroll position
    container.scrollTo({
        left: Math.max(0, newScrollX),
        top: Math.max(0, newScrollY),
        behavior: 'smooth'
    });
}

zoomSlider.addEventListener('input', (e) => {
    updateZoom(parseInt(e.target.value));
});

zoomInBtn.addEventListener('click', () => {
    const newZoom = Math.min(400, zoomLevel + 25);
    updateZoom(newZoom);
});

zoomOutBtn.addEventListener('click', () => {
    const newZoom = Math.max(25, zoomLevel - 25);
    updateZoom(newZoom);
});

// Cursor indicator functions
function updateCursorIndicator() {
    if (!cursorIndicator) return;
    
    // Update class based on tool
    cursorIndicator.classList.remove('brush', 'eraser', 'shape', 'zoom');
    
    if (currentTool === 'brush' || currentTool === 'eraser') {
        const size = brushSize;
        cursorIndicator.style.width = `${size}px`;
        cursorIndicator.style.height = `${size}px`;
        cursorIndicator.classList.add(currentTool);
    } else if (currentTool === 'line' || currentTool === 'rectangle' || currentTool === 'circle') {
        // Shape tools use crosshair - size is fixed
        cursorIndicator.classList.add('shape');
    } else if (currentTool === 'zoom' || currentTool === 'zoomOut') {
        // Zoom tools use crosshair
        cursorIndicator.classList.add('shape');
    } else if (currentTool === 'pan') {
        // Pan tool - hide cursor indicator, use default cursor
        cursorIndicator.classList.remove('visible');
    }
}

function getCanvasCoordinates(e) {
    const rect = canvas.getBoundingClientRect();
    const scale = zoomLevel / 100;
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;
    return { x, y };
}

function updateCursorPosition(e) {
    if (!cursorIndicator) return;
    
    // Position cursor indicator directly at mouse position (viewport coordinates)
    // Since cursor indicator is now fixed positioned, we use clientX/clientY directly
    cursorIndicator.style.left = `${e.clientX}px`;
    cursorIndicator.style.top = `${e.clientY}px`;
}

// Show cursor indicator when mouse enters canvas
canvas.addEventListener('mouseenter', (e) => {
    if (currentTool === 'brush' || currentTool === 'eraser' || 
        currentTool === 'line' || currentTool === 'rectangle' || currentTool === 'circle' ||
        currentTool === 'zoom' || currentTool === 'zoomOut') {
        cursorIndicator.classList.add('visible');
        updateCursorPosition(e);
        updateCursorIndicator();
    } else {
        cursorIndicator.classList.remove('visible');
    }
});

// Hide cursor indicator when mouse leaves canvas
canvas.addEventListener('mouseleave', (e) => {
    cursorIndicator.classList.remove('visible');
    isDrawing = false;
    if (isPanning) {
        stopPan();
    }
});

// Scroll to zoom
canvas.addEventListener('wheel', (e) => {
    // Prevent default scrolling
    e.preventDefault();
    
    // Don't zoom while panning
    if (isPanning) return;
    
    // Determine zoom direction (negative deltaY = scroll up = zoom in)
    const zoomIn = e.deltaY < 0;
    const zoomAmount = 25; // Same increment as zoom buttons
    
    // Calculate new zoom level
    const newZoom = zoomIn 
        ? Math.min(400, zoomLevel + zoomAmount)
        : Math.max(25, zoomLevel - zoomAmount);
    
    // Only zoom if it actually changed
    if (newZoom !== zoomLevel) {
        // Zoom at mouse position
        zoomAtPoint(e.clientX, e.clientY, zoomIn);
    }
}, { passive: false });

// Global mouseup to stop panning if mouse is released outside canvas
window.addEventListener('mouseup', (e) => {
    if (isPanning) {
        stopPan();
    }
});


// Update cursor position on mouse move
canvas.addEventListener('mousemove', (e) => {
    // Handle panning
    if (isPanning) {
        doPan(e);
        e.preventDefault();
        // Make sure cursor indicator stays hidden during panning
        if (cursorIndicator) {
            cursorIndicator.classList.remove('visible');
        }
        return;
    }
    
    // Update cursor indicator position
    if (currentTool === 'brush' || currentTool === 'eraser' || 
        currentTool === 'line' || currentTool === 'rectangle' || currentTool === 'circle' ||
        currentTool === 'zoom' || currentTool === 'zoomOut') {
        updateCursorPosition(e);
    }
    
    // Handle drawing
    if (!isDrawing) return;
    
    const coords = getCanvasCoordinates(e);
    const currentX = coords.x;
    const currentY = coords.y;
    
    if (currentTool === 'brush') {
        drawLine(lastX, lastY, currentX, currentY);
    } else if (currentTool === 'eraser') {
        eraseLine(lastX, lastY, currentX, currentY);
    } else if (currentTool === 'line' || currentTool === 'rectangle' || currentTool === 'circle') {
        // For shapes, we'll redraw on mouseup
    }
    
    lastX = currentX;
    lastY = currentY;
});

// Save state when drawing ends
let saveStateTimeout = null;
function saveStateAfterDrawing() {
    // Use setTimeout to batch rapid drawing operations
    if (saveStateTimeout) {
        clearTimeout(saveStateTimeout);
    }
    saveStateTimeout = setTimeout(() => {
        saveState();
        console.log('State saved, history length:', history.length, 'index:', historyIndex);
    }, 100);
}

// Drawing functions
function drawLine(x1, y1, x2, y2) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = currentColor;
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
}

function drawBrush(x, y) {
    ctx.fillStyle = currentColor;
    ctx.beginPath();
    ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
    ctx.fill();
}

function drawEraser(x, y) {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
}

function eraseLine(x1, y1, x2, y2) {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
}

function floodFill(x, y, targetColor, fillColor) {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const width = canvas.width;
    const height = canvas.height;
    
    const targetR = parseInt(targetColor.slice(1, 3), 16);
    const targetG = parseInt(targetColor.slice(3, 5), 16);
    const targetB = parseInt(targetColor.slice(5, 7), 16);
    
    const fillR = parseInt(fillColor.slice(1, 3), 16);
    const fillG = parseInt(fillColor.slice(3, 5), 16);
    const fillB = parseInt(fillColor.slice(5, 7), 16);
    
    if (targetR === fillR && targetG === fillG && targetB === fillB) {
        return;
    }
    
    const stack = [[x, y]];
    const visited = new Set();
    
    function getPixelIndex(x, y) {
        return (y * width + x) * 4;
    }
    
    function getColor(x, y) {
        const idx = getPixelIndex(x, y);
        return {
            r: data[idx],
            g: data[idx + 1],
            b: data[idx + 2]
        };
    }
    
    function setColor(x, y, r, g, b) {
        const idx = getPixelIndex(x, y);
        data[idx] = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
    }
    
    function matchesTarget(x, y) {
        const pixel = getColor(x, y);
        return pixel.r === targetR && pixel.g === targetG && pixel.b === targetB;
    }
    
    while (stack.length > 0) {
        const [px, py] = stack.pop();
        const key = `${px},${py}`;
        
        if (px < 0 || px >= width || py < 0 || py >= height || visited.has(key)) {
            continue;
        }
        
        if (!matchesTarget(px, py)) {
            continue;
        }
        
        visited.add(key);
        setColor(px, py, fillR, fillG, fillB);
        
        stack.push([px + 1, py]);
        stack.push([px - 1, py]);
        stack.push([px, py + 1]);
        stack.push([px, py - 1]);
    }
    
    ctx.putImageData(imageData, 0, 0);
}

// Pan functionality
function startPan(e) {
    isPanning = true;
    panStartX = e.clientX;
    panStartY = e.clientY;
    canvas.style.cursor = 'grabbing';
    // Hide cursor indicator when panning
    if (cursorIndicator) {
        cursorIndicator.classList.remove('visible');
    }
    e.preventDefault();
    e.stopPropagation();
}

function doPan(e) {
    if (!isPanning) return;
    e.preventDefault();
    const deltaX = e.clientX - panStartX;
    const deltaY = e.clientY - panStartY;
    
    // Update pan offset
    panOffsetX += deltaX;
    panOffsetY += deltaY;
    
    // Apply transform to canvas wrapper
    const currentScale = zoomLevel / 100;
    canvasWrapper.style.transform = `scale(${currentScale}) translate(${panOffsetX / currentScale}px, ${panOffsetY / currentScale}px)`;
    
    // Update start position for next move
    panStartX = e.clientX;
    panStartY = e.clientY;
}

function stopPan() {
    if (!isPanning) return;
    isPanning = false;
    if (currentTool === 'pan') {
        canvas.style.cursor = 'grab';
    } else {
        canvas.style.cursor = 'none';
        // Restore cursor indicator if tool needs it
        if (currentTool === 'brush' || currentTool === 'eraser' || 
            currentTool === 'line' || currentTool === 'rectangle' || currentTool === 'circle' ||
            currentTool === 'zoom' || currentTool === 'zoomOut') {
            if (cursorIndicator) {
                cursorIndicator.classList.add('visible');
            }
        }
    }
}

// Mouse events
canvas.addEventListener('mousedown', (e) => {
    // Middle click or pan tool - start panning
    if (e.button === 1 || currentTool === 'pan') {
        e.preventDefault();
        startPan(e);
        return;
    }
    
    if (currentTool === 'zoom') {
        // Zoom in tool
        zoomAtPoint(e.clientX, e.clientY, true);
        return;
    }
    
    if (currentTool === 'zoomOut') {
        // Zoom out tool
        zoomAtPoint(e.clientX, e.clientY, false);
        return;
    }
    
    // Don't save state here - we'll save after drawing completes
    // This prevents saving empty states
    
    isDrawing = true;
    const coords = getCanvasCoordinates(e);
    startX = coords.x;
    startY = coords.y;
    lastX = startX;
    lastY = startY;
    
    if (currentTool === 'fill') {
        // Save state before fill
        saveState();
        const imageData = ctx.getImageData(Math.floor(startX), Math.floor(startY), 1, 1);
        const pixel = imageData.data;
        const targetColor = `#${[pixel[0], pixel[1], pixel[2]]
            .map(x => x.toString(16).padStart(2, '0'))
            .join('')}`;
        floodFill(Math.floor(startX), Math.floor(startY), targetColor, currentColor);
        isDrawing = false;
        // Save state after fill completes
        saveState();
    } else if (currentTool === 'brush') {
        // Save state before starting brush stroke
        saveState();
        drawBrush(startX, startY);
    } else if (currentTool === 'eraser') {
        // Save state before starting eraser stroke
        saveState();
        drawEraser(startX, startY);
    }
});


canvas.addEventListener('mouseup', (e) => {
    // Stop panning
    if (isPanning) {
        stopPan();
        return;
    }
    
    if (!isDrawing) return;
    
    const coords = getCanvasCoordinates(e);
    const endX = coords.x;
    const endY = coords.y;
    
    if (currentTool === 'line') {
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.strokeStyle = currentColor;
        ctx.lineWidth = brushSize;
        ctx.stroke();
    } else if (currentTool === 'rectangle') {
        ctx.strokeStyle = currentColor;
        ctx.lineWidth = brushSize;
        const width = endX - startX;
        const height = endY - startY;
        ctx.strokeRect(startX, startY, width, height);
    } else if (currentTool === 'circle') {
        ctx.strokeStyle = currentColor;
        ctx.lineWidth = brushSize;
        const radius = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
        ctx.beginPath();
        ctx.arc(startX, startY, radius, 0, Math.PI * 2);
        ctx.stroke();
    }
    // For brush and eraser, the drawing was already done in mousemove
    // Save state after drawing completes
    isDrawing = false;
    
    // Save state after drawing operation completes
    if (currentTool === 'brush' || currentTool === 'eraser' || 
        currentTool === 'line' || currentTool === 'rectangle' || currentTool === 'circle') {
        saveState();
    }
});


// Clear button and modal
const clearModal = document.getElementById('clearModal');
const modalConfirm = document.getElementById('modalConfirm');
const modalCancel = document.getElementById('modalCancel');

clearBtn.addEventListener('click', () => {
    clearModal.classList.add('show');
});

modalCancel.addEventListener('click', () => {
    clearModal.classList.remove('show');
});

modalConfirm.addEventListener('click', () => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    clearModal.classList.remove('show');
    // Save state after clear
    saveState();
});

// Keyboard shortcuts for undo/redo
document.addEventListener('keydown', (e) => {
    // Check for both Ctrl (Windows/Linux) and Meta/Command (Mac)
    const isModifierPressed = e.ctrlKey || e.metaKey;
    
    // Ctrl+Z or Cmd+Z for undo (check both lowercase and uppercase)
    if (isModifierPressed && (e.key === 'z' || e.key === 'Z') && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        console.log('Undo shortcut detected');
        undo();
        return false;
    }
    // Ctrl+Shift+Z or Cmd+Shift+Z or Ctrl+Y or Cmd+Y for redo
    if ((isModifierPressed && e.shiftKey && (e.key === 'z' || e.key === 'Z')) || (isModifierPressed && (e.key === 'y' || e.key === 'Y'))) {
        e.preventDefault();
        e.stopPropagation();
        console.log('Redo shortcut detected');
        redo();
        return false;
    }
}, true); // Use capture phase

// Close modal when clicking outside
clearModal.addEventListener('click', (e) => {
    if (e.target === clearModal) {
        clearModal.classList.remove('show');
    }
});

// Save button
saveBtn.addEventListener('click', () => {
    const link = document.createElement('a');
    link.download = 'paint-drawing.png';
    link.href = canvas.toDataURL();
    link.click();
});

// Initialize cursor indicator
updateCursorIndicator();

