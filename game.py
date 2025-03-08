from ursina import *
from ursina.prefabs.first_person_controller import FirstPersonController
import numpy as np
import random

app = Ursina()
window.title = 'Voxel Solar System Explorer'
window.borderless = False
window.fullscreen = False
window.exit_button.visible = True
window.fps_counter.enabled = True
window.size = (1280, 720)  # Set window to standard 1280x720 resolution
window.center_on_screen()  # Center the window on the screen

# Load sound effect for shooting - use a more efficient audio pooling approach
shoot_sound = Audio('shoot.mp3', loop=False, autoplay=False)
shoot_sound_pool = [Audio('shoot.mp3', loop=False, autoplay=False) for _ in range(10)]
shoot_sound_index = 0

# Object pools for frequently created objects
# Laser pool
MAX_LASERS = 20
laser_pool = []
lasers = []  # Active lasers list

# Flash effect pool
MAX_FLASHES = 10
flash_pool = []

# Voxel-based Sun
sun = Entity()
# Use sun.png texture instead of solid color
sun_texture = load_texture('sun.png')

# Dictionary to store sun blocks by position
sun.block_dict = {}

for x in range(-5, 6):
    for y in range(-5, 6):
        for z in range(-5, 6):
            if x**2 + y**2 + z**2 <= 25:
                voxel = Entity(
                    model='cube',
                    collider='box',
                    position=(x, y, z),
                    scale=1,
                    texture=sun_texture,
                    parent=sun
                )
                # Store the voxel in the dictionary with its position as the key
                sun.block_dict[(x, y, z)] = voxel

# Planet data: name, texture, size, orbit_radius, orbit_speed
planet_data = [
    ('Mercury', 'gray.png', 1, 12, 0.04),
    ('Venus', 'yellow.png', 2, 16, 0.015),
    ('Earth', 'mixed', 2, 22, 0.01),  # Special case for Earth
    ('Mars', 'red.png', 1.5, 28, 0.008),
    ('Jupiter', 'jupiter.png', 4, 40, 0.002),  # New jupiter texture
    ('Saturn', 'yellow.png', 3.5, 55, 0.0015),
    ('Uranus', 'light_blue.png', 3, 70, 0.001),
    ('Neptune', 'water.png', 3, 85, 0.0008),
]

planets = []

# Load textures once
textures = {
    'orange.png': load_texture('orange.png'),
    'yellow.png': load_texture('yellow.png'),
    'grass.png': load_texture('grass.png'),
    'water.png': load_texture('water.png'),
    'red.png': load_texture('red.png'),
    'light_blue.png': load_texture('light_blue.png'),
    'jupiter.png': load_texture('jupiter.png'),  # Add the new texture
    'white.png': load_texture('white.png'),  # Add white texture for the moon
    'gray.png': load_texture('gray.png'),  # Add gray texture for Mercury
}

# Create voxel planets with optimized structure
for name, texture_name, size, orbit_radius, orbit_speed in planet_data:
    planet_center = Entity(name=name)
    planet_center.orbit_radius = orbit_radius
    planet_center.orbit_speed = orbit_speed
    planet_center.orbit_angle = np.random.rand() * 360
    
    # Create spatial dictionary for each planet
    planet_center.block_dict = {}
    
    # Calculate voxel range based on planet size
    voxel_range = int(size + 1)
    max_distance = size * size
    
    # Populate planet with voxels
    for x in range(-voxel_range, voxel_range + 1):
        for y in range(-voxel_range, voxel_range + 1):
            for z in range(-voxel_range, voxel_range + 1):
                if x**2 + y**2 + z**2 <= max_distance:
                    # Determine if this is an outer block (exposed to space)
                    is_outer_block = False
                    for dx, dy, dz in [(1,0,0), (-1,0,0), (0,1,0), (0,-1,0), (0,0,1), (0,0,-1)]:
                        nx, ny, nz = x+dx, y+dy, z+dz
                        if nx**2 + ny**2 + nz**2 > max_distance:
                            is_outer_block = True
                            break
                    
                    # Special case for Earth - mix of water and grass
                    if texture_name == 'mixed':
                        # Earth special case
                        if random.random() < 0.7:
                            planet_texture = textures['water.png']
                        else:
                            planet_texture = textures['grass.png']
                    elif name == 'Jupiter':
                        # Jupiter special case - create banded appearance
                        band = (y + voxel_range) % 3
                        if band == 0:
                            planet_texture = textures['orange.png']
                        elif band == 1:
                            planet_texture = textures['yellow.png']
                        else:
                            planet_texture = textures['red.png']
                    elif name == 'Saturn':
                        # Saturn special case - create different banded appearance
                        band = (y + voxel_range) % 2
                        if band == 0:
                            planet_texture = textures['yellow.png']
                        else:
                            planet_texture = textures['orange.png']
                    elif name == 'Venus':
                        # Venus special case - create swirling cloud patterns
                        # Use a combination of position to create interesting patterns
                        pattern_value = (x + y + z) % 4
                        if pattern_value == 0:
                            planet_texture = textures['yellow.png']
                        elif pattern_value == 1:
                            planet_texture = textures['orange.png']
                        elif pattern_value == 2:
                            planet_texture = textures['yellow.png']  # More yellow
                        else:
                            planet_texture = textures['white.png']  # Some white clouds
                    else:
                        planet_texture = textures[texture_name]
                    
                    # Only add collider to outer blocks for optimization
                    voxel = Entity(
                        model='cube',
                        collider='box' if is_outer_block else None,
                        position=(x, y, z),
                        scale=1,
                        texture=planet_texture,
                        parent=planet_center
                    )
                    
                    # Store the voxel in the planet's block dictionary
                    planet_center.block_dict[(x, y, z)] = voxel
    
    planets.append(planet_center)

