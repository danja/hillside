import { CubeNode } from './cube-node.js';
import { distance } from '../utils/math.js';
import { BaseSimulation } from '../base/base-simulation.js';

export class WireSimulation extends BaseSimulation {
    constructor(canvas, context, width, height, audioPlayer = null) {
        super(canvas, context, width, height, audioPlayer);
        
        // Wire specific parameters
        this.baseAlpha = 0.7;
        this.audioMultiplier = 2.5;
        this.baseDensity = 1.2;
        
        // Size divergence system to prevent convergence
        this.lastDivergenceTime = 0;
        this.divergenceInterval = 3000; // 3 seconds between potential divergences
        this.audioEnergyHistory = [];
        this.audioEnergyThreshold = 0.4;
        
        // 3D and visual parameters
        this.anaglyphOffset = 6; // Pixel offset for red/cyan anaglyph effect
        this.shadowOffset = 2;   // Shadow offset
        this.perspective = 300;  // 3D perspective distance
        
        this.initializeNodes();
        this.setupForces();
    }

    initializeNodes() {
        const nodeCount = window.innerWidth > 1024 ? 400 : 200;
        
        // Create grayscale distribution instead of rainbow
        const grayscaleScale = d3.scaleLinear()
            .domain([0, nodeCount - 1])
            .range([0.1, 0.9]); // Range from dark gray to light gray

        for (let i = 0; i < nodeCount; i++) {
            const node = new CubeNode(
                i,
                Math.random() * this.width,
                Math.random() * this.height,
                grayscaleScale(i)
            );
            this.nodes.push(node);
        }
    }

    setupForces() {
        // Custom 3D force system - don't rely on D3's 2D simulation
        // Instead, we'll implement 3D forces manually in processNodeInteractions
        
        // 3D force parameters
        this.centerX = this.width / 2;
        this.centerY = this.height / 2;
        this.centerZ = 55; // Middle of our Z range (10-100)
        
        this.centerForceStrength = 0.02;
        this.attractionStrength = 0.5;
        this.repulsionStrength = 0.8;
        this.repulsionDistance = 15; // 3D repulsion distance
        this.attractionDistance = 40; // 3D attraction distance
    }

    // Calculate time-based density variation
    getTimeDensity() {
        const elapsed = this.getElapsedTime();
        return this.baseDensity + Math.sin(elapsed / 30) * 0.3;
    }

    draw() {
        const currentTime = Date.now();
        
        // Update audio influence
        this.updateAudioInfluence();
        
        // Get audio analysis for density-based effects
        const density = this.getTimeDensity();
        const alpha = this.baseAlpha + (this.beatIntensity || 0) * this.audioMultiplier;
        
        // Clear canvas with black background
        this.context.fillStyle = '#000';
        this.context.fillRect(0, 0, this.width, this.height);
        
        // Update 3D force parameters based on audio
        this.updateForceParameters();
        
        // Update node properties based on audio
        this.updateNodesWithAudio();
        
        // Apply 3D forces and interactions
        this.apply3DForces();
        this.processNodeInteractions(density);
        
        // Handle periodic size divergence to prevent convergence
        this.handleSizeDivergence();
        
        // Update each node (decay, rotation, z-movement)
        for (const node of this.nodes) {
            node.update();
        }
        
        // Sort nodes by Z depth for proper rendering order (back to front)
        const sortedNodes = [...this.nodes].sort((a, b) => b.z - a.z);
        
        // Render cubes with anaglyph effect
        this.renderCubes(sortedNodes, alpha);
    }

    updateForceParameters() {
        // Update 3D force parameters based on audio
        const bassMultiplier = 1 + (this.bassInfluence || 0) * 2;
        const trebleMultiplier = 1 + (this.trebleInfluence || 0) * 1.5;
        const midMultiplier = 1 + (this.midInfluence || 0) * 1.2;
        
        // Audio affects 3D force strengths
        this.centerForceStrength = 0.02 * midMultiplier;
        this.attractionStrength = 0.5 * bassMultiplier;
        this.repulsionStrength = 0.8 * trebleMultiplier;
        this.repulsionDistance = 15 * trebleMultiplier;
        this.attractionDistance = 40 * bassMultiplier;
    }

