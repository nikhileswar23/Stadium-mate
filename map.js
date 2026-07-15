document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const destId = urlParams.get('dest');
    const fromId = urlParams.get('from') || 'plaza';

    if (destId) {
        highlightDestination(destId, fromId);
    }

    // Hover tooltip logic
    const hoverTooltip = document.getElementById('hoverTooltip');
    const markers = document.querySelectorAll('.marker');

    markers.forEach(marker => {
        marker.addEventListener('mouseenter', () => {
            const name = marker.getAttribute('data-name');
            if (name) {
                hoverTooltip.textContent = name;
                hoverTooltip.classList.add('visible');
            }
        });

        marker.addEventListener('mousemove', (e) => {
            let left = e.clientX + 14;
            let top = e.clientY - 12;
            
            // Check if tooltip overflows the right window edge
            const tooltipRect = hoverTooltip.getBoundingClientRect();
            if (left + tooltipRect.width > window.innerWidth) {
                left = e.clientX - tooltipRect.width - 14;
            }
            
            hoverTooltip.style.left = `${left}px`;
            hoverTooltip.style.top = `${top}px`;
        });

        marker.addEventListener('mouseleave', () => {
            hoverTooltip.classList.remove('visible');
        });
    });
});

function highlightDestination(id, fromId) {
    const destId = id.toLowerCase().replace(/\s+/g, '-');
    const marker = document.getElementById(destId);
    
    let originX = 400;
    let originY = 550;

    if (fromId && fromId !== 'plaza') {
        const fromMarker = document.getElementById(fromId);
        if (fromMarker) {
            const transform = fromMarker.getAttribute('transform');
            if (transform) {
                const match = transform.match(/translate\(([-\d.]+)[,\s]+([-\d.]+)\)/);
                if (match) {
                    originX = parseFloat(match[1]);
                    originY = parseFloat(match[2]);
                }
            }
        }
    }

    const originMarker = document.getElementById('originMarker');
    if (originMarker) {
        originMarker.setAttribute('transform', `translate(${originX}, ${originY})`);
        originMarker.style.display = 'block';
    }

    if (!marker) return;

    const transform = marker.getAttribute('transform');
    if (transform) {
        const match = transform.match(/translate\(([-\d.]+)[,\s]+([-\d.]+)\)/);
        if (match) {
            const destX = parseFloat(match[1]);
            const destY = parseFloat(match[2]);
            
            marker.classList.add('highlight');

            const tooltip = document.getElementById('tooltipGroup');
            tooltip.setAttribute('transform', `translate(${destX}, ${destY})`);
            tooltip.style.display = 'block';

            drawRoute(originX, originY, fromId, destX, destY, destId);
        }
    }
}

function drawRoute(startX, startY, startId, endX, endY, endId) {
    const routeLine = document.getElementById('routeLine');
    const outsideLocs = ['rail-station', 'bus-plaza', 'rideshare-zone'];
    
    let logicalStartX = startX, logicalStartY = startY;
    let logicalEndX = endX, logicalEndY = endY;
    
    let pathPrefix = `M ${startX} ${startY}`;
    let pathSuffix = `L ${endX} ${endY}`;
    
    function getNearestGate(x, y) {
        const gates = ['gate-a', 'gate-b', 'gate-c', 'gate-d', 'gate-e', 'gate-g'];
        let minD = Infinity;
        let coords = null;
        gates.forEach(gid => {
            const g = document.getElementById(gid);
            if (g) {
                const tr = g.getAttribute('transform');
                const m = tr.match(/translate\(([-\d.]+)[,\s]+([-\d.]+)\)/);
                if (m) {
                    const gx = parseFloat(m[1]), gy = parseFloat(m[2]);
                    const d = Math.hypot(gx - x, gy - y);
                    if (d < minD) { minD = d; coords = {x: gx, y: gy}; }
                }
            }
        });
        return coords;
    }
    
    if (outsideLocs.includes(startId)) {
        const gate = getNearestGate(startX, startY);
        if (gate) {
            pathPrefix += ` L ${gate.x} ${gate.y}`;
            logicalStartX = gate.x; logicalStartY = gate.y;
        }
    }
    
    if (outsideLocs.includes(endId)) {
        const gate = getNearestGate(endX, endY);
        if (gate) {
            pathSuffix = `L ${gate.x} ${gate.y} ` + pathSuffix;
            logicalEndX = gate.x; logicalEndY = gate.y;
        }
    }
    
    const ringNodes = [];
    const cx = 400, cy = 300, rx = 220, ry = 140;
    for (let i = 0; i < 16; i++) {
        const angle = i * (2 * Math.PI / 16);
        ringNodes.push({ x: cx + rx * Math.cos(angle), y: cy + ry * Math.sin(angle) });
    }
    
    function getNearestRingNode(x, y) {
        let minD = Infinity, idx = 0;
        for (let i = 0; i < 16; i++) {
            const d = Math.hypot(ringNodes[i].x - x, ringNodes[i].y - y);
            if (d < minD) { minD = d; idx = i; }
        }
        return idx;
    }
    
    const startIndex = getNearestRingNode(logicalStartX, logicalStartY);
    const endIndex = getNearestRingNode(logicalEndX, logicalEndY);
    
    const distCW = (endIndex - startIndex + 16) % 16;
    const distCCW = (startIndex - endIndex + 16) % 16;
    const sweepFlag = distCW <= distCCW ? 1 : 0;
    
    let d = `${pathPrefix} L ${ringNodes[startIndex].x} ${ringNodes[startIndex].y}`;
    
    if (startIndex !== endIndex) {
        const step = sweepFlag === 1 ? 1 : -1;
        let curr = startIndex;
        while (curr !== endIndex) {
            curr = (curr + step + 16) % 16;
            d += ` A ${rx} ${ry} 0 0 ${sweepFlag} ${ringNodes[curr].x} ${ringNodes[curr].y}`;
        }
    }
    
    d += ` ${pathSuffix}`;
    routeLine.setAttribute('d', d);
}