# Add rings to Saturn
for planet in planets:
    if planet.name == 'Saturn':
        # Create Saturn's rings
        ring_radius = 6  # Adjust based on Saturn's size
        ring_thickness = 0.5
        
        # Create a dictionary to store the ring blocks
        if not hasattr(planet, 'ring_dict'):
            planet.ring_dict = {}
        
        # Create a flat disc of voxels for the rings
        for x in range(-ring_radius, ring_radius + 1):
            for z in range(-ring_radius, ring_radius + 1):
                # Skip the area where Saturn itself is
                distance_from_center = (x**2 + z**2) ** 0.5
                if 4 <= distance_from_center <= ring_radius:  # Inner and outer radius of rings
                    # Create a thin ring
                    ring_voxel = Entity(
                        model='cube',
                        collider='box',
                        position=(x, 0, z),  # Rings are flat on the y=0 plane
                        scale=(1, ring_thickness, 1),
                        texture=textures['orange.png'],  # Use a different texture for the rings
                        parent=planet
                    )
                    # Store the ring voxel in the dictionary
                    planet.ring_dict[(x, 0, z)] = ring_voxel

# Player Controller
player = FirstPersonController()
player.gravity = 0
player.cursor.visible = False
player.cursor.enabled = False
player.speed = 20
player.position = (0, 0, -50)  # Start 50 units away from the origin, looking toward the solar system

# Add a variable to track cursor lock state
cursor_locked = True

# Override the FirstPersonController's update method to implement noclip-style flying
original_player_update = player.update

def noclip_update():
    original_player_update()
    
    # Override movement to be in the direction the camera is facing
    if held_keys['w'] or held_keys['arrow up']:
        player.position += camera.forward * time.dt * player.speed
    if held_keys['s'] or held_keys['arrow down']:
        player.position -= camera.forward * time.dt * player.speed
    if held_keys['a'] or held_keys['arrow left']:
        player.position -= camera.right * time.dt * player.speed
    if held_keys['d'] or held_keys['arrow right']:
        player.position += camera.right * time.dt * player.speed
    if held_keys['space']:
        player.position += Vec3(0, 1, 0) * time.dt * player.speed
    if held_keys['shift']:
        player.position += Vec3(0, -1, 0) * time.dt * player.speed

player.update = noclip_update

# Lighting Setup
DirectionalLight(parent=sun, rotation=(45, -45, 45), shadows=True)
AmbientLight(color=color.rgba(100, 100, 100, 0.3))

# Get laser from pool
def get_laser_from_pool():
    for laser in laser_pool:
        if not laser.enabled:
            laser.enabled = True
            return laser
    
    # Create new laser if pool is not full
    if len(laser_pool) < MAX_LASERS:
        new_laser = Entity(
            model='cube',
            color=color.rgba(255, 0, 0, 200),
            scale=(0.3, 0.3, 1),
            enabled=False
        )
        laser_pool.append(new_laser)
        return new_laser
    
    # Recycle oldest laser if pool is full
    for i, laser in enumerate(laser_pool):
        if not laser in lasers:
            return laser
    
    # If all are in use, create a temporary one
    return Entity(
        model='cube',
        color=color.rgba(255, 0, 0, 200),
        scale=(0.3, 0.3, 1)
    )

# Get flash from pool
def get_flash_from_pool():
    for flash in flash_pool:
        if not flash.enabled:
            flash.enabled = True
            return flash
    
    # Create new flash if pool is not full
    if len(flash_pool) < MAX_FLASHES:
        new_flash = Entity(
            model='sphere',
            color=color.rgba(255, 50, 50, 200),
            scale=1.2,
            enabled=False
        )
        flash_pool.append(new_flash)
        return new_flash
    
    # Recycle oldest flash
    oldest_flash = flash_pool[0]
    flash_pool.remove(oldest_flash)
    flash_pool.append(oldest_flash)
    return oldest_flash

