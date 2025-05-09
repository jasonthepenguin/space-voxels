import * as THREE from 'three';
import { isKeyPressed } from './desktopControls.js';
import { audioSystem } from './weapons.js';

// Ship movement parameters
export const SHIP_SPEED = 15; // Constant forward speed
export const SHIP_BOOST_MULTIPLIER = 3; // 20% speed boost
export const SHIP_TURN_SPEED = 1.5; // How quickly the ship rotates
export const SHIP_PITCH_SPEED = 1.0; // How quickly the ship pitches up/down
export const SHIP_ROLL_SPEED = 1.2; // How quickly the ship rolls


// Boundary checks
// Playable boundary
const BOUNDARY_MIN_X = -240;
const BOUNDARY_MAX_X = 240;
const BOUNDARY_MIN_Y = -240;
const BOUNDARY_MAX_Y = 240;
const BOUNDARY_MIN_Z = -240;
const BOUNDARY_MAX_Z = 240;

// *** NEW: Track previous boost state ***
let wasBoostingLastFrame = false;

// Create player function
export function createPlayer(scene, shipType = 'default', initialPosition = null) {
    // Create a group to hold all spaceship parts
    const player = new THREE.Group();
    
    // Use initial position if provided, otherwise default
    if (initialPosition) {
        player.position.set(initialPosition.x, initialPosition.y, initialPosition.z);
    } else {
        player.position.set(0, 20, 70); // Fallback default position
    }
    
    player.rotation.order = 'YXZ'; // Set rotation order to match camera
    
    // Store the ship type on the player object for reference
    player.userData.shipType = shipType;
    
    // *** NEW: Common thruster material ***
    const thrusterMaterial = new THREE.MeshBasicMaterial({
        color: 0x00aaff, // Bright blue
        transparent: true,
        opacity: 0.7,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    player.userData.thrusterMaterial = thrusterMaterial; // Store for potential dynamic changes

    // Create the selected ship type
    switch(shipType) {
        case 'Flowers Ship':
            createFlowersShip(player);
            break;
        case 'Angel Ship':
            createAngelShip(player);
            break;
        case 'Chris Ship':
            createChrisShip(player);
            break;
        case 'default':
        default:
            createDefaultShip(player);
            break;
    }
    
    scene.add(player);
    return player;
}

// Default ship (blue)
function createDefaultShip(player) {
    // Materials
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x3366cc });
    const wingMaterial = new THREE.MeshStandardMaterial({ color: 0x888888 });
    const accentMaterial = new THREE.MeshStandardMaterial({ color: 0xff3333 });
    const cockpitMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x66ccff, 
        transparent: true, 
        opacity: 0.7 
    });
    
    // Main body - slightly elongated
    const bodyGeometry = new THREE.BoxGeometry(2, 1, 4);
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    player.add(body);
    
    // Cockpit - on top front
    const cockpitGeometry = new THREE.BoxGeometry(1, 0.7, 1.2);
    const cockpit = new THREE.Mesh(cockpitGeometry, cockpitMaterial);
    cockpit.position.set(0, 0.8, -0.8);
    player.add(cockpit);
    
    // Wings - on sides
    const wingGeometry = new THREE.BoxGeometry(4, 0.3, 2);
    
    // Left wing
    const leftWing = new THREE.Mesh(wingGeometry, wingMaterial);
    leftWing.position.set(-2, -0.2, 0);
    player.add(leftWing);
    
    // Right wing
    const rightWing = new THREE.Mesh(wingGeometry, wingMaterial);
    rightWing.position.set(2, -0.2, 0);
    player.add(rightWing);
    
    // Engine blocks - at the back
    const engineGeometry = new THREE.BoxGeometry(0.8, 0.8, 0.8);
    
    // Left engine
    const leftEngine = new THREE.Mesh(engineGeometry, accentMaterial);
    leftEngine.position.set(-0.8, -0.1, 1.8);
    player.add(leftEngine);
    
    // Right engine
    const rightEngine = new THREE.Mesh(engineGeometry, accentMaterial);
    rightEngine.position.set(0.8, -0.1, 1.8);
    player.add(rightEngine);
    
    // *** NEW: Thruster effect for Default Ship ***
    const thrusterGeometry = new THREE.ConeGeometry(0.4, 2.5, 8); // Radius, height, segments
    const thruster = new THREE.Mesh(thrusterGeometry, player.userData.thrusterMaterial);
    thruster.position.set(0, -0.1, 2.8); // Positioned behind the engines
    thruster.rotation.x = Math.PI / 2; // Point cone backwards
    thruster.visible = false;
    player.add(thruster);
    player.userData.thruster = thruster;

    // Forward gun/cannon - CONSISTENT ACROSS ALL SHIPS
    const gunGeometry = new THREE.BoxGeometry(0.4, 0.4, 1.5);
    const gun = new THREE.Mesh(gunGeometry, accentMaterial);
    gun.position.set(0, 0, -2.5);
    player.add(gun);
}

