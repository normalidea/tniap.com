const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const colorPicker = document.getElementById('colorPicker');
const brushSizeInput = document.getElementById('brushSize');
const sizeDisplay = document.getElementById('sizeDisplay');
const clearBtn = document.getElementById('clearBtn');
const saveBtn = document.getElementById('saveBtn');
const shareBtn = document.getElementById('shareBtn');
const cursorIndicator = document.getElementById('cursorIndicator');
const canvasWrapper = document.getElementById('canvasWrapper');
const zoomSlider = document.getElementById('zoomSlider');
const zoomDisplay = document.getElementById('zoomDisplay');
const zoomInBtn = document.getElementById('zoomInBtn');
const zoomOutBtn = document.getElementById('zoomOutBtn');

// Detect if device is touch-capable
const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

// Set canvas size
// Canvas internal resolution is always 761x761 for API compatibility
// Visual size is scaled via CSS for responsive display
function resizeCanvas() {
    const container = canvas.parentElement;
    // Get viewport dimensions
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    const isMobile = viewportWidth <= 768;
    const bodyPadding = isMobile ? 0 : 20;
    const toolbarWidth = isMobile ? 0 : 230; // Toolbar is horizontal on mobile
    const containerPadding = isMobile ? 10 : 40;
    const containerBorder = 4;
    const buffer = 2; // Small safety margin to prevent scrollbar
    
    // On mobile, account for toolbar height
    const toolbarHeight = isMobile ? (document.querySelector('.toolbar')?.offsetHeight || 0) : 0;
    
    // Calculate available space for canvas
    const availableWidth = viewportWidth - toolbarWidth - containerPadding - containerBorder - bodyPadding - buffer;
    const availableHeight = viewportHeight - toolbarHeight - containerPadding - containerBorder - bodyPadding - buffer;
    
    // Use the smaller dimension to ensure canvas fits at 100% zoom without scrolling
    const displaySize = Math.min(availableWidth, availableHeight);
    
    // Canvas internal resolution is always 761x761 (required by API)
    const CANVAS_SIZE = 761;
    canvas.width = CANVAS_SIZE;
    canvas.height = CANVAS_SIZE;
    
    // Set CSS size for responsive display
    canvas.style.width = `${displaySize}px`;
    canvas.style.height = `${displaySize}px`;
    
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// LocalStorage functions
function saveToLocalStorage() {
    try {
        // Save zoom level
        localStorage.setItem('paintZoom', zoomLevel.toString());
        
        // Save color
        localStorage.setItem('paintColor', currentColor);
        
        // Save brush size
        localStorage.setItem('paintBrushSize', brushSize.toString());
        
        // Save canvas drawing as data URL
        const canvasData = canvas.toDataURL('image/png');
        localStorage.setItem('paintCanvas', canvasData);
    } catch (e) {
        console.warn('Failed to save to localStorage:', e);
    }
}

function loadFromLocalStorage() {
    try {
        // Load zoom level
        const savedZoom = localStorage.getItem('paintZoom');
        if (savedZoom) {
            const zoom = parseInt(savedZoom);
            if (zoom >= 25 && zoom <= 400) {
                updateZoom(zoom, true); // Skip save when loading
            }
        }
        
        // Load color
        const savedColor = localStorage.getItem('paintColor');
        if (savedColor) {
            currentColor = savedColor;
            colorPicker.value = savedColor;
        }
        
        // Load brush size
        const savedBrushSize = localStorage.getItem('paintBrushSize');
        if (savedBrushSize) {
            const size = parseInt(savedBrushSize);
            if (size >= 1 && size <= 20) {
                brushSize = size;
                brushSizeInput.value = size;
                sizeDisplay.textContent = size;
                updateCursorIndicator();
            }
        }
        
        // Load canvas drawing - do this last after other settings are loaded
        const savedCanvas = localStorage.getItem('paintCanvas');
        if (savedCanvas) {
            const img = new Image();
            img.onload = () => {
                // Clear canvas and draw saved image with proper dimensions
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                // Replace the initial blank state with the loaded canvas
                // Clear history and add loaded canvas as the first state
                history = [];
                historyIndex = -1;
                saveState();
            };
            img.onerror = () => {
                console.warn('Failed to load canvas image from localStorage');
            };
            img.src = savedCanvas;
        } else {
            // No saved canvas - save the initial blank state as the first history entry
            // Make sure history is clean first
            if (history.length === 0) {
                saveState();
            }
        }
    } catch (e) {
        console.warn('Failed to load from localStorage:', e);
    }
}

// Undo/Redo history
let history = [];
let historyIndex = -1;
const MAX_HISTORY = 50;

// Load saved state from localStorage after canvas is ready
// loadFromLocalStorage will save the initial state (blank or loaded)
// We clear history here to ensure a clean start
history = [];
historyIndex = -1;
// Use requestAnimationFrame to ensure DOM is ready, but without visible delay
requestAnimationFrame(() => {
    loadFromLocalStorage();
});

// Initialize history with blank canvas
function saveState() {
    // Remove any future states if we're not at the end
    if (historyIndex < history.length - 1) {
        history = history.slice(0, historyIndex + 1);
    }
    
    // Save current canvas state
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    // Don't save if it's identical to the current state at historyIndex (prevents duplicate states)
    // After slicing future states above, historyIndex should point to the last state
    if (history.length > 0 && historyIndex >= 0) {
        const currentState = history[historyIndex];
        if (currentState && 
            currentState.width === imageData.width && 
            currentState.height === imageData.height) {
            // Compare pixel data
            let isIdentical = true;
            for (let i = 0; i < imageData.data.length; i++) {
                if (currentState.data[i] !== imageData.data[i]) {
                    isIdentical = false;
                    break;
                }
            }
            if (isIdentical) {
                console.log('State identical to current, skipping save');
                return;
            }
        }
    }
    
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
        // Save current state to localStorage after undo
        saveToLocalStorage();
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
        // Save current state to localStorage after redo
        saveToLocalStorage();
    } else {
        console.log('Cannot redo - already at end');
    }
}