# Update orbit positions - optimized
def update():
    # Update planet positions
    for planet in planets:
        planet.orbit_angle += planet.orbit_speed
        planet.x = np.cos(planet.orbit_angle) * planet.orbit_radius
        planet.z = np.sin(planet.orbit_angle) * planet.orbit_radius
    
    # Update any active lasers
    for laser in lasers[:]:  # Use a copy of the list since we might modify it
        laser.life -= time.dt
        if laser.life <= 0:
            # Instead of destroying the laser, just disable it
            laser.enabled = False
            if laser in lasers:
                lasers.remove(laser)
            
            # Damage the target
            if hasattr(laser, 'target') and laser.target:
                create_explosion(laser.target)
    
    # Update moon if it exists
    if 'moon' in globals():
        moon.rotation_angle += moon.rotation_speed
        moon.x = np.cos(moon.rotation_angle) * 5  # 5 units away from Earth
        moon.z = np.sin(moon.rotation_angle) * 5
    
    # Show/hide crosshair based on cursor lock state
    crosshair.visible = cursor_locked

def input(key):
    global cursor_locked
    
    # Toggle cursor lock with escape key
    if key == 'escape':
        application.quit()  # Restore original behavior to quit on Escape
    elif key == 'p':  # Use 'p' key to toggle cursor lock
        cursor_locked = not cursor_locked
        
        if cursor_locked:
            mouse.locked = True
            mouse.visible = False
        else:
            mouse.locked = False
            mouse.visible = True
    
    # Shoot a laser when left mouse button is clicked
    if key == 'left mouse down' and cursor_locked:
        if mouse.hovered_entity and hasattr(mouse.hovered_entity, 'parent'):
            # Only shoot if we're hovering over a block that belongs to a planet
            if mouse.hovered_entity.parent in planets or mouse.hovered_entity.parent == sun:
                create_laser(camera.world_position, mouse.hovered_entity)

# Optimized laser creation
def create_laser(start_pos, target_entity):
    # Use the next audio instance from the pool for faster playback
    global shoot_sound_index
    shoot_sound_pool[shoot_sound_index].play(start=1.1)
    shoot_sound_index = (shoot_sound_index + 1) % len(shoot_sound_pool)
    
    # Adjust the start position to be slightly forward, below, and to the left of the camera
    adjusted_start_pos = start_pos + (camera.forward * 1.2) + (Vec3(0, -0.5, 0)) + (camera.left * 0.5)
    
    # Calculate the end position (the target)
    end_pos = target_entity.world_position
    
    # Calculate the direction and distance
    direction = (end_pos - adjusted_start_pos).normalized()
    distance = (end_pos - adjusted_start_pos).length()
    
    # Get a laser from the pool
    laser = get_laser_from_pool()
    
    # Configure the laser
    laser.scale = (0.3, 0.3, distance)
    laser.position = adjusted_start_pos + (direction * distance/2)
    laser.look_at(end_pos)
    laser.life = 0.3
    laser.target = target_entity
    
    # Add to the list of active lasers
    lasers.append(laser)
    
    # Create explosion effect at the impact point
    # Get a flash from the pool
    impact_flash = get_flash_from_pool()
    impact_flash.position = end_pos
    
    # Schedule the disabling of the impact flash
    def disable_flash():
        impact_flash.enabled = False
    
    invoke(disable_flash, delay=0.2)