    apply3DForces() {
        // Apply 3D physics forces to all nodes
        for (const node of this.nodes) {
            // Apply center force (3D)
            const toCenterX = this.centerX - node.x;
            const toCenterY = this.centerY - node.y;
            const toCenterZ = this.centerZ - node.z;
            
            node.vx += toCenterX * this.centerForceStrength;
            node.vy += toCenterY * this.centerForceStrength;
            node.vz += toCenterZ * this.centerForceStrength;
            
            // Apply velocity to position
            node.x += node.vx;
            node.y += node.vy;
            node.z += node.vz;
            
            // Velocity damping for organic movement
            node.vx *= 0.95;
            node.vy *= 0.95;
            node.vz *= 0.98; // Slower Z damping for more 3D movement
            
            // Boundary constraints with soft bouncing
            if (node.x < 0 || node.x > this.width) {
                node.vx *= -0.8;
                node.x = Math.max(0, Math.min(this.width, node.x));
            }
            if (node.y < 0 || node.y > this.height) {
                node.vy *= -0.8;
                node.y = Math.max(0, Math.min(this.height, node.y));
            }
        }
        
        // Apply inter-node forces (attraction/repulsion)
        for (let i = 0; i < this.nodes.length; i++) {
            for (let j = i + 1; j < this.nodes.length; j++) {
                this.apply3DInterNodeForce(this.nodes[i], this.nodes[j]);
            }
        }
    }

    apply3DInterNodeForce(node1, node2) {
        // Calculate 3D distance
        const dx = node2.x - node1.x;
        const dy = node2.y - node1.y;
        const dz = node2.z - node1.z;
        const distance3D = Math.sqrt(dx * dx + dy * dy + dz * dz);
        
        if (distance3D < 0.1) return; // Avoid division by zero
        
        // Normalized direction vector
        const nx = dx / distance3D;
        const ny = dy / distance3D;
        const nz = dz / distance3D;
        
        let forceStrength = 0;
        
        if (distance3D < this.repulsionDistance) {
            // Repulsion force (closer = stronger repulsion)
            forceStrength = -this.repulsionStrength * (1 / (distance3D + 1));
        } else if (distance3D < this.attractionDistance) {
            // Attraction force (moderate distance = attraction)
            forceStrength = this.attractionStrength * (node1.size + node2.size) * 0.1 / distance3D;
        }
        
        // Apply force to both nodes
        node1.vx += nx * forceStrength;
        node1.vy += ny * forceStrength;
        node1.vz += nz * forceStrength;
        
        node2.vx -= nx * forceStrength;
        node2.vy -= ny * forceStrength;
        node2.vz -= nz * forceStrength;
    }

    updateNodesWithAudio() {
        // Detect significant audio peaks for size divergence
        const totalAudioEnergy = (this.bassInfluence || 0) + (this.midInfluence || 0) + (this.trebleInfluence || 0);
        const isAudioPeak = totalAudioEnergy > 0.7 || (this.beatIntensity || 0) > 0.3;
        
        // Audio-reactive effects on rotation and appearance
        for (const node of this.nodes) {
            if (this.bassInfluence > 0) {
                // Bass affects rotation speed and size
                const bassImpact = this.bassInfluence * 0.03;
                node.angularVelocityX += bassImpact * (Math.random() - 0.5);
                node.angularVelocityY += bassImpact * (Math.random() - 0.5);
                node.size += this.bassInfluence * 0.5; // Bass makes cubes grow
            }
            
            if (this.trebleInfluence > 0) {
                // Treble affects Z movement, rotation speed, and grayscale
                node.vz += (this.trebleInfluence - 0.5) * 0.3;
                node.grayscale = Math.max(0, Math.min(1, node.baseGrayscale + this.trebleInfluence * 0.4));
                
                // Treble adds rapid spin
                const trebleImpact = this.trebleInfluence * 0.05;
                node.angularVelocityZ += trebleImpact * (Math.random() - 0.5);
            }
            
            if (this.midInfluence > 0) {
                // Mid frequencies affect overall rotation and stability
                const midImpact = this.midInfluence * 0.02;
                node.angularVelocityX += midImpact * Math.sin(this.getElapsedTime() * 0.01 + node.id);
                node.angularVelocityY += midImpact * Math.cos(this.getElapsedTime() * 0.01 + node.id);
                node.angularVelocityZ += (this.midInfluence - 0.5) * 0.025;
            }
            
            // Beat intensity affects size pulsing
            if (this.beatIntensity > 0.1) {
                node.size += this.beatIntensity * 2;
            }
            
            // AUDIO PEAK SIZE DIVERGENCE - dramatic size changes on peaks
            if (isAudioPeak) {
                // Use node ID and audio energy to create deterministic but varied effects
                const nodeRandomSeed = (node.id * 0.618034) % 1; // Golden ratio for better distribution
                const peakIntensity = totalAudioEnergy + (this.beatIntensity || 0);
                
                if (nodeRandomSeed < 0.2) {
                    // 20% of cubes grow dramatically large on peaks
                    node.size += peakIntensity * 15 * (nodeRandomSeed + 0.5);
                } else if (nodeRandomSeed < 0.4) {
                    // 20% of cubes shrink on peaks (creating contrast)
                    node.size *= 0.7 - peakIntensity * 0.3;
                } else if (nodeRandomSeed < 0.6) {
                    // 20% get moderate growth
                    node.size += peakIntensity * 8 * nodeRandomSeed;
                }
                // 40% remain relatively unchanged for visual balance
                
                // Add some rotation chaos during peaks
                if (nodeRandomSeed > 0.8) {
                    node.angularVelocityX += (Math.random() - 0.5) * peakIntensity * 0.1;
                    node.angularVelocityY += (Math.random() - 0.5) * peakIntensity * 0.1;
                    node.angularVelocityZ += (Math.random() - 0.5) * peakIntensity * 0.1;
                }
            }
        }
    }