// LocalStorage functions
function saveToLocalStorage() {
    try {
        // Save zoom level
        localStorage.setItem('paintZoom', zoomLevel.toString());
        
        // Save color
        localStorage.setItem('paintColor', currentColor);
        
        // Save brush size
        localStorage.setItem('paintBrushSize', brushSize.toString());
        
        // Save canvas drawing as data URL
        const canvasData = canvas.toDataURL('image/png');
        localStorage.setItem('paintCanvas', canvasData);
    } catch (e) {
        console.warn('Failed to save to localStorage:', e);
    }
}

// State
let currentTool = 'brush';
let currentColor = '#000000';
let brushSize = 3;
let isDrawing = false;
let startX = 0;
let startY = 0;
let lastX = 0;
let lastY = 0;
let shapePreviewImageData = null; // Store canvas state for shape preview
let zoomLevel = 100;
let isPanning = false;
let panStartX = 0;
let panStartY = 0;
let panStartScrollLeft = 0;
let panStartScrollTop = 0;
let panOffsetX = 0;
let panOffsetY = 0;

// Multi-touch tap tracking for undo/redo
let multiTouchStartTime = 0;
let multiTouchCount = 0;

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
        } else if (currentTool === 'fill') {
            canvas.style.cursor = 'crosshair';
        } else {
            canvas.style.cursor = 'none';
        }
    });
});

// Color picker
colorPicker.addEventListener('input', (e) => {
    currentColor = e.target.value;
    updateCursorIndicator(); // Update cursor color for fill tool
    saveToLocalStorage();
});

// Brush size
brushSizeInput.addEventListener('input', (e) => {
    brushSize = parseInt(e.target.value);
    sizeDisplay.textContent = brushSize;
    updateCursorIndicator();
    saveToLocalStorage();
});