# Optimized explosion creation using spatial dictionary
def create_explosion(target_entity, radius=1.5):
    # Get the parent of the target (the planet or sun)
    parent_entity = target_entity.parent
    
    # Get the position of the target in local space
    target_pos = target_entity.position
    
    # Initialize target_destroyed flag and list of blocks within the explosion radius
    blocks_to_destroy = []
    
    # Check if the parent has a block dictionary
    if hasattr(parent_entity, 'block_dict'):
        # Only check blocks that could be within the radius
        for x in range(int(target_pos.x-radius), int(target_pos.x+radius+1)):
            for y in range(int(target_pos.y-radius), int(target_pos.y+radius+1)):
                for z in range(int(target_pos.z-radius), int(target_pos.z+radius+1)):
                    if (x, y, z) in parent_entity.block_dict:
                        block = parent_entity.block_dict[(x, y, z)]
                        distance = (block.position - target_pos).length()
                        if distance <= radius:
                            blocks_to_destroy.append(block)
                            # Remove from the dictionary
                            del parent_entity.block_dict[(x, y, z)]
    
    # Check if the parent has a ring dictionary (for Saturn's rings)
    if hasattr(parent_entity, 'ring_dict'):
        # Only check blocks that could be within the radius
        for x in range(int(target_pos.x-radius), int(target_pos.x+radius+1)):
            for y in range(int(target_pos.y-radius), int(target_pos.y+radius+1)):
                for z in range(int(target_pos.z-radius), int(target_pos.z+radius+1)):
                    if (x, y, z) in parent_entity.ring_dict:
                        block = parent_entity.ring_dict[(x, y, z)]
                        distance = (block.position - target_pos).length()
                        if distance <= radius:
                            blocks_to_destroy.append(block)
                            # Remove from the dictionary
                            del parent_entity.ring_dict[(x, y, z)]
    else:
        # Fallback for entities without a block dictionary
        for entity in parent_entity.children:
            distance = (entity.position - target_pos).length()
            if distance <= radius:
                blocks_to_destroy.append(entity)
    
    # Update colliders for newly exposed blocks
    if hasattr(parent_entity, 'block_dict'):
        for block in blocks_to_destroy:
            x, y, z = int(block.x), int(block.y), int(block.z)
            # Check all 6 neighboring positions
            for dx, dy, dz in [(1,0,0), (-1,0,0), (0,1,0), (0,-1,0), (0,0,1), (0,0,-1)]:
                neighbor_pos = (x+dx, y+dy, z+dz)
                if neighbor_pos in parent_entity.block_dict:
                    neighbor = parent_entity.block_dict[neighbor_pos]
                    # If this block doesn't have a collider yet, add one
                    if not neighbor.collider:
                        neighbor.collider = BoxCollider(neighbor)
    
    # Also update colliders for newly exposed ring blocks
    if hasattr(parent_entity, 'ring_dict'):
        for block in blocks_to_destroy:
            x, y, z = int(block.x), int(block.y), int(block.z)
            # Check all 6 neighboring positions
            for dx, dy, dz in [(1,0,0), (-1,0,0), (0,1,0), (0,-1,0), (0,0,1), (0,0,-1)]:
                neighbor_pos = (x+dx, y+dy, z+dz)
                if neighbor_pos in parent_entity.ring_dict:
                    neighbor = parent_entity.ring_dict[neighbor_pos]
                    # If this block doesn't have a collider yet, add one
                    if not neighbor.collider:
                        neighbor.collider = BoxCollider(neighbor)
    
    # Destroy all blocks in the explosion radius
    for block in blocks_to_destroy:
        destroy(block)

# Crosshair for better aiming
crosshair = Entity(
    parent=camera.ui,
    model='quad',
    color=color.rgba(255, 255, 255, 150),  # Slightly transparent
    scale=0.01  # Increased size from 0.0005 to make it more visible
)

# Replace the default Sky() with a custom skybox using stars.png
sky = Sky(texture="stars.png")

# Add a moon to Earth
earth = None
for planet in planets:
    if planet.name == 'Earth':
        earth = planet
        break

if earth:
    # Create the Moon
    moon = Entity(name='Moon')
    moon.parent = earth  # Make the moon orbit with Earth
    moon.position = (5, 0, 0)  # Position relative to Earth
    moon.rotation_speed = 0.02  # Moon's rotation around Earth
    moon.rotation_angle = 0  # Starting angle
    
    # Create spatial dictionary for moon
    moon.block_dict = {}
    
    # Create voxel-based Moon
    moon_size = 0.7  # Moon is smaller than Earth
    moon_voxel_range = int(moon_size + 1)
    moon_max_distance = moon_size * moon_size
    
    # Create the Moon with a white texture
    for x in range(-moon_voxel_range, moon_voxel_range + 1):
        for y in range(-moon_voxel_range, moon_voxel_range + 1):
            for z in range(-moon_voxel_range, moon_voxel_range + 1):
                if x**2 + y**2 + z**2 <= moon_max_distance:
                    # Determine if this is an outer block
                    is_outer_block = False
                    for dx, dy, dz in [(1,0,0), (-1,0,0), (0,1,0), (0,-1,0), (0,0,1), (0,0,-1)]:
                        nx, ny, nz = x+dx, y+dy, z+dz
                        if nx**2 + ny**2 + nz**2 > moon_max_distance:
                            is_outer_block = True
                            break
                    
                    # Use white.png for the moon texture
                    moon_texture = textures['white.png']
                    
                    moon_voxel = Entity(
                        model='cube',
                        collider='box' if is_outer_block else None,
                        position=(x, y, z),
                        scale=1,
                        texture=moon_texture,
                        parent=moon
                    )
                    
                    # Store in the moon's block dictionary
                    moon.block_dict[(x, y, z)] = moon_voxel

app.run()