// Flowers Ship (bird-like with L-shaped wings and starship tail - now with light black and yellow colors)
function createFlowersShip(player) {
    // Updated Materials with new color scheme
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x333333 }); // Light black (dark gray) body
    const wingMaterial = new THREE.MeshStandardMaterial({ color: 0xffcc00 }); // Yellow wings
    const accentMaterial = new THREE.MeshStandardMaterial({ color: 0xcccccc }); // Silver accent (changed from orange)
    const engineMaterial = new THREE.MeshStandardMaterial({ color: 0x666666 }); // Darker gray engines
    const cockpitMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x444444, 
        transparent: true, 
        opacity: 0.7 
    });
    
    // Main body - sharper, more angular bird-shaped body
    const bodyGeometry = new THREE.BoxGeometry(1.8, 1.6, 4);
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    player.add(body);
    
    // Cockpit - more angular, positioned like a bird's head
    const cockpitGeometry = new THREE.BoxGeometry(1.2, 1.0, 1.4);
    const cockpit = new THREE.Mesh(cockpitGeometry, cockpitMaterial);
    cockpit.position.set(0, 0.9, -1.8);
    player.add(cockpit);
    
    // Beak - sharper, more pointed front
    const beakGeometry = new THREE.BoxGeometry(0.5, 0.4, 1.4);
    const beak = new THREE.Mesh(beakGeometry, accentMaterial);
    beak.position.set(0, 0.7, -3.0);
    player.add(beak);
    
    // Wings - L-shaped design with forward and backward sections
    // Left wing - forward section
    const leftWingGeometry = new THREE.BoxGeometry(4.5, 0.3, 1.8);
    const leftWing = new THREE.Mesh(leftWingGeometry, wingMaterial);
    leftWing.position.set(-2.5, 0.3, -0.2);
    // Angle the wing slightly upward and backward
    leftWing.rotation.z = Math.PI / 10;
    leftWing.rotation.y = -Math.PI / 15;
    player.add(leftWing);
    
    // Left wing - backward L-section
    const leftWingBackGeometry = new THREE.BoxGeometry(1.2, 0.3, 3.5);
    const leftWingBack = new THREE.Mesh(leftWingBackGeometry, wingMaterial);
    leftWingBack.position.set(-4.2, 0.4, 1.0);
    // Angle the wing section
    leftWingBack.rotation.z = Math.PI / 10;
    player.add(leftWingBack);
    
    // Right wing - forward section
    const rightWingGeometry = new THREE.BoxGeometry(4.5, 0.3, 1.8);
    const rightWing = new THREE.Mesh(rightWingGeometry, wingMaterial);
    rightWing.position.set(2.5, 0.3, -0.2);
    // Angle the wing slightly upward and backward
    rightWing.rotation.z = -Math.PI / 10;
    rightWing.rotation.y = Math.PI / 15;
    player.add(rightWing);
    
    // Right wing - backward L-section
    const rightWingBackGeometry = new THREE.BoxGeometry(1.2, 0.3, 3.5);
    const rightWingBack = new THREE.Mesh(rightWingBackGeometry, wingMaterial);
    rightWingBack.position.set(4.2, 0.4, 1.0);
    // Angle the wing section
    rightWingBack.rotation.z = -Math.PI / 10;
    player.add(rightWingBack);
    
    // Wing tips - sharper, more angular
    const leftWingTipGeometry = new THREE.BoxGeometry(1.8, 0.25, 1.0);
    const leftWingTip = new THREE.Mesh(leftWingTipGeometry, wingMaterial);
    leftWingTip.position.set(-4.8, 0.5, -0.8);
    leftWingTip.rotation.z = Math.PI / 8;
    leftWingTip.rotation.y = Math.PI / 12; // Angle forward slightly
    player.add(leftWingTip);
    
    const rightWingTipGeometry = new THREE.BoxGeometry(1.8, 0.25, 1.0);
    const rightWingTip = new THREE.Mesh(rightWingTipGeometry, wingMaterial);
    rightWingTip.position.set(4.8, 0.5, -0.8);
    rightWingTip.rotation.z = -Math.PI / 8;
    rightWingTip.rotation.y = -Math.PI / 12; // Angle forward slightly
    player.add(rightWingTip);
    
    // Body accent pieces - to make it sharper
    const upperAccentGeometry = new THREE.BoxGeometry(0.8, 0.4, 2.5);
    const upperAccent = new THREE.Mesh(upperAccentGeometry, accentMaterial);
    upperAccent.position.set(0, 1.0, 0);
    player.add(upperAccent);
    
    // STARSHIP-LIKE TAIL SECTION
    
    // Main tail fin - vertical stabilizer
    const verticalFinGeometry = new THREE.BoxGeometry(0.3, 1.8, 1.5);
    const verticalFin = new THREE.Mesh(verticalFinGeometry, bodyMaterial);
    verticalFin.position.set(0, 1.0, 2.5);
    player.add(verticalFin);
    
    // Horizontal stabilizers - like a starship
    const leftStabilizerGeometry = new THREE.BoxGeometry(1.6, 0.3, 1.2);
    const leftStabilizer = new THREE.Mesh(leftStabilizerGeometry, wingMaterial);
    leftStabilizer.position.set(-0.9, 0.2, 2.5);
    // Angle slightly for style
    leftStabilizer.rotation.z = Math.PI / 15;
    player.add(leftStabilizer);
    
    const rightStabilizerGeometry = new THREE.BoxGeometry(1.6, 0.3, 1.2);
    const rightStabilizer = new THREE.Mesh(rightStabilizerGeometry, wingMaterial);
    rightStabilizer.position.set(0.9, 0.2, 2.5);
    // Angle slightly for style
    rightStabilizer.rotation.z = -Math.PI / 15;
    player.add(rightStabilizer);
    
    // Engine section - more mechanical looking
    const engineBaseGeometry = new THREE.BoxGeometry(1.6, 0.8, 0.8);
    const engineBase = new THREE.Mesh(engineBaseGeometry, bodyMaterial);
    engineBase.position.set(0, 0, 2.8);
    player.add(engineBase);
    
    // Engine nozzles - three of them for a starship look
    const engineNozzleGeometry = new THREE.BoxGeometry(0.4, 0.4, 0.6);
    
    // Left engine nozzle
    const leftNozzle = new THREE.Mesh(engineNozzleGeometry, engineMaterial);
    leftNozzle.position.set(-0.5, 0, 3.4);
    player.add(leftNozzle);
    
    // Center engine nozzle
    const centerNozzle = new THREE.Mesh(engineNozzleGeometry, engineMaterial);
    centerNozzle.position.set(0, 0, 3.4);
    player.add(centerNozzle);
    
    // Right engine nozzle
    const rightNozzle = new THREE.Mesh(engineNozzleGeometry, engineMaterial);
    rightNozzle.position.set(0.5, 0, 3.4);
    player.add(rightNozzle);
    
    // Add some engine glow/exhaust effect
    const exhaustGeometry = new THREE.BoxGeometry(0.2, 0.2, 0.3);
    const exhaustMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xffaa00, 
        emissive: 0xffaa00,
        emissiveIntensity: 1
    });
    
    // Add exhaust to each engine
    for (let i = -1; i <= 1; i++) {
        const exhaust = new THREE.Mesh(exhaustGeometry, exhaustMaterial);
        exhaust.position.set(i * 0.5, 0, 3.7);
        player.add(exhaust);
    }
    
    // Add some engine details to the back of the L-shaped wings
    const leftEngineGeometry = new THREE.BoxGeometry(0.6, 0.6, 0.6);
    const leftEngine = new THREE.Mesh(leftEngineGeometry, engineMaterial);
    leftEngine.position.set(-4.2, 0.4, 2.5);
    player.add(leftEngine);
    
    const rightEngineGeometry = new THREE.BoxGeometry(0.6, 0.6, 0.6);
    const rightEngine = new THREE.Mesh(rightEngineGeometry, engineMaterial);
    rightEngine.position.set(4.2, 0.4, 2.5);
    player.add(rightEngine);
    
    // *** NEW: Thruster effect for Flowers Ship ***
    // Central thruster behind body
    const thrusterGeometry = new THREE.ConeGeometry(0.3, 2.0, 8);
    const centerThruster = new THREE.Mesh(thrusterGeometry, player.userData.thrusterMaterial);
    centerThruster.position.set(0, 0, 4.0); // Behind the central engine nozzles
    centerThruster.rotation.x = Math.PI / 2;
    centerThruster.visible = false;
    player.add(centerThruster);
    player.userData.thruster = centerThruster; // Main thruster reference

    // Forward gun/cannon - CONSISTENT ACROSS ALL SHIPS
    const gunGeometry = new THREE.BoxGeometry(0.4, 0.4, 1.5);
    const gun = new THREE.Mesh(gunGeometry, accentMaterial);
    gun.position.set(0, 0, -2.5);
    player.add(gun);
}