// Zoom functionality
function updateZoom(zoom, skipSave = false) {
    zoomLevel = zoom;
    zoomSlider.value = zoom;
    zoomDisplay.textContent = `${zoom}%`;
    const scale = zoom / 100;
    canvasWrapper.style.transform = `scale(${scale}) translate(${panOffsetX / scale}px, ${panOffsetY / scale}px)`;
    updateCursorIndicator();
    if (!skipSave) {
        saveToLocalStorage();
    }
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
        ? Math.min(400, zoomLevel + 5)
        : Math.max(25, zoomLevel - 5);
    
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
    const newZoom = Math.min(400, zoomLevel + 5);
    updateZoom(newZoom);
});

zoomOutBtn.addEventListener('click', () => {
    const newZoom = Math.max(25, zoomLevel - 5);
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
    } else if (currentTool === 'pan') {
        // Pan tool - hide cursor indicator, use default cursor
        cursorIndicator.classList.remove('visible');
    }
}

function getCanvasCoordinates(e) {
    const rect = canvas.getBoundingClientRect();
    const zoomScale = zoomLevel / 100;
    // Handle both mouse and touch events
    const clientX = e.clientX !== undefined ? e.clientX : e.touches[0].clientX;
    const clientY = e.clientY !== undefined ? e.clientY : e.touches[0].clientY;
    
    // Get position relative to canvas element
    const relativeX = clientX - rect.left;
    const relativeY = clientY - rect.top;
    
    // Account for CSS scaling (canvas internal size vs displayed size)
    const cssScaleX = canvas.width / rect.width;
    const cssScaleY = canvas.height / rect.height;
    
    // Convert to canvas coordinates (accounting for CSS scale and zoom)
    const x = (relativeX * cssScaleX) / zoomScale;
    const y = (relativeY * cssScaleY) / zoomScale;
    
    return { x, y };
}

function updateCursorPosition(e) {
    if (!cursorIndicator || isTouchDevice) return;
    
    // Check if mouse is actually over the canvas
    const rect = canvas.getBoundingClientRect();
    const zoomScale = zoomLevel / 100;
    
    // Get position relative to canvas element
    const relativeX = e.clientX - rect.left;
    const relativeY = e.clientY - rect.top;
    
    // Account for CSS scaling (canvas internal size vs displayed size)
    const cssScaleX = canvas.width / rect.width;
    const cssScaleY = canvas.height / rect.height;
    
    // Convert to canvas coordinates (accounting for CSS scale and zoom)
    const canvasX = (relativeX * cssScaleX) / zoomScale;
    const canvasY = (relativeY * cssScaleY) / zoomScale;
    
    // Only show cursor if mouse is within canvas bounds
    if (canvasX >= 0 && canvasX <= canvas.width && canvasY >= 0 && canvasY <= canvas.height) {
        // Position cursor indicator directly at mouse position (viewport coordinates)
        // Since cursor indicator is now fixed positioned, we use clientX/clientY directly
        cursorIndicator.style.left = `${e.clientX}px`;
        cursorIndicator.style.top = `${e.clientY}px`;
        cursorIndicator.classList.add('visible');
    } else {
        // Hide cursor if outside canvas bounds
        cursorIndicator.classList.remove('visible');
    }
}

// Show cursor indicator when mouse enters canvas
canvas.addEventListener('mouseenter', (e) => {
    if (isTouchDevice) return;
    
    if (currentTool === 'brush' || currentTool === 'eraser' || 
        currentTool === 'line' || currentTool === 'rectangle' || currentTool === 'circle') {
        cursorIndicator.classList.add('visible');
        updateCursorPosition(e);
        updateCursorIndicator();
    } else {
        cursorIndicator.classList.remove('visible');
    }
});