    processNodeInteractions(density) {
        // 3D growth interactions - nodes grow when close in 3D space
        const growthRate = 0.05 * (1 + (this.midInfluence || 0) * 2) * density;
        const maxGrowthDistance = 25; // 3D distance for growth interactions
        
        for (let i = 0; i < this.nodes.length; i++) {
            for (let j = i + 1; j < this.nodes.length; j++) {
                const node1 = this.nodes[i];
                const node2 = this.nodes[j];
                
                // Use 3D distance for growth interactions
                const dist3D = node1.getDistance3D(node2);
                
                if (dist3D < maxGrowthDistance) {
                    // Size exchange based on 3D proximity
                    const growthAmount = growthRate / Math.max(dist3D * 0.1, 0.1);
                    node1.size += growthAmount * node2.size * 0.01;
                    node2.size += growthAmount * node1.size * 0.01;
                    
                    // 3D rotation influence for Wire-specific effect
                    const rotationInfluence = 0.05 / Math.max(dist3D * 0.1, 1);
                    node1.angularVelocityX += (node2.angularVelocityX - node1.angularVelocityX) * rotationInfluence;
                    node1.angularVelocityY += (node2.angularVelocityY - node1.angularVelocityY) * rotationInfluence;
                    node1.angularVelocityZ += (node2.angularVelocityZ - node1.angularVelocityZ) * rotationInfluence;
                    
                    node2.angularVelocityX += (node1.angularVelocityX - node2.angularVelocityX) * rotationInfluence;
                    node2.angularVelocityY += (node1.angularVelocityY - node2.angularVelocityY) * rotationInfluence;
                    node2.angularVelocityZ += (node1.angularVelocityZ - node2.angularVelocityZ) * rotationInfluence;
                }
            }
        }
    }

    renderCubes(sortedNodes, alpha) {
        for (const node of sortedNodes) {
            this.renderCube(node, alpha);
        }
    }

    renderCube(node, alpha) {
        const apparentPos = node.getApparentPosition();
        const apparentSize = node.getApparentSize();
        
        if (apparentSize < 0.1) return; // Only skip extremely tiny cubes
        
        const centerX = apparentPos.x;
        const centerY = apparentPos.y;
        const scale = apparentPos.scale;
        
        // Calculate cube dimensions with audio-reactive sizing
        const audioSizeMultiplier = 1 + (this.beatIntensity || 0) * 0.5;
        const cubeSize = apparentSize * 3 * audioSizeMultiplier; // Increased multiplier for more size variation
        
        // Calculate grayscale color with audio influence
        let grayscale = Math.max(0, Math.min(1, node.grayscale));
        const colorValue = Math.floor(grayscale * 255);
        
        // Render shadow first (underneath) - rotated with cube
        this.renderCubeShadow(centerX, centerY, cubeSize, alpha, node);
        
        // Render anaglyph effect (3D red/cyan)
        this.renderCubeWithAnaglyph(centerX, centerY, cubeSize, colorValue, alpha, node);
    }