// Angel Ship (Redesigned for a sleeker look)
function createAngelShip(player) {
    // Materials
    const bodyMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xf5f5f5,
        metalness: 0.3, 
        roughness: 0.5 
    }); 
    const wingMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xffffff,
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide 
    });
    const accentMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xffe799,
        metalness: 0.9,
        roughness: 0.2 
    }); 
    const cockpitMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xaaddff,
        transparent: true, 
        opacity: 0.4,
        metalness: 0.2,
        roughness: 0.1
    });

    // Main body
    const bodyGeometry = new THREE.BoxGeometry(1.2, 0.6, 5.2);
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = -0.1;
    player.add(body);

    // Cockpit
    const cockpitGeometry = new THREE.BoxGeometry(1.1, 0.5, 1.4); 
    const cockpit = new THREE.Mesh(cockpitGeometry, cockpitMaterial);
    cockpit.position.set(0, 0.45, -1.6);
    player.add(cockpit);

    // *** New: Sharper nose section ***
    const noseGeometry = new THREE.BoxGeometry(0.6, 0.3, 1.2);
    const nose = new THREE.Mesh(noseGeometry, bodyMaterial);
    nose.position.set(0, 0.2, -2.4);
    player.add(nose);

    const noseTipGeometry = new THREE.BoxGeometry(0.3, 0.2, 0.6);
    const noseTip = new THREE.Mesh(noseTipGeometry, accentMaterial);
    noseTip.position.set(0, 0.1, -2.9);
    player.add(noseTip);

    // Wings
    const wingSegmentHeight = 0.06;
    const wingBaseWidth = 3.8;
    const wingTipWidth = 1.2;
    const wingLength = 2.2;
    const wingSweepAngleBase = Math.PI / 5;

    const createWingSegment = (xOffset, yOffset, zOffset, width, length, angleY, angleZ, material) => {
        const geom = new THREE.BoxGeometry(width, wingSegmentHeight, length);
        const mesh = new THREE.Mesh(geom, material);
        mesh.position.set(xOffset, yOffset, zOffset);
        mesh.rotation.y = angleY;
        mesh.rotation.z = angleZ;
        return mesh;
    };

    const leftWingGroup = new THREE.Group();
    leftWingGroup.position.set(-0.7, 0, 0);
    leftWingGroup.add(createWingSegment(-1.8, 0.15, 0, 3.8, 2.2, wingSweepAngleBase, Math.PI / 14, wingMaterial));
    leftWingGroup.add(createWingSegment(-2.4, 0.0, 0.6, 2.8, 2.4, wingSweepAngleBase * 1.2, Math.PI / 18, wingMaterial));
    leftWingGroup.add(createWingSegment(-3.0, -0.15, 1.2, 1.2, 2.0, wingSweepAngleBase * 1.4, Math.PI / 24, wingMaterial));
    player.add(leftWingGroup);

    const rightWingGroup = new THREE.Group();
    rightWingGroup.position.set(0.7, 0, 0);
    rightWingGroup.add(createWingSegment(1.8, 0.15, 0, 3.8, 2.2, -wingSweepAngleBase, -Math.PI / 14, wingMaterial));
    rightWingGroup.add(createWingSegment(2.4, 0.0, 0.6, 2.8, 2.4, -wingSweepAngleBase * 1.2, -Math.PI / 18, wingMaterial));
    rightWingGroup.add(createWingSegment(3.0, -0.15, 1.2, 1.2, 2.0, -wingSweepAngleBase * 1.4, -Math.PI / 24, wingMaterial));
    player.add(rightWingGroup);

    // Halo
    const haloGeometry = new THREE.TorusGeometry(0.9, 0.06, 16, 100);
    const halo = new THREE.Mesh(haloGeometry, accentMaterial);
    halo.position.set(0, 1.1, -2.0);
    halo.rotation.x = Math.PI / 5;
    player.add(halo);

    // Tail
    const tailFinGeometry = new THREE.BoxGeometry(0.15, 1.6, 1.6);
    const tailFin = new THREE.Mesh(tailFinGeometry, bodyMaterial);
    tailFin.position.set(0, 0.5, 2.6);
    tailFin.rotation.x = -Math.PI / 18;
    player.add(tailFin);

    const hStabGeom = new THREE.BoxGeometry(1.6, 0.1, 0.5);
    const leftStab = new THREE.Mesh(hStabGeom, accentMaterial);
    leftStab.position.set(-0.8, 0, 2.4);
    leftStab.rotation.y = -Math.PI / 14;
    player.add(leftStab);

    const rightStab = new THREE.Mesh(hStabGeom, accentMaterial);
    rightStab.position.set(0.8, 0, 2.4);
    rightStab.rotation.y = Math.PI / 14;
    player.add(rightStab);

    // Engine glow
    const exhaustGeometry = new THREE.BoxGeometry(0.2, 0.2, 0.3);
    const exhaustMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xffddaa, 
        emissive: 0xffddaa,
        emissiveIntensity: 1.2
    });
    const exhaust = new THREE.Mesh(exhaustGeometry, exhaustMaterial);
    exhaust.position.set(0, -0.2, 3.0);
    player.add(exhaust);

    // *** NEW: Thruster effect for Angel Ship ***
    const thrusterGeometry = new THREE.ConeGeometry(0.35, 2.8, 8);
    const thruster = new THREE.Mesh(thrusterGeometry, player.userData.thrusterMaterial);
    thruster.position.set(0, -0.2, 3.5); // Behind the exhaust glow
    thruster.rotation.x = Math.PI / 2;
    thruster.visible = false;
    player.add(thruster);
    player.userData.thruster = thruster;

    // Forward gun (unchanged)
    const gunGeometry = new THREE.BoxGeometry(0.3, 0.3, 1.8);
    const gun = new THREE.Mesh(gunGeometry, accentMaterial);
    gun.position.set(0, 0, -2.5);
    player.add(gun);
}