// Hide cursor indicator when mouse leaves canvas
canvas.addEventListener('mouseleave', (e) => {
    if (!isTouchDevice) {
        cursorIndicator.classList.remove('visible');
    }
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
    const zoomAmount = 5; // Same increment as zoom buttons
    
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
        currentTool === 'line' || currentTool === 'rectangle' || currentTool === 'circle') {
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
        // Draw shape preview
        if (shapePreviewImageData) {
            ctx.putImageData(shapePreviewImageData, 0, 0);
        }
        
        // Draw preview outline
        ctx.strokeStyle = currentColor;
        ctx.lineWidth = brushSize;
        
        if (currentTool === 'line') {
            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(currentX, currentY);
            ctx.stroke();
        } else if (currentTool === 'rectangle') {
            const width = currentX - startX;
            const height = currentY - startY;
            ctx.strokeRect(startX, startY, width, height);
        } else if (currentTool === 'circle') {
            const width = currentX - startX;
            const height = currentY - startY;
            const centerX = startX + width / 2;
            const centerY = startY + height / 2;
            const radius = Math.sqrt(Math.pow(width / 2, 2) + Math.pow(height / 2, 2));
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
            ctx.stroke();
        }
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
    // Handle both mouse and touch events
    const clientX = e.clientX !== undefined ? e.clientX : e.touches[0].clientX;
    const clientY = e.clientY !== undefined ? e.clientY : e.touches[0].clientY;
    panStartX = clientX;
    panStartY = clientY;
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
    // Handle both mouse and touch events
    const clientX = e.clientX !== undefined ? e.clientX : e.touches[0].clientX;
    const clientY = e.clientY !== undefined ? e.clientY : e.touches[0].clientY;
    const deltaX = clientX - panStartX;
    const deltaY = clientY - panStartY;
    
    // Update pan offset
    panOffsetX += deltaX;
    panOffsetY += deltaY;
    
    // Apply transform to canvas wrapper
    const currentScale = zoomLevel / 100;
    canvasWrapper.style.transform = `scale(${currentScale}) translate(${panOffsetX / currentScale}px, ${panOffsetY / currentScale}px)`;
    
    // Update start position for next move
    panStartX = clientX;
    panStartY = clientY;
}

function stopPan() {
    if (!isPanning) return;
    isPanning = false;
    if (currentTool === 'pan') {
        canvas.style.cursor = 'grab';
    } else if (currentTool === 'fill') {
        canvas.style.cursor = 'crosshair';
    } else {
        canvas.style.cursor = 'none';
        // Restore cursor indicator if tool needs it
        if (currentTool === 'brush' || currentTool === 'eraser' || 
            currentTool === 'line' || currentTool === 'rectangle' || currentTool === 'circle') {
            if (cursorIndicator) {
                cursorIndicator.classList.add('visible');
            }
        }
    }
}

// Mouse events
canvas.addEventListener('mousedown', (e) => {
    // Middle click - start panning
    if (e.button === 1) {
        e.preventDefault();
        startPan(e);
        return;
    }
    
    handleDrawingStart(e);
});


// Helper function to handle drawing start (used by both mouse and touch)
function handleDrawingStart(e) {
    // Pan tool - start panning
    if (currentTool === 'pan') {
        e.preventDefault();
        startPan(e);
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
    
    // Save canvas state for shape preview (we'll use this for preview, but don't save to history yet)
    if (currentTool === 'line' || currentTool === 'rectangle' || currentTool === 'circle') {
        shapePreviewImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        // Don't save to history here - we'll save after the shape is complete on mouseup
    }
    
    if (currentTool === 'fill') {
        // Save state before fill (so we can undo the fill)
        saveState();
        const imageData = ctx.getImageData(Math.floor(startX), Math.floor(startY), 1, 1);
        const pixel = imageData.data;
        const targetColor = `#${[pixel[0], pixel[1], pixel[2]]
            .map(x => x.toString(16).padStart(2, '0'))
            .join('')}`;
        floodFill(Math.floor(startX), Math.floor(startY), targetColor, currentColor);
        isDrawing = false;
        // Don't save state again - we already saved before the fill
        saveToLocalStorage(); // Save canvas to localStorage
    } else if (currentTool === 'brush') {
        // Don't save state here - we'll save after the stroke completes on mouseup
        drawBrush(startX, startY);
    } else if (currentTool === 'eraser') {
        // Don't save state here - we'll save after the stroke completes on mouseup
        drawEraser(startX, startY);
    }
}

// Helper function to handle drawing end (used by both mouse and touch)
function handleDrawingEnd(e) {
    // Stop panning
    if (isPanning) {
        stopPan();
        return;
    }
    
    if (!isDrawing) return;
    
    const coords = getCanvasCoordinates(e);
    const endX = coords.x;
    const endY = coords.y;
    
    // Restore canvas state and draw final shape
    if (shapePreviewImageData) {
        ctx.putImageData(shapePreviewImageData, 0, 0);
    }
    
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
        const width = endX - startX;
        const height = endY - startY;
        const centerX = startX + width / 2;
        const centerY = startY + height / 2;
        const radius = Math.sqrt(Math.pow(width / 2, 2) + Math.pow(height / 2, 2));
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.stroke();
    }
    
    // Clear preview image data
    shapePreviewImageData = null;
    isDrawing = false;
    
    // Save state after drawing operation completes
    // For shapes: save final state on mouseup (we didn't save on mousedown)
    // For brush/eraser: save final state on mouseup (after the stroke completes)
    if (currentTool === 'line' || currentTool === 'rectangle' || currentTool === 'circle' ||
        currentTool === 'brush' || currentTool === 'eraser') {
        saveState();
        saveToLocalStorage(); // Save canvas to localStorage
    }
}

// Mouse events
canvas.addEventListener('mousedown', (e) => {
    // Middle click - start panning
    if (e.button === 1) {
        e.preventDefault();
        startPan(e);
        return;
    }
    
    handleDrawingStart(e);
});

canvas.addEventListener('mouseup', (e) => {
    handleDrawingEnd(e);
});

// Touch events
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault(); // Prevent scrolling and zooming
    
    if (e.touches.length === 1) {
        // Single touch - handle drawing
        handleDrawingStart(e);
        // Reset multi-touch tracking
        multiTouchStartTime = 0;
        multiTouchCount = 0;
    } else if (e.touches.length === 2 || e.touches.length === 3) {
        // Multi-touch - track for undo/redo gestures
        multiTouchStartTime = Date.now();
        multiTouchCount = e.touches.length;
        e.preventDefault();
    }
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault(); // Prevent scrolling
    
    if (e.touches.length === 1 && isDrawing) {
        // Handle drawing movement
        const touch = e.touches[0];
        const mouseEvent = {
            clientX: touch.clientX,
            clientY: touch.clientY,
            touches: e.touches
        };
        
        // Update cursor indicator position (only on non-touch devices)
        if (!isTouchDevice && (currentTool === 'brush' || currentTool === 'eraser' || 
            currentTool === 'line' || currentTool === 'rectangle' || currentTool === 'circle')) {
            updateCursorPosition(mouseEvent);
        }
        
        // Handle drawing
        const coords = getCanvasCoordinates(mouseEvent);
        const currentX = coords.x;
        const currentY = coords.y;
        
        if (currentTool === 'brush') {
            drawLine(lastX, lastY, currentX, currentY);
        } else if (currentTool === 'eraser') {
            eraseLine(lastX, lastY, currentX, currentY);
        } else if (currentTool === 'line' || currentTool === 'rectangle' || currentTool === 'circle') {
            // Draw shape preview
            if (shapePreviewImageData) {
                ctx.putImageData(shapePreviewImageData, 0, 0);
            }
            
            // Draw preview outline
            ctx.strokeStyle = currentColor;
            ctx.lineWidth = brushSize;
            
            if (currentTool === 'line') {
                ctx.beginPath();
                ctx.moveTo(startX, startY);
                ctx.lineTo(currentX, currentY);
                ctx.stroke();
            } else if (currentTool === 'rectangle') {
                const width = currentX - startX;
                const height = currentY - startY;
                ctx.strokeRect(startX, startY, width, height);
            } else if (currentTool === 'circle') {
                const width = currentX - startX;
                const height = currentY - startY;
                const centerX = startX + width / 2;
                const centerY = startY + height / 2;
                const radius = Math.sqrt(Math.pow(width / 2, 2) + Math.pow(height / 2, 2));
                ctx.beginPath();
                ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
                ctx.stroke();
            }
        }
        
        lastX = currentX;
        lastY = currentY;
    }
}, { passive: false });

canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    
    // Check for multi-touch tap gestures (undo/redo)
    if (e.touches.length === 0 && multiTouchStartTime > 0) {
        const timeElapsed = Date.now() - multiTouchStartTime;
        const isQuickTap = timeElapsed < 800; // Less than 800ms
        
        if (isQuickTap) {
            if (multiTouchCount === 2) {
                // Two finger tap = undo
                undo();
            } else if (multiTouchCount === 3) {
                // Three finger tap = redo
                redo();
            }
        }
        
        // Reset multi-touch tracking
        multiTouchStartTime = 0;
        multiTouchCount = 0;
    }
    
    if (e.touches.length === 0) {
        // All touches ended
        const lastTouch = e.changedTouches[0];
        const mouseEvent = {
            clientX: lastTouch.clientX,
            clientY: lastTouch.clientY,
            touches: []
        };
        handleDrawingEnd(mouseEvent);
    }
}, { passive: false });

canvas.addEventListener('touchcancel', (e) => {
    e.preventDefault();
    isDrawing = false;
    if (isPanning) {
        stopPan();
    }
}, { passive: false });


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
    saveToLocalStorage(); // Save cleared canvas to localStorage
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

// Share button
const shareModal = document.getElementById('shareModal');
const shareStatus = document.getElementById('shareStatus');
const shareLinkContainer = document.getElementById('shareLinkContainer');
const shareLink = document.getElementById('shareLink');
const copyLinkBtn = document.getElementById('copyLinkBtn');
const shareModalClose = document.getElementById('shareModalClose');