    renderCubeShadow(centerX, centerY, cubeSize, alpha, node) {
        const shadowX = centerX + this.shadowOffset;
        const shadowY = centerY + this.shadowOffset;
        
        this.context.save();
        this.context.globalAlpha = alpha * 0.2;
        this.context.fillStyle = '#111';
        
        // Render shadow as a rotated cube shape
        this.render3DCubeGeometry(shadowX, shadowY, cubeSize, node, 50, 50, 50, alpha * 0.2);
        
        this.context.restore();
    }

    renderCubeWithAnaglyph(centerX, centerY, cubeSize, colorValue, alpha, node) {
        // Calculate perspective-correct anaglyph offset
        // Closer objects (lower Z) should have more separation, farther objects (higher Z) less
        const perspectiveScale = 300 / (300 + node.z); // Same perspective calculation as position
        const offset = this.anaglyphOffset * perspectiveScale * 2; // 2x multiplier for more dramatic effect
        
        this.context.save();
        
        // Calculate depth-based anaglyph intensity
        // Closer objects have stronger anaglyph effect, farther objects weaker
        const anaglyphIntensity = 0.6 + (perspectiveScale * 0.4); // 0.6 to 1.0 range
        
        // Clear the area first to ensure proper blending
        this.context.globalCompositeOperation = 'source-over';
        
        // Render red channel (left eye) - shifted left
        this.context.globalAlpha = alpha * anaglyphIntensity;
        this.render3DCubeGeometry(centerX - offset, centerY, cubeSize, node, colorValue, 0, 0, alpha);
        
        // Render cyan channel (right eye) - shifted right, using additive blending
        this.context.globalCompositeOperation = 'lighter'; // Additive blending for proper anaglyph
        this.context.globalAlpha = alpha * anaglyphIntensity;
        this.render3DCubeGeometry(centerX + offset, centerY, cubeSize, node, 0, colorValue * 0.8, colorValue * 0.8, alpha);
        
        this.context.restore();
    }


    render3DCubeGeometry(centerX, centerY, cubeSize, node, r, g, b, alpha) {
        const halfSize = cubeSize / 2;
        
        // Apply rotations to cube vertices
        const cos_x = Math.cos(node.rotationX);
        const sin_x = Math.sin(node.rotationX);
        const cos_y = Math.cos(node.rotationY);
        const sin_y = Math.sin(node.rotationY);
        const cos_z = Math.cos(node.rotationZ);
        const sin_z = Math.sin(node.rotationZ);
        
        // Define cube vertices in 3D space
        const vertices = [
            [-halfSize, -halfSize, -halfSize], // 0: front-bottom-left
            [halfSize, -halfSize, -halfSize],  // 1: front-bottom-right
            [halfSize, halfSize, -halfSize],   // 2: front-top-right
            [-halfSize, halfSize, -halfSize],  // 3: front-top-left
            [-halfSize, -halfSize, halfSize],  // 4: back-bottom-left
            [halfSize, -halfSize, halfSize],   // 5: back-bottom-right
            [halfSize, halfSize, halfSize],    // 6: back-top-right
            [-halfSize, halfSize, halfSize]    // 7: back-top-left
        ];
        
        // Rotate and project vertices to 2D
        const projected = vertices.map(([x, y, z]) => {
            // Rotate around X axis
            let y1 = y * cos_x - z * sin_x;
            let z1 = y * sin_x + z * cos_x;
            
            // Rotate around Y axis
            let x2 = x * cos_y + z1 * sin_y;
            let z2 = -x * sin_y + z1 * cos_y;
            
            // Rotate around Z axis
            let x3 = x2 * cos_z - y1 * sin_z;
            let y3 = x2 * sin_z + y1 * cos_z;
            
            // Project to 2D (simple orthographic projection)
            return [centerX + x3, centerY + y3, z2];
        });
        
        // Define cube faces (vertices in clockwise order for proper face culling)
        const faces = [
            [0, 1, 2, 3], // front face
            [5, 4, 7, 6], // back face
            [4, 0, 3, 7], // left face
            [1, 5, 6, 2], // right face
            [3, 2, 6, 7], // top face
            [4, 5, 1, 0]  // bottom face
        ];
        
        // Calculate face normals and brightness
        const faceBrightness = [1.0, 0.4, 0.7, 0.6, 1.2, 0.3]; // front, back, left, right, top, bottom
        
        // Sort faces by average Z depth (painter's algorithm)
        const faceDepths = faces.map((face, i) => {
            const avgZ = face.reduce((sum, vertexIndex) => sum + projected[vertexIndex][2], 0) / face.length;
            return { face, brightness: faceBrightness[i], depth: avgZ, index: i };
        });
        
        faceDepths.sort((a, b) => a.depth - b.depth); // Back to front
        
        // Render faces
        for (const { face, brightness } of faceDepths) {
            const faceR = Math.min(255, Math.max(0, Math.floor(r * brightness)));
            const faceG = Math.min(255, Math.max(0, Math.floor(g * brightness)));
            const faceB = Math.min(255, Math.max(0, Math.floor(b * brightness)));
            
            this.context.fillStyle = `rgba(${faceR}, ${faceG}, ${faceB}, ${alpha})`;
            this.context.beginPath();
            
            // Draw face
            const [startX, startY] = projected[face[0]];
            this.context.moveTo(startX, startY);
            
            for (let i = 1; i < face.length; i++) {
                const [x, y] = projected[face[i]];
                this.context.lineTo(x, y);
            }
            
            this.context.closePath();
            this.context.fill();
            
            // Add subtle edge lines for definition
            this.context.strokeStyle = `rgba(${Math.floor(r * 0.8)}, ${Math.floor(g * 0.8)}, ${Math.floor(b * 0.8)}, ${alpha * 0.3})`;
            this.context.lineWidth = 0.5;
            this.context.stroke();
        }
    }