// Chris Ship (Star Wars X-Wing Inspired Design)
function createChrisShip(player) {
    // Materials - Inspired by X-Wing colors
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0xcccccc }); // Light gray body
    const wingMaterial = new THREE.MeshStandardMaterial({ color: 0xaaaaaa }); // Slightly darker gray for wings
    const stripeMaterial = new THREE.MeshStandardMaterial({ color: 0xcc3333 }); // Red stripe accent
    const engineMaterial = new THREE.MeshStandardMaterial({ color: 0x555555 }); // Dark gray engines
    const cockpitMaterial = new THREE.MeshStandardMaterial({
        color: 0x333333, // Dark, slightly reflective cockpit
        metalness: 0.5,
        roughness: 0.2
    });

    // Main fuselage - Long and narrow
    const fuselageGeometry = new THREE.BoxGeometry(1.2, 1, 6);
    const fuselage = new THREE.Mesh(fuselageGeometry, bodyMaterial);
    fuselage.position.set(0, 0, -0.5); // Shift back slightly
    player.add(fuselage);

    // Nose section - Tapered front
    const noseGeometry = new THREE.BoxGeometry(1, 0.8, 1.5);
    const nose = new THREE.Mesh(noseGeometry, bodyMaterial);
    nose.position.set(0, -0.1, -3.5);
    player.add(nose);

    // Cockpit - Positioned towards the front of the main fuselage
    const cockpitGeometry = new THREE.BoxGeometry(0.8, 0.6, 1.2);
    const cockpit = new THREE.Mesh(cockpitGeometry, cockpitMaterial);
    cockpit.position.set(0, 0.6, -2.2); // Raised and forward
    player.add(cockpit);

    // Astromech droid slot (behind cockpit) - Simple representation
    const droidSocketGeometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    const droidSocket = new THREE.Mesh(droidSocketGeometry, engineMaterial); // Use engine color
    droidSocket.position.set(0, 0.6, -1.2);
    player.add(droidSocket);

    // S-foils (Wings) - Create four wing sections
    const wingWidth = 4;
    const wingDepth = 2.5;
    const wingThickness = 0.2;
    const wingAngle = Math.PI / 18; // Slight angle for X shape

    const wingGeometry = new THREE.BoxGeometry(wingWidth, wingThickness, wingDepth);

    // Top-Left Wing
    const topLeftWing = new THREE.Mesh(wingGeometry, wingMaterial);
    topLeftWing.position.set(-wingWidth / 2 - 0.5, 0.3, 0);
    topLeftWing.rotation.z = wingAngle;
    player.add(topLeftWing);

    // Top-Right Wing
    const topRightWing = new THREE.Mesh(wingGeometry, wingMaterial);
    topRightWing.position.set(wingWidth / 2 + 0.5, 0.3, 0);
    topRightWing.rotation.z = -wingAngle;
    player.add(topRightWing);

    // Bottom-Left Wing
    const bottomLeftWing = new THREE.Mesh(wingGeometry, wingMaterial);
    bottomLeftWing.position.set(-wingWidth / 2 - 0.5, -0.3, 0);
    bottomLeftWing.rotation.z = -wingAngle; // Opposite angle
    player.add(bottomLeftWing);

    // Bottom-Right Wing
    const bottomRightWing = new THREE.Mesh(wingGeometry, wingMaterial);
    bottomRightWing.position.set(wingWidth / 2 + 0.5, -0.3, 0);
    bottomRightWing.rotation.z = wingAngle; // Opposite angle
    player.add(bottomRightWing);

    // Add Red Stripes to wings
    const stripeGeometry = new THREE.BoxGeometry(wingWidth * 0.8, wingThickness + 0.01, wingDepth * 0.2); // Slightly thicker to avoid z-fighting

    const stripeOffsetY = 0; // Position stripe in the middle of the wing depth
    const stripeOffsetX = wingWidth / 2 + 0.5; // Match wing position offset

    // Top-Left Stripe
    const topLeftStripe = new THREE.Mesh(stripeGeometry, stripeMaterial);
    topLeftStripe.position.set(-stripeOffsetX, 0.3, stripeOffsetY);
    topLeftStripe.rotation.z = wingAngle;
    player.add(topLeftStripe);

    // Top-Right Stripe
    const topRightStripe = new THREE.Mesh(stripeGeometry, stripeMaterial);
    topRightStripe.position.set(stripeOffsetX, 0.3, stripeOffsetY);
    topRightStripe.rotation.z = -wingAngle;
    player.add(topRightStripe);

    // Bottom-Left Stripe
    const bottomLeftStripe = new THREE.Mesh(stripeGeometry, stripeMaterial);
    bottomLeftStripe.position.set(-stripeOffsetX, -0.3, stripeOffsetY);
    bottomLeftStripe.rotation.z = -wingAngle;
    player.add(bottomLeftStripe);

    // Bottom-Right Stripe
    const bottomRightStripe = new THREE.Mesh(stripeGeometry, stripeMaterial);
    bottomRightStripe.position.set(stripeOffsetX, -0.3, stripeOffsetY);
    bottomRightStripe.rotation.z = wingAngle;
    player.add(bottomRightStripe);


    // Engines (at the back of the wings)
    const engineRadius = 0.4;
    const engineLength = 1.5;
    const engineGeometry = new THREE.BoxGeometry(engineRadius * 2, engineRadius * 2, engineLength); // Using Box for consistency

    const engineOffsetZ = wingDepth / 2 - engineLength / 2 + 0.2; // Position towards back of wing

    // Top-Left Engine
    const topLeftEngine = new THREE.Mesh(engineGeometry, engineMaterial);
    topLeftEngine.position.set(-stripeOffsetX, 0.3, engineOffsetZ);
    topLeftEngine.rotation.z = wingAngle;
    player.add(topLeftEngine);

    // Top-Right Engine
    const topRightEngine = new THREE.Mesh(engineGeometry, engineMaterial);
    topRightEngine.position.set(stripeOffsetX, 0.3, engineOffsetZ);
    topRightEngine.rotation.z = -wingAngle;
    player.add(topRightEngine);

    // Bottom-Left Engine
    const bottomLeftEngine = new THREE.Mesh(engineGeometry, engineMaterial);
    bottomLeftEngine.position.set(-stripeOffsetX, -0.3, engineOffsetZ);
    bottomLeftEngine.rotation.z = -wingAngle;
    player.add(bottomLeftEngine);

    // Bottom-Right Engine
    const bottomRightEngine = new THREE.Mesh(engineGeometry, engineMaterial);
    bottomRightEngine.position.set(stripeOffsetX, -0.3, engineOffsetZ);
    bottomRightEngine.rotation.z = wingAngle;
    player.add(bottomRightEngine);

    // *** NEW: Thruster effects for Chris Ship (one for each engine) ***
    const thrusterConeGeometry = new THREE.ConeGeometry(engineRadius * 0.8, 2.0, 6);
    const thrusters = [];

    const createThruster = (x, y, zRot) => {
        const thruster = new THREE.Mesh(thrusterConeGeometry, player.userData.thrusterMaterial);
        thruster.position.set(x, y, engineOffsetZ + engineLength / 2 + 0.5); // Position behind engine
        thruster.rotation.z = zRot;
        thruster.rotation.x = Math.PI / 2; // Point cone backwards
        thruster.visible = false;
        player.add(thruster);
        thrusters.push(thruster);
    };

    createThruster(-stripeOffsetX, 0.3, wingAngle);      // Top-Left
    createThruster(stripeOffsetX, 0.3, -wingAngle);     // Top-Right
    createThruster(-stripeOffsetX, -0.3, -wingAngle);    // Bottom-Left
    createThruster(stripeOffsetX, -0.3, wingAngle);     // Bottom-Right
    
    player.userData.thrusters = thrusters; // Note: plural 'thrusters' for this ship

    // Wingtip Cannons (Simplified as boxes)
    const cannonLength = 1.0;
    const cannonSize = 0.15;
    const cannonGeometry = new THREE.BoxGeometry(cannonSize, cannonSize, cannonLength);

    const cannonOffsetX = wingWidth + 0.5; // Place at the wing tips
    const cannonOffsetZ = -wingDepth / 2 + cannonLength / 2 - 0.1; // Position at front edge of wing

    // Top-Left Cannon
    const topLeftCannon = new THREE.Mesh(cannonGeometry, engineMaterial);
    topLeftCannon.position.set(-cannonOffsetX, 0.3, cannonOffsetZ);
    topLeftCannon.rotation.z = wingAngle;
    player.add(topLeftCannon);

    // Top-Right Cannon
    const topRightCannon = new THREE.Mesh(cannonGeometry, engineMaterial);
    topRightCannon.position.set(cannonOffsetX, 0.3, cannonOffsetZ);
    topRightCannon.rotation.z = -wingAngle;
    player.add(topRightCannon);

    // Bottom-Left Cannon
    const bottomLeftCannon = new THREE.Mesh(cannonGeometry, engineMaterial);
    bottomLeftCannon.position.set(-cannonOffsetX, -0.3, cannonOffsetZ);
    bottomLeftCannon.rotation.z = -wingAngle;
    player.add(bottomLeftCannon);

    // Bottom-Right Cannon
    const bottomRightCannon = new THREE.Mesh(cannonGeometry, engineMaterial);
    bottomRightCannon.position.set(cannonOffsetX, -0.3, cannonOffsetZ);
    bottomRightCannon.rotation.z = wingAngle;
    player.add(bottomRightCannon);

    // Forward gun/cannon - CONSISTENT ACROSS ALL SHIPS (using stripe material for accent)
    const gunGeometry = new THREE.BoxGeometry(0.4, 0.4, 1.5);
    const gun = new THREE.Mesh(gunGeometry, stripeMaterial); // Use red stripe material
    gun.position.set(0, 0, -2.5); // Keep original position
    player.add(gun);
}

