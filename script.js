document.addEventListener('DOMContentLoaded', () => {
                const canvasContainer = document.getElementById('canvas-container');
        const canvas = document.getElementById('canvas');
        const addBoxBtn = document.getElementById('add-box-btn');
        const undoBtn = document.getElementById('undo-btn');
        const redoBtn = document.getElementById('redo-btn');
        const groupBtn = document.getElementById('group-btn');
        const ungroupBtn = document.getElementById('ungroup-btn');
        const duplicateBtn = document.getElementById('duplicate-btn');
        const swapBtn = document.getElementById('swap-btn');
        const exportBtn = document.getElementById('export-btn');
        const colorTemplatesPanel = document.getElementById('color-templates-panel');
        const templateButtons = document.querySelectorAll('.template-btn');
                        const settingsPanel = document.getElementById('settings-panel');
        const boxTextInput = document.getElementById('box-text-input');
        const textColorInput = document.getElementById('text-color');
        const bgColorInput = document.getElementById('bg-color');
        const borderColorInput = document.getElementById('border-color');
        const textColorHex = document.getElementById('text-color-hex');
        const bgColorHex = document.getElementById('bg-color-hex');
        const borderColorHex = document.getElementById('border-color-hex');
        const selectionCount = document.querySelector('.selection-count');
        const duplicatePanelBtn = document.getElementById('duplicate-panel-btn');
        const deleteBtn = document.getElementById('delete-btn');

        let boxes = [];
        let selectedIds = new Set();
        let activeDrag = null;
        let activeResize = null;
        let nextId = 0;
        let nextGroupId = 0;
        const SNAP_THRESHOLD = 6;
        
        let history = [];
        let historyIndex = -1;
        
        // Pan and Zoom
        let scale = 1;
        let panX = 0;
        let panY = 0;
        let isPanning = false;
        let panStartX = 0;
        let panStartY = 0;

        // --- History / State Management ---
        function saveState() {
            // Clear future states if we are in the middle of history
            if (historyIndex < history.length - 1) {
                history = history.slice(0, historyIndex + 1);
            }
            history.push(JSON.parse(JSON.stringify(boxes)));
            historyIndex++;
            updateHistoryButtons();
        }

        function undo() {
            if (historyIndex > 0) {
                historyIndex--;
                boxes = JSON.parse(JSON.stringify(history[historyIndex]));
                // Ensure selection is cleared or restored properly after undo
                selectedIds.clear();
                updateUI();
            }
            updateHistoryButtons();
        }
        
        function redo() {
            if (historyIndex < history.length - 1) {
                historyIndex++;
                boxes = JSON.parse(JSON.stringify(history[historyIndex]));
                selectedIds.clear();
                updateUI();
            }
            updateHistoryButtons();
        }
        
        function updateHistoryButtons() {
            undoBtn.disabled = historyIndex <= 0;
            redoBtn.disabled = historyIndex >= history.length - 1;
        }

        // --- Box Operations ---
                addBoxBtn.addEventListener('click', () => createBox());
        undoBtn.addEventListener('click', undo);
        redoBtn.addEventListener('click', redo);
        groupBtn.addEventListener('click', groupSelectedBoxes);
        ungroupBtn.addEventListener('click', ungroupSelectedBoxes);
        duplicateBtn.addEventListener('click', duplicateSelected);
        swapBtn.addEventListener('click', swapSelectedBoxes);
        exportBtn.addEventListener('click', exportToPNG);
        duplicatePanelBtn.addEventListener('click', duplicateSelected);
        deleteBtn.addEventListener('click', deleteSelectedBoxes);
        
        // Color template buttons
        templateButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const template = btn.dataset.template;
                applyColorTemplate(template);
            });
        });
        
                document.addEventListener('keydown', (e) => {
            // Prevent actions when editing text
            const target = e.target;
            const isEditing = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
            
            if ((e.key === 'Delete') && selectedIds.size > 0 && !isEditing) {
                e.preventDefault();
                deleteSelectedBoxes();
            }
            // Backspace only when not editing
            if (e.key === 'Backspace' && selectedIds.size > 0 && !isEditing) {
                e.preventDefault();
                deleteSelectedBoxes();
            }
            // Undo shortcut
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey && !isEditing) {
                e.preventDefault();
                undo();
            }
            // Redo shortcut
            if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey)) && !isEditing) {
                e.preventDefault();
                redo();
            }
            // Duplicate shortcut (Ctrl+D)
            if ((e.ctrlKey || e.metaKey) && e.key === 'd' && selectedIds.size > 0 && !isEditing) {
                e.preventDefault();
                duplicateSelected();
            }
        });

                function createBox(x = null, y = null) {
            const id = nextId++;
            
            // Calculate center position based on current viewport
            let defaultX, defaultY;
            if (x === null || y === null) {
                const containerRect = canvasContainer.getBoundingClientRect();
                const centerX = containerRect.width / 2;
                const centerY = containerRect.height / 2;
                
                // Convert viewport center to canvas coordinates
                defaultX = (centerX - panX) / scale;
                defaultY = (centerY - panY) / scale;
                
                // Use calculated positions
                x = Math.round(defaultX - 75);
                y = Math.round(defaultY - 75);
            }
            
            const box = {
                id: id,
                x: x,
                y: y,
                size: 150,
                text: `${id + 1}`,
                textColor: '#334155', // slate-700
                bgColor: '#ffffff', // white background
                borderColor: '#334155', // slate-700
                groupId: null
            };
            boxes.push(box);
            saveState();
            renderBox(box);
            selectBox(box.id, false);
            return box;
        }
        
        function createBoxRelativeTo(referenceBox, direction) {
            const offset = referenceBox.size + 20; // 20px gap
            let x = referenceBox.x;
            let y = referenceBox.y;
            
            switch(direction) {
                case 'top':
                    y = referenceBox.y - offset;
                    break;
                case 'bottom':
                    y = referenceBox.y + offset;
                    break;
                case 'left':
                    x = referenceBox.x - offset;
                    break;
                case 'right':
                    x = referenceBox.x + offset;
                    break;
            }
            
                        // Create new box with same settings as reference box
            const id = nextId++;
            const newBox = {
                id: id,
                x: x,
                y: y,
                size: referenceBox.size, // Copy size
                text: `${id + 1}`,
                textColor: referenceBox.textColor, // Copy text color
                bgColor: referenceBox.bgColor, // Copy background color
                borderColor: referenceBox.borderColor, // Copy border color
                groupId: referenceBox.groupId // Copy group if exists
            };
            
            boxes.push(newBox);
            saveState();
            renderBox(newBox);
            selectBox(newBox.id, false);
            return newBox;
        }
        
                function deleteSelectedBoxes() {
            if(selectedIds.size === 0) return;
            boxes = boxes.filter(box => !selectedIds.has(box.id));
            clearSelection();
            saveState();
            updateUI();
        }
        
        function swapSelectedBoxes() {
            if(selectedIds.size !== 2) return;
            
            const selectedArray = Array.from(selectedIds);
            const box1 = findBoxById(selectedArray[0]);
            const box2 = findBoxById(selectedArray[1]);
            
            if (!box1 || !box2) return;
            
            // Swap positions
            const tempX = box1.x;
            const tempY = box1.y;
            
            box1.x = box2.x;
            box1.y = box2.y;
            box2.x = tempX;
            box2.y = tempY;
            
            saveState();
            updateUI();
        }
        
        function applyColorTemplate(template) {
            if(selectedIds.size === 0) return;
            
            const templates = {
                red: {
                    textColor: '#FFFFFF',
                    bgColor: '#F53D3D',
                    borderColor: '#A02334'
                },
                green: {
                    textColor: '#FFFFFF',
                    bgColor: '#437057',
                    borderColor: '#2F5249'
                },
                orange: {
                    textColor: '#FFFFFF',
                    bgColor: '#FFA55D',
                    borderColor: '#A76545'
                }
            };
            
            const colors = templates[template];
            if (!colors) return;
            
            selectedIds.forEach(id => {
                const box = findBoxById(id);
                if (box) {
                    box.textColor = colors.textColor;
                    box.bgColor = colors.bgColor;
                    box.borderColor = colors.borderColor;
                }
            });
            
            saveState();
            updateUI();
        }
        
        function duplicateSelected() {
            if(selectedIds.size === 0) return;
            
            const newBoxes = [];
            const oldToNewIdMap = new Map();
            const offset = 30; // Offset for duplicated boxes
            
            // Get all selected boxes and their group info
            const selectedBoxes = Array.from(selectedIds).map(id => findBoxById(id));
            const groupIds = new Set(selectedBoxes.map(box => box.groupId).filter(gid => gid !== null));
            const groupIdMap = new Map(); // Map old group IDs to new ones
            
            // Create new group IDs for groups being duplicated
            groupIds.forEach(oldGroupId => {
                groupIdMap.set(oldGroupId, nextGroupId++);
            });
            
                        // Duplicate each selected box
            selectedBoxes.forEach(box => {
                const newId = nextId++;
                const newBox = {
                    id: newId,
                    x: box.x + offset,
                    y: box.y + offset,
                    size: box.size,
                    text: box.text,
                    textColor: box.textColor,
                    bgColor: box.bgColor,
                    borderColor: box.borderColor || '#334155',
                    groupId: box.groupId !== null ? groupIdMap.get(box.groupId) : null
                };
                
                newBoxes.push(newBox);
                oldToNewIdMap.set(box.id, newId);
            });
            
            // Add new boxes to the canvas
            boxes.push(...newBoxes);
            
            // Select the new boxes
            clearSelection();
            newBoxes.forEach(box => selectedIds.add(box.id));
            
            saveState();
            updateUI();
        }
        
        // --- Group Operations ---
        function groupSelectedBoxes() {
            if (selectedIds.size < 2) return;
            const groupId = nextGroupId++;
            selectedIds.forEach(id => {
                const box = findBoxById(id);
                box.groupId = groupId;
            });
            saveState();
            updateUI();
        }
        
        function ungroupSelectedBoxes() {
            if (selectedIds.size === 0) return;
            selectedIds.forEach(id => {
                const box = findBoxById(id);
                box.groupId = null;
            });
            saveState();
            updateUI();
        }
        
        function selectGroup(groupId) {
            boxes.forEach(box => {
                if (box.groupId === groupId) {
                    selectedIds.add(box.id);
                }
            });
            updateUI();
        }

        // --- Rendering ---
        function renderAllBoxes() {
            canvas.innerHTML = ''; // Clear canvas before re-rendering
            boxes.forEach(boxData => renderBox(boxData));
        }

        function renderBox(boxData) {
            let boxElement = document.getElementById(`box-${boxData.id}`);
            if (!boxElement) {
                boxElement = document.createElement('div');
                boxElement.id = `box-${boxData.id}`;
                boxElement.className = 'box';
                 boxElement.innerHTML = `
                    <p contenteditable="false">${boxData.text}</p>
                    <div class="resize-handle resize-se" style="display: none;"></div>
                    <button class="add-box-btn add-top" data-direction="top">+</button>
                    <button class="add-box-btn add-bottom" data-direction="bottom">+</button>
                    <button class="add-box-btn add-left" data-direction="left">+</button>
                    <button class="add-box-btn add-right" data-direction="right">+</button>
                `;
                canvas.appendChild(boxElement);
                addBoxEventListeners(boxElement, boxData);
            }
           
                        boxElement.style.left = `${boxData.x}px`;
            boxElement.style.top = `${boxData.y}px`;
            boxElement.style.width = `${boxData.size}px`;
            boxElement.style.height = `${boxData.size}px`;
            boxElement.style.backgroundColor = boxData.bgColor || '#ffffff';
            boxElement.style.borderColor = boxData.borderColor || '#334155';

            const pElement = boxElement.querySelector('p');
            pElement.textContent = boxData.text;
            pElement.style.color = boxData.textColor;

            if (selectedIds.has(boxData.id)) {
                boxElement.classList.add('selected');
                boxElement.querySelector('.resize-handle').style.display = 'block';
            } else {
                boxElement.classList.remove('selected');
                boxElement.querySelector('.resize-handle').style.display = 'none';
            }
            
            // Add group indicator
            if (boxData.groupId !== null) {
                boxElement.classList.add('grouped');
            } else {
                boxElement.classList.remove('grouped');
            }
        }
        
        function addBoxEventListeners(element, boxData) {
            const textElement = element.querySelector('p');
            const resizeHandle = element.querySelector('.resize-handle');
            const addButtons = element.querySelectorAll('.add-box-btn');

            element.addEventListener('mousedown', (e) => {
                if (e.target === resizeHandle || textElement.isContentEditable || e.target.classList.contains('add-box-btn')) return;
                selectBox(boxData.id, e.shiftKey);
                startDrag(e);
            });
            
            // Add box buttons
            addButtons.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    const direction = btn.dataset.direction;
                    createBoxRelativeTo(boxData, direction);
                });
                
                // Prevent button from interfering with settings panel
                btn.addEventListener('mousedown', (e) => {
                    e.stopPropagation();
                });
            });

            element.addEventListener('dblclick', () => {
                textElement.contentEditable = true;
                textElement.focus();
                document.execCommand('selectAll', false, null);
                element.style.cursor = 'default';
            });

                        textElement.addEventListener('blur', () => {
                textElement.contentEditable = false;
                const newText = textElement.textContent.trim();
                if (boxData.text !== newText) {
                    boxData.text = newText;
                    saveState();
                }
                element.style.cursor = 'move';
                updateUI();
            });
            textElement.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    textElement.blur();
                }
            });

            resizeHandle.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                startResize(e);
            });
        }
        
        // --- Selection Logic ---
        canvas.addEventListener('mousedown', (e) => {
            if (e.target === canvas) {
                clearSelection();
            }
        });
        
        function selectBox(id, isMultiSelect) {
            const box = findBoxById(id);
            if (!box) return; // Safety check
            
            // If box is in a group and not multi-selecting, select entire group
            if (!isMultiSelect && box.groupId !== null) {
                clearSelection();
                selectGroup(box.groupId);
                return;
            }
            
            if (!isMultiSelect) {
                clearSelection();
            }
            if (selectedIds.has(id)) {
                if (isMultiSelect) selectedIds.delete(id);
            } else {
                selectedIds.add(id);
            }
            updateUI();
        }

        function clearSelection() {
            selectedIds.clear();
            updateUI();
        }

        // --- Dragging Logic ---
        function startDrag(e) {
            // Check if middle mouse button for panning
            if (e.button === 1 || e.button === 2 || (e.button === 0 && e.altKey)) {
                e.preventDefault();
                startPan(e);
                return;
            }
            
            const initialPositions = new Map();
            selectedIds.forEach(id => {
                const box = findBoxById(id);
                initialPositions.set(id, { x: box.x, y: box.y });
            });

            activeDrag = {
                startX: e.clientX,
                startY: e.clientY,
                initialPositions,
                moved: false
            };

            window.addEventListener('mousemove', dragMove);
            window.addEventListener('mouseup', stopDrag);
        }

        function dragMove(e) {
            if (!activeDrag) return;
            e.preventDefault();
            activeDrag.moved = true;

            const dx = (e.clientX - activeDrag.startX) / scale;
            const dy = (e.clientY - activeDrag.startY) / scale;
            let snapLines = { h: [], v: [] };
            const targetPositions = getTargetSnapPositions();

            selectedIds.forEach(id => {
                const box = findBoxById(id);
                if (!box) return; // Safety check
                
                const initialPos = activeDrag.initialPositions.get(id);
                if (!initialPos) return; // Safety check
                
                let newX = initialPos.x + dx;
                let newY = initialPos.y + dy;
                
                const currentBoxEdges = getBoxEdges(newX, newY, box.size);
                let snapX = false, snapY = false;

                for (const pos of targetPositions.v) {
                    for (const edge of currentBoxEdges.v) {
                         if (Math.abs(edge - pos) < SNAP_THRESHOLD) {
                            newX += pos - edge;
                            snapLines.v.push(pos);
                            snapX = true;
                            break;
                        }
                    }
                    if(snapX) break;
                }

                for (const pos of targetPositions.h) {
                    for (const edge of currentBoxEdges.h) {
                        if (Math.abs(edge - pos) < SNAP_THRESHOLD) {
                            newY += pos - edge;
                            snapLines.h.push(pos);
                            snapY = true;
                            break;
                        }
                    }
                    if(snapY) break;
                }
                
                box.x = newX;
                box.y = newY;
            });
            
            drawSnapLines(snapLines);
            updateUI();
        }

        function stopDrag() {
            if (activeDrag && activeDrag.moved) {
                saveState();
            }
            activeDrag = null;
            clearSnapLines();
            window.removeEventListener('mousemove', dragMove);
            window.removeEventListener('mouseup', stopDrag);
        }


        // --- Resizing Logic ---
        function startResize(e) {
            const initialSizes = new Map();
            selectedIds.forEach(id => {
                initialSizes.set(id, findBoxById(id).size);
            });

            activeResize = {
                startX: e.clientX,
                startY: e.clientY,
                initialSizes,
                resized: false
            };
            window.addEventListener('mousemove', resizeMove);
            window.addEventListener('mouseup', stopResize);
        }

        function resizeMove(e) {
            if (!activeResize) return;
            e.preventDefault();
            activeResize.resized = true;

            const dx = (e.clientX - activeResize.startX) / scale;
            const dy = (e.clientY - activeResize.startY) / scale;
            const delta = Math.max(dx, dy);

            selectedIds.forEach(id => {
                const box = findBoxById(id);
                if (!box) return; // Safety check
                
                const initialSize = activeResize.initialSizes.get(id);
                if (!initialSize) return; // Safety check
                
                let newSize = initialSize + delta;
                if (newSize < 50) newSize = 50;
                box.size = Math.round(newSize);
            });
            updateUI();
        }

        function stopResize() {
            if (activeResize && activeResize.resized) {
                saveState();
            }
            activeResize = null;
            window.removeEventListener('mousemove', resizeMove);
            window.removeEventListener('mouseup', stopResize);
        }
        
        // --- Snapping Helpers ---
        function getBoxEdges(x, y, size) {
            const centerX = x + size / 2;
            const centerY = y + size / 2;
            return {
                v: [x, centerX, x + size],
                h: [y, centerY, y + size]
            };
        }
        
        function getTargetSnapPositions() {
            const positions = { v: [], h: [] };
            boxes.forEach(box => {
                if (!selectedIds.has(box.id)) {
                    const edges = getBoxEdges(box.x, box.y, box.size);
                    positions.v.push(...edges.v);
                    positions.h.push(...edges.h);
                }
            });
            return positions;
        }

        function drawSnapLines({ h, v }) {
            clearSnapLines();
            v.forEach(pos => {
                const line = document.createElement('div');
                line.className = 'snap-line snap-line-v';
                line.style.left = `${pos}px`;
                canvas.appendChild(line);
            });
            h.forEach(pos => {
                const line = document.createElement('div');
                line.className = 'snap-line snap-line-h';
                line.style.top = `${pos}px`;
                canvas.appendChild(line);
            });
        }

        function clearSnapLines() {
            document.querySelectorAll('.snap-line').forEach(line => line.remove());
        }

                        // --- Settings Panel ---
        function updateSettingsPanel() {
            if (selectedIds.size === 0) {
                settingsPanel.style.display = 'none';
                return;
            }

            const lastSelectedId = Array.from(selectedIds).pop();
            const lastSelectedBox = findBoxById(lastSelectedId);
            if (!lastSelectedBox) {
                settingsPanel.style.display = 'none';
                return;
            }

            settingsPanel.style.display = 'flex';
            
            // Update selection count
            selectionCount.textContent = `${selectedIds.size}`;
            
                        // Update text input
            boxTextInput.value = lastSelectedBox.text || '';
            
            // Update color inputs and hex displays
            textColorInput.value = lastSelectedBox.textColor || '#334155';
            bgColorInput.value = lastSelectedBox.bgColor || '#ffffff';
            borderColorInput.value = lastSelectedBox.borderColor || '#334155';
            
            textColorHex.value = (lastSelectedBox.textColor || '#334155').toUpperCase();
            bgColorHex.value = (lastSelectedBox.bgColor || '#ffffff').toUpperCase();
            borderColorHex.value = (lastSelectedBox.borderColor || '#334155').toUpperCase();
        }

                                // Helper function to validate hex color
        function isValidHexColor(hex) {
            return /^#[0-9A-F]{6}$/i.test(hex);
        }
        
        // Text input change
        boxTextInput.addEventListener('input', (e) => {
            const newText = e.target.value;
            selectedIds.forEach(id => {
                const box = findBoxById(id);
                if (box) box.text = newText;
            });
            updateUI();
        });
        
        boxTextInput.addEventListener('blur', (e) => {
            saveState();
        });
        
        boxTextInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                boxTextInput.blur();
            }
        });
        
        // Text Color - Color Picker
        textColorInput.addEventListener('input', (e) => {
            const newColor = e.target.value;
            textColorHex.value = newColor.toUpperCase();
            selectedIds.forEach(id => {
                const box = findBoxById(id);
                if (box) box.textColor = newColor;
            });
            updateUI();
        });
        
        textColorInput.addEventListener('change', (e) => {
            saveState();
        });
        
        // Text Color - Hex Input
        textColorHex.addEventListener('input', (e) => {
            let hex = e.target.value.toUpperCase();
            if (!hex.startsWith('#')) {
                hex = '#' + hex;
                e.target.value = hex;
            }
            if (isValidHexColor(hex)) {
                textColorInput.value = hex;
                selectedIds.forEach(id => {
                    const box = findBoxById(id);
                    if (box) box.textColor = hex;
                });
                updateUI();
            }
        });
        
        textColorHex.addEventListener('blur', (e) => {
            let hex = e.target.value.toUpperCase();
            if (!hex.startsWith('#')) hex = '#' + hex;
            if (!isValidHexColor(hex)) {
                // Revert to current color if invalid
                const lastSelectedId = Array.from(selectedIds).pop();
                const lastSelectedBox = findBoxById(lastSelectedId);
                if (lastSelectedBox) {
                    e.target.value = lastSelectedBox.textColor.toUpperCase();
                }
            } else {
                saveState();
            }
        });
        
        textColorHex.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                e.target.blur();
            }
        });
        
        // Background Color - Color Picker
        bgColorInput.addEventListener('input', (e) => {
            const newColor = e.target.value;
            bgColorHex.value = newColor.toUpperCase();
            selectedIds.forEach(id => {
                const box = findBoxById(id);
                if (box) box.bgColor = newColor;
            });
            updateUI();
        });
        
        bgColorInput.addEventListener('change', (e) => {
            saveState();
        });
        
        // Background Color - Hex Input
        bgColorHex.addEventListener('input', (e) => {
            let hex = e.target.value.toUpperCase();
            if (!hex.startsWith('#')) {
                hex = '#' + hex;
                e.target.value = hex;
            }
            if (isValidHexColor(hex)) {
                bgColorInput.value = hex;
                selectedIds.forEach(id => {
                    const box = findBoxById(id);
                    if (box) box.bgColor = hex;
                });
                updateUI();
            }
        });
        
        bgColorHex.addEventListener('blur', (e) => {
            let hex = e.target.value.toUpperCase();
            if (!hex.startsWith('#')) hex = '#' + hex;
            if (!isValidHexColor(hex)) {
                const lastSelectedId = Array.from(selectedIds).pop();
                const lastSelectedBox = findBoxById(lastSelectedId);
                if (lastSelectedBox) {
                    e.target.value = lastSelectedBox.bgColor.toUpperCase();
                }
            } else {
                saveState();
            }
        });
        
        bgColorHex.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                e.target.blur();
            }
        });
        
        // Border Color - Color Picker
        borderColorInput.addEventListener('input', (e) => {
            const newColor = e.target.value;
            borderColorHex.value = newColor.toUpperCase();
            selectedIds.forEach(id => {
                const box = findBoxById(id);
                if (box) box.borderColor = newColor;
            });
            updateUI();
        });
        
        borderColorInput.addEventListener('change', (e) => {
            saveState();
        });
        
        // Border Color - Hex Input
        borderColorHex.addEventListener('input', (e) => {
            let hex = e.target.value.toUpperCase();
            if (!hex.startsWith('#')) {
                hex = '#' + hex;
                e.target.value = hex;
            }
            if (isValidHexColor(hex)) {
                borderColorInput.value = hex;
                selectedIds.forEach(id => {
                    const box = findBoxById(id);
                    if (box) box.borderColor = hex;
                });
                updateUI();
            }
        });
        
        borderColorHex.addEventListener('blur', (e) => {
            let hex = e.target.value.toUpperCase();
            if (!hex.startsWith('#')) hex = '#' + hex;
            if (!isValidHexColor(hex)) {
                const lastSelectedId = Array.from(selectedIds).pop();
                const lastSelectedBox = findBoxById(lastSelectedId);
                if (lastSelectedBox) {
                    e.target.value = lastSelectedBox.borderColor.toUpperCase();
                }
            } else {
                saveState();
            }
        });
        
        borderColorHex.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                e.target.blur();
            }
        });

        // --- Pan and Zoom ---
        function startPan(e) {
            isPanning = true;
            panStartX = e.clientX - panX;
            panStartY = e.clientY - panY;
            canvas.style.cursor = 'grabbing';
            canvasContainer.style.cursor = 'grabbing';
            
            window.addEventListener('mousemove', panMove);
            window.addEventListener('mouseup', stopPan);
        }
        
        function panMove(e) {
            if (!isPanning) return;
            e.preventDefault();
            panX = e.clientX - panStartX;
            panY = e.clientY - panStartY;
            updateCanvasTransform();
        }
        
        function stopPan() {
            isPanning = false;
            canvas.style.cursor = 'default';
            canvasContainer.style.cursor = 'default';
            window.removeEventListener('mousemove', panMove);
            window.removeEventListener('mouseup', stopPan);
        }
        
        function updateCanvasTransform() {
            canvas.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
        }
        
        // Zoom with mouse wheel
        canvasContainer.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? 0.9 : 1.1;
            const newScale = Math.min(Math.max(0.1, scale * delta), 5);
            
            // Zoom towards mouse position
            const rect = canvasContainer.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            
            const scaleChange = newScale / scale;
            panX = mouseX - (mouseX - panX) * scaleChange;
            panY = mouseY - (mouseY - panY) * scaleChange;
            
            scale = newScale;
            updateCanvasTransform();
        }, { passive: false });
        
        // Pan with middle mouse or right click on canvas or container
        canvas.addEventListener('mousedown', (e) => {
            if (e.button === 1 || e.button === 2 || (e.button === 0 && e.altKey)) {
                e.preventDefault();
                startPan(e);
            } else if (e.target === canvas) {
                clearSelection();
            }
        });
        
        canvasContainer.addEventListener('mousedown', (e) => {
            if (e.target === canvasContainer && (e.button === 1 || e.button === 2 || (e.button === 0 && e.altKey))) {
                e.preventDefault();
                startPan(e);
            }
        });
        
        canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });
        
        canvasContainer.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });
        
        // --- Export to PNG ---
        async function exportToPNG() {
            // Calculate bounding box of all boxes
            if (boxes.length === 0) return;
            
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            boxes.forEach(box => {
                minX = Math.min(minX, box.x);
                minY = Math.min(minY, box.y);
                maxX = Math.max(maxX, box.x + box.size);
                maxY = Math.max(maxY, box.y + box.size);
            });
            
            const padding = 50;
            minX -= padding;
            minY -= padding;
            maxX += padding;
            maxY += padding;
            
            const width = maxX - minX;
            const height = maxY - minY;
            
            // Create temporary canvas
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = width;
            tempCanvas.height = height;
            const ctx = tempCanvas.getContext('2d');
            
            // No background - transparent
            ctx.clearRect(0, 0, width, height);
            
                        // Draw boxes
            boxes.forEach(box => {
                const x = box.x - minX;
                const y = box.y - minY;
                
                // Draw box background
                ctx.fillStyle = box.bgColor || '#ffffff';
                ctx.fillRect(x, y, box.size, box.size);
                
                // Draw shadow
                ctx.shadowColor = 'rgba(0, 0, 0, 0.1)';
                ctx.shadowBlur = 10;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 4;
                
                // Draw box border (ignore group styling in export)
                ctx.strokeStyle = box.borderColor || '#334155';
                ctx.lineWidth = 2;
                ctx.strokeRect(x, y, box.size, box.size);
                
                // Reset shadow
                ctx.shadowColor = 'transparent';
                ctx.shadowBlur = 0;
                
                // Draw text
                ctx.fillStyle = box.textColor;
                ctx.font = 'bold 24px Inter, sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(box.text, x + box.size / 2, y + box.size / 2);
            });
            
            // Download
            tempCanvas.toBlob(blob => {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `canvas-export-${Date.now()}.png`;
                a.click();
                URL.revokeObjectURL(url);
            }, 'image/png');
        }
        
        // --- Utility ---
        function findBoxById(id) {
            return boxes.find(b => b.id === id);
        }

        function updateUI() {
            // A more robust re-render to handle additions/deletions
            const existingBoxElements = document.querySelectorAll('.box');
            const boxIdsOnCanvas = new Set(Array.from(existingBoxElements).map(el => parseInt(el.id.split('-')[1])));
            const boxIdsInData = new Set(boxes.map(b => b.id));

            // Remove elements that are no longer in the data
            boxIdsOnCanvas.forEach(id => {
                if (!boxIdsInData.has(id)) {
                    document.getElementById(`box-${id}`)?.remove();
                }
            });

            // Render all current boxes (updates existing, adds new)
            boxes.forEach(renderBox);
            updateSettingsPanel();
            updateHistoryButtons();
            
                        // Update group buttons
            groupBtn.disabled = selectedIds.size < 2;
            ungroupBtn.disabled = selectedIds.size === 0;
            duplicateBtn.disabled = selectedIds.size === 0;
            swapBtn.disabled = selectedIds.size !== 2;
        }

        // --- Initial setup ---
        // Center the canvas initially
        const containerRect = canvasContainer.getBoundingClientRect();
        panX = containerRect.width / 2 - 5000; // Center of 10000px canvas
        panY = containerRect.height / 2 - 5000;
        updateCanvasTransform();
        
                saveState(); // Save the initial empty state
        
        // Create first box at center
        setTimeout(() => {
            createBox();
        }, 100);
    });