    handleSizeDivergence() {
        const currentTime = Date.now();
        
        // Calculate current audio energy
        const totalAudioEnergy = (this.bassInfluence || 0) + (this.midInfluence || 0) + (this.trebleInfluence || 0);
        
        // Maintain a rolling history of audio energy
        this.audioEnergyHistory.push(totalAudioEnergy);
        if (this.audioEnergyHistory.length > 30) { // Keep last 30 frames (~0.5 seconds at 60fps)
            this.audioEnergyHistory.shift();
        }
        
        // Check if enough time has passed since last divergence
        if (currentTime - this.lastDivergenceTime < this.divergenceInterval) {
            return;
        }
        
        // Calculate average audio energy over recent history
        const avgAudioEnergy = this.audioEnergyHistory.reduce((sum, energy) => sum + energy, 0) / this.audioEnergyHistory.length;
        
        // Trigger divergence if audio energy is above threshold or if sizes have converged too much
        const shouldDiverge = avgAudioEnergy > this.audioEnergyThreshold || this.shouldForceDivergence();
        
        if (shouldDiverge) {
            this.performSizeDivergence(avgAudioEnergy);
            this.lastDivergenceTime = currentTime;
        }
    }

    shouldForceDivergence() {
        // Check if sizes have converged too much (all nodes are too similar in size)
        const sizes = this.nodes.map(node => node.size);
        const minSize = Math.min(...sizes);
        const maxSize = Math.max(...sizes);
        const sizeRange = maxSize - minSize;
        const avgSize = sizes.reduce((sum, size) => sum + size, 0) / sizes.length;
        
        // If the range is less than 30% of the average size, force divergence
        return sizeRange < (avgSize * 0.3);
    }

    performSizeDivergence(audioEnergy) {
        // Apply size divergence to prevent convergence
        const divergenceStrength = 0.5 + audioEnergy * 1.5; // Audio affects divergence strength
        
        for (const node of this.nodes) {
            // Use deterministic random based on node ID for consistent behavior
            const nodeRandom = (node.id * 0.618034) % 1;
            
            if (nodeRandom < 0.25) {
                // 25% of nodes get larger
                const growthFactor = 1.2 + (divergenceStrength * nodeRandom * 2);
                node.size *= growthFactor;
            } else if (nodeRandom < 0.5) {
                // 25% of nodes get smaller
                const shrinkFactor = 0.7 - (divergenceStrength * nodeRandom * 0.3);
                node.size *= Math.max(0.3, shrinkFactor);
            } else if (nodeRandom < 0.75) {
                // 25% get dramatic size changes based on audio
                if (audioEnergy > 0.6) {
                    node.size += divergenceStrength * 10 * nodeRandom;
                } else {
                    node.size *= 0.8 + nodeRandom * 0.4; // Moderate variation
                }
            }
            // 25% remain unchanged for stability
            
            // Ensure sizes stay within reasonable bounds
            node.size = Math.max(1, Math.min(100, node.size));
        }
        
        // console.log(`Size divergence triggered! Audio energy: ${audioEnergy.toFixed(2)}`);
    }

    // Override the parent draw method
    animate() {
        this.rafId = requestAnimationFrame(() => this.animate());
        this.counter++;
        this.draw();
    }
}