shareBtn.addEventListener('click', async () => {
    // Show modal with loading state
    shareModal.classList.add('show');
    shareStatus.textContent = '🎨 Uploading your painting...';
    shareLinkContainer.style.display = 'none';
    
    try {
        // Convert canvas to blob
        const dataUrl = canvas.toDataURL('image/png');
        const response = await fetch(dataUrl);
        const blob = await response.blob();
        
        // Create form data
        const formData = new FormData();
        formData.append('canvas', blob, 'canvas.png');
        
        // Upload to API
        const uploadResponse = await fetch('/api/share', {
            method: 'POST',
            body: formData,
        });
        
        if (!uploadResponse.ok) {
            throw new Error('Failed to upload painting');
        }
        
        const { id } = await uploadResponse.json();
        
        // Generate shareable URL
        const shareUrl = `${window.location.origin}/paintings/${id}`;
        
        // Update UI
        shareStatus.textContent = '🎉 Your painting is ready to share!';
        shareLink.value = shareUrl;
        shareLinkContainer.style.display = 'block';
    } catch (error) {
        console.error('Error sharing painting:', error);
        shareStatus.textContent = 'Error sharing painting. Please try again.';
        shareLinkContainer.style.display = 'none';
    }
});

// Copy link button
copyLinkBtn.addEventListener('click', async () => {
    try {
        await navigator.clipboard.writeText(shareLink.value);
        
        // Update button text temporarily
        const originalText = copyLinkBtn.textContent;
        copyLinkBtn.textContent = 'Copied!';
        setTimeout(() => {
            copyLinkBtn.textContent = originalText;
        }, 2000);
    } catch (error) {
        // Fallback: select text and show message (user can manually copy)
        shareLink.select();
        shareLink.focus();
        
        // Show a message that user needs to copy manually
        const originalText = copyLinkBtn.textContent;
        copyLinkBtn.textContent = 'Select & Copy';
        setTimeout(() => {
            copyLinkBtn.textContent = originalText;
        }, 2000);
        
        console.warn('Clipboard API not available, text selected for manual copy');
    }
});

// Close share modal
shareModalClose.addEventListener('click', () => {
    shareModal.classList.remove('show');
});

// Close modal when clicking outside
shareModal.addEventListener('click', (e) => {
    if (e.target === shareModal) {
        shareModal.classList.remove('show');
    }
});

// Initialize cursor indicator (only on non-touch devices)
if (!isTouchDevice) {
    updateCursorIndicator();
} else {
    // Hide cursor indicator on touch devices
    if (cursorIndicator) {
        cursorIndicator.style.display = 'none';
    }
}

