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

# Voxel-based Sun
sun = Entity()
# Use sun.png texture instead of solid color
sun_texture = load_texture('sun.png')

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

# Planet data: name, texture, size, orbit_radius, orbit_speed
planet_data = [
    ('Mercury', 'orange.png', 1, 12, 0.04),
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
}

# Create voxel planets
for name, texture_name, size, orbit_radius, orbit_speed in planet_data:
    planet_center = Entity(name=name)
    planet_center.orbit_radius = orbit_radius
    planet_center.orbit_speed = orbit_speed
    planet_center.orbit_angle = np.random.rand() * 360
    
    # Calculate voxel range based on planet size
    voxel_range = int(size + 1)
    max_distance = size * size
    
    # Populate planet with voxels
    for x in range(-voxel_range, voxel_range + 1):
        for y in range(-voxel_range, voxel_range + 1):
            for z in range(-voxel_range, voxel_range + 1):
                if x**2 + y**2 + z**2 <= max_distance:
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
                        
                    voxel = Entity(
                        model='cube',
                        collider='box',
                        position=(x, y, z),
                        scale=1,
                        texture=planet_texture,
                        parent=planet_center
                    )
    planets.append(planet_center)

# Add rings to Saturn
for planet in planets:
    if planet.name == 'Saturn':
        # Create Saturn's rings
        ring_radius = 6  # Adjust based on Saturn's size
        ring_thickness = 0.5
        
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

# Player Controller
player = FirstPersonController()
player.gravity = 0
player.cursor.visible = False
player.cursor.enabled = False
player.speed = 20
player.position = (0, 0, -50)  # Start 50 units away from the origin, looking toward the solar system

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

# Update orbit positions
def update():
    for planet in planets:
        planet.orbit_angle += planet.orbit_speed
        planet.x = np.cos(planet.orbit_angle) * planet.orbit_radius
        planet.z = np.sin(planet.orbit_angle) * planet.orbit_radius

def input(key):
    if key == 'escape':
        application.quit()
    elif key == 'left mouse down':
        hit_info = raycast(
            origin=camera.world_position,
            direction=camera.forward,
            distance=100,
            ignore=(player,),
            traverse_target=scene
        )
        if hit_info.hit:
            destroy(hit_info.entity)

# Crosshair for better aiming
crosshair = Entity(
    parent=camera.ui,
    model='quad',
    color=color.rgba(255, 255, 255, 150),  # Slightly transparent
    scale=0.0005  # Smaller crosshair (reduced from 0.001)
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
    
    # Create voxel-based Moon
    moon_size = 0.7  # Moon is smaller than Earth
    moon_voxel_range = int(moon_size + 1)
    moon_max_distance = moon_size * moon_size
    
    # Create the Moon with a white texture
    for x in range(-moon_voxel_range, moon_voxel_range + 1):
        for y in range(-moon_voxel_range, moon_voxel_range + 1):
            for z in range(-moon_voxel_range, moon_voxel_range + 1):
                if x**2 + y**2 + z**2 <= moon_max_distance:
                    # Use white.png for the moon texture
                    moon_texture = textures['white.png']
                    
                    moon_voxel = Entity(
                        model='cube',
                        collider='box',
                        position=(x, y, z),
                        scale=1,
                        texture=moon_texture,
                        parent=moon
                    )
    
    # Update the update function to rotate the moon
    original_update = update
    
    def new_update():
        original_update()  # Call the original update function
        
        # Update moon position
        if hasattr(moon, 'rotation_angle'):
            moon.rotation_angle += moon.rotation_speed
            moon.x = np.cos(moon.rotation_angle) * 5  # 5 units away from Earth
            moon.z = np.sin(moon.rotation_angle) * 5
    
    # Replace the update function
    update = new_update

app.run()