// Handle player movement
export function handleMovement(player, delta, updateCameraPosition, controls = null) {
    if (!player) return;
    
    const isKeyPressed = controls && controls.isKeyPressed ? controls.isKeyPressed : null;
    
    const boostActive = (isKeyPressed && (isKeyPressed('ShiftLeft') || isKeyPressed('ShiftRight'))) ||
                        (controls && controls.isBoostActive && controls.isBoostActive());
    
    // *** NEW: Play thruster sound on boost start ***
    if (boostActive && !wasBoostingLastFrame) {
        if (audioSystem && audioSystem.isAudioInitialized) {
            audioSystem.playSound('thruster', { volume: 0.6 }); // Play thruster sound
        }
    }
    
    player.userData.boostActive = boostActive;
    const speedMultiplier = boostActive ? 2.0 : 1.0;
    const currentSpeed = SHIP_SPEED * speedMultiplier;
    
    const forwardDirection = new THREE.Vector3(0, 0, -1).applyQuaternion(player.quaternion);
    player.position.add(forwardDirection.multiplyScalar(currentSpeed * delta));
    
    // Boundary clamping
    player.position.x = Math.max(BOUNDARY_MIN_X, Math.min(BOUNDARY_MAX_X, player.position.x));
    player.position.y = Math.max(BOUNDARY_MIN_Y, Math.min(BOUNDARY_MAX_Y, player.position.y));
    player.position.z = Math.max(BOUNDARY_MIN_Z, Math.min(BOUNDARY_MAX_Z, player.position.z));


    let targetYawChange = 0;
    let targetPitchChange = 0;
    let targetRollChange = 0;
    
    if (controls && controls.isMobile) {
        // Get joystick values
        const joystickValues = controls.getJoystickValues();
        
        // Yaw (left/right turning) based on joystick X
        if (Math.abs(joystickValues.x) > 0.1) {
            targetYawChange = -joystickValues.x * SHIP_TURN_SPEED * delta;
            // Allow continuous rolling when turning
            targetRollChange = -joystickValues.x * SHIP_ROLL_SPEED * delta;
        } else {
            // Return roll to neutral when not turning, but only if within a small range
            const normalizedRoll = ((player.rotation.z % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
            
            if (normalizedRoll > 0.1 && normalizedRoll < Math.PI) {
                // If between 0 and PI, roll clockwise toward 0
                targetRollChange = -SHIP_ROLL_SPEED * delta;
            } else if (normalizedRoll > Math.PI && normalizedRoll < Math.PI * 2 - 0.1) {
                // If between PI and 2*PI, roll counter-clockwise toward 0
                targetRollChange = SHIP_ROLL_SPEED * delta;
            }
        }
        
        // Pitch (up/down) based on joystick Y
        if (Math.abs(joystickValues.y) > 0.1) {
            targetPitchChange = joystickValues.y * SHIP_PITCH_SPEED * delta;
        } else {
            // Auto-level pitch when not pressing up/down, but only if within a small range
            const normalizedPitch = ((player.rotation.x % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
            
            if (normalizedPitch > 0.1 && normalizedPitch < Math.PI) {
                // If between 0 and PI, pitch down toward 0
                targetPitchChange = -SHIP_PITCH_SPEED * delta * 0.5; // Slower auto-leveling
            } else if (normalizedPitch > Math.PI && normalizedPitch < Math.PI * 2 - 0.1) {
                // If between PI and 2*PI, pitch up toward 0
                targetPitchChange = SHIP_PITCH_SPEED * delta * 0.5; // Slower auto-leveling
            }
        }
    } else if (isKeyPressed) {
        // Use isKeyPressed function directly
        if (isKeyPressed('KeyA') || isKeyPressed('ArrowLeft')) {
            targetYawChange = SHIP_TURN_SPEED * delta;
            targetRollChange = SHIP_ROLL_SPEED * delta;
        } else if (isKeyPressed('KeyD') || isKeyPressed('ArrowRight')) {
            targetYawChange = -SHIP_TURN_SPEED * delta;
            targetRollChange = -SHIP_ROLL_SPEED * delta;
        } else {
            const normalizedRoll = ((player.rotation.z % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
            if (normalizedRoll > 0.1 && normalizedRoll < Math.PI) {
                targetRollChange = -SHIP_ROLL_SPEED * delta;
            } else if (normalizedRoll > Math.PI && normalizedRoll < Math.PI * 2 - 0.1) {
                targetRollChange = SHIP_ROLL_SPEED * delta;
            }
        }

        if (isKeyPressed('KeyW') || isKeyPressed('ArrowUp')) {
            targetPitchChange = -SHIP_PITCH_SPEED * delta;
        } else if (isKeyPressed('KeyS') || isKeyPressed('ArrowDown')) {
            targetPitchChange = SHIP_PITCH_SPEED * delta;
        } else {
            const normalizedPitch = ((player.rotation.x % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
            if (normalizedPitch > 0.1 && normalizedPitch < Math.PI) {
                targetPitchChange = -SHIP_PITCH_SPEED * delta * 0.5;
            } else if (normalizedPitch > Math.PI && normalizedPitch < Math.PI * 2 - 0.1) {
                targetPitchChange = SHIP_PITCH_SPEED * delta * 0.5;
            }
        }
    }
    
    player.rotation.y += targetYawChange;
    player.rotation.x += targetPitchChange;
    player.rotation.z += targetRollChange;
    
    // *** NEW: Handle thruster visibility and animation ***
    if (player.userData.thruster) { // For ships with a single thruster
        if (boostActive) {
            player.userData.thruster.visible = true;
            // Simple pulse animation for the thruster
            const pulse = 1 + Math.sin(performance.now() * 0.03) * 0.25; // Faster pulsation
            player.userData.thruster.scale.set(pulse, pulse, 1 + Math.sin(performance.now() * 0.05) * 0.3);
            player.userData.thruster.material.opacity = 0.5 + Math.sin(performance.now() * 0.04) * 0.2;
        } else {
            player.userData.thruster.visible = false;
        }
    } else if (player.userData.thrusters && Array.isArray(player.userData.thrusters)) { // For ships with multiple thrusters (e.g., Chris Ship)
        player.userData.thrusters.forEach(thruster => {
            if (boostActive) {
                thruster.visible = true;
                const pulse = 1 + Math.sin(performance.now() * 0.03 + thruster.id * 0.5) * 0.25; // Offset animation per thruster
                thruster.scale.set(pulse, pulse, 1 + Math.sin(performance.now() * 0.05 + thruster.id * 0.5) * 0.3);
                thruster.material.opacity = 0.5 + Math.sin(performance.now() * 0.04 + thruster.id * 0.5) * 0.2;
            } else {
                thruster.visible = false;
            }
        });
    }
    
    // *** NEW: Update boost state for next frame ***
    wasBoostingLastFrame = boostActive; 
    
    updateCameraPosition();
}

// Update camera position based on player position and rotation
export function updateCameraPosition(player, camera, cameraOffset, mobileControls = null) {
    if (!player) return; // Don't update if player doesn't exist
    
    // Create a base offset that follows the ship's orientation
    // Increased Z from 10 to 15 to move camera further back
    // Increased Y from 3 to 4 to raise camera slightly for better view
    const baseOffset = new THREE.Vector3(0, 4, 15);
    baseOffset.applyQuaternion(player.quaternion);
    
    // Apply additional camera rotation based on mouse movement or touch controls
    if (cameraOffset.angles) {
        // Create a rotation matrix for the additional camera rotation
        const rotationMatrix = new THREE.Matrix4();
        
        // First rotate around Y axis (yaw)
        rotationMatrix.makeRotationY(cameraOffset.angles.yaw);
        
        // Then rotate around X axis (pitch)
        const pitchMatrix = new THREE.Matrix4();
        pitchMatrix.makeRotationX(cameraOffset.angles.pitch);
        rotationMatrix.multiply(pitchMatrix);
        
        // Apply the rotation to the base offset
        baseOffset.applyMatrix4(rotationMatrix);
    }
    
    // Set camera position
    camera.position.copy(player.position).add(baseOffset);
    
    // Instead of looking at the player or far ahead, look at a point slightly above the player
    // Increased Z from -20 to -30 to look further ahead
    const lookOffset = new THREE.Vector3(0, 2, -30);
    lookOffset.applyQuaternion(player.quaternion);
    
    // Apply the same camera rotation to the look target
    if (cameraOffset.angles) {
        const rotationMatrix = new THREE.Matrix4();
        
        rotationMatrix.makeRotationY(cameraOffset.angles.yaw);
        const pitchMatrix = new THREE.Matrix4();
        pitchMatrix.makeRotationX(cameraOffset.angles.pitch);
        rotationMatrix.multiply(pitchMatrix);
        
        lookOffset.applyMatrix4(rotationMatrix);
    }
    
    const lookTarget = player.position.clone().add(lookOffset);
    camera.lookAt(lookTarget);
} 
