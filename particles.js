// ══════════════════════════════════════════════
//  CANVAS PARTICLE ENGINE (DEBRIS & SPARKS)
// ══════════════════════════════════════════════

let gameParticles = [];

/**
 * Spawns a burst of physics particles at a grid cell
 * @param {number} col - Grid column (0-4)
 * @param {number} yRow - Grid row Y (0-9 decimal)
 * @param {string} type - Particle type ('flesh'|'metal'|'fire'|'ice'|'storm'|'void')
 * @param {number} count - Number of particles to spawn
 */
function explode(col, yRow, type = 'flesh', count = 8) {
  // Translate grid coordinates to 500x1000 Canvas logical coordinates
  const startX = (col + 0.5) * 100;
  const startY = yRow * 100 + 50;

  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 2 + Math.random() * 8;
    
    // Debris physics properties
    const p = {
      x: startX,
      y: startY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: 2 + Math.random() * 5,
      rotation: Math.random() * Math.PI * 2,
      vRot: (Math.random() - 0.5) * 0.3,
      alpha: 1.0,
      decay: 0.02 + Math.random() * 0.02,
      type: type,
      gravity: (type === 'metal' || type === 'flesh') ? 0.22 : 0.0,
      drag: (type === 'fire' || type === 'storm' || type === 'void') ? 0.90 : 0.96
    };

    gameParticles.push(p);
  }
}

/**
 * Updates all particles at 60 FPS (applied gravity, drag, rotation, and decay)
 */
function updateParticles() {
  for (let i = gameParticles.length - 1; i >= 0; i--) {
    const p = gameParticles[i];
    
    // Apply velocity
    p.x += p.vx;
    p.y += p.vy;
    
    // Apply gravity
    p.vy += p.gravity;
    
    // Apply air resistance/drag
    p.vx *= p.drag;
    p.vy *= p.drag;
    
    // Apply rotation
    p.rotation += p.vRot;
    
    // Decay alpha
    p.alpha -= p.decay;
    
    // Remove faded particles
    if (p.alpha <= 0) {
      gameParticles.splice(i, 1);
    }
  }
}

/**
 * Renders all particles on the 2D Canvas
 * @param {CanvasRenderingContext2D} ctx - Target Canvas context
 */
function drawParticles(ctx) {
  ctx.save();
  for (let i = 0; i < gameParticles.length; i++) {
    const p = gameParticles[i];
    ctx.save();
    ctx.globalAlpha = p.alpha;
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rotation);

    // Apply color and shape depending on debris element type
    switch (p.type) {
      case 'flesh':
        // organic blobs
        ctx.fillStyle = '#39ff14'; // Basic zombie green
        ctx.shadowColor = '#39ff14';
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(0, 0, p.size, 0, Math.PI * 2);
        ctx.fill();
        break;

      case 'metal':
        // armor scraps
        ctx.fillStyle = '#cfd8dc'; // steel gray
        ctx.strokeStyle = '#90a4ae';
        ctx.lineWidth = 1;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.strokeRect(-p.size / 2, -p.size / 2, p.size, p.size);
        break;

      case 'fire':
        // flame sparks
        ctx.fillStyle = '#ff7300';
        ctx.shadowColor = '#ff3700';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(0, 0, p.size, 0, Math.PI * 2);
        ctx.fill();
        break;

      case 'ice':
        // cryo shards (diamond shape)
        ctx.fillStyle = '#80deea';
        ctx.shadowColor = '#00e5ff';
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.moveTo(0, -p.size);
        ctx.lineTo(p.size, 0);
        ctx.lineTo(0, p.size);
        ctx.lineTo(-p.size, 0);
        ctx.closePath();
        ctx.fill();
        break;

      case 'storm':
        // electric arcs (zig-zag spark)
        ctx.strokeStyle = '#eaff00';
        ctx.shadowColor = '#c4ff00';
        ctx.shadowBlur = 8;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-p.size / 2, -p.size / 2);
        ctx.lineTo(0, p.size / 2);
        ctx.lineTo(p.size / 2, 0);
        ctx.stroke();
        break;

      case 'void':
        // dark void gravity sparks
        ctx.fillStyle = '#ce93d8';
        ctx.shadowColor = '#9c27b0';
        ctx.shadowBlur = 8;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        break;

      default:
        // fallback particle
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 0, p.size, 0, Math.PI * 2);
        ctx.fill();
        break;
    }
    ctx.restore();
  }
  ctx.restore();
}
