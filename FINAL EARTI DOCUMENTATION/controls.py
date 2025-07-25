# Raspberry Pi file path: /home/helena/controls.py

import pigpio
import RPi.GPIO as GPIO
from time import sleep
import asyncio
import websockets
import json
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ** CHANGE TO CAM NUMBER!!***
# this_cam = 'cam1'

# Pin definitions
ena_pin = 17
dir_pin = 27
stp_pin = 22
m2_pin = 24
m1_pin = 23
m0_pin = 18
slp_pin = 25
rst_pin = 12
motor_step_size = 115
max_steps = 18000  # ***FOR UNCUT EXTRUSION***
tray_steps = 1400

servo_pin = 19  # or 13
min_pulse = 1000
max_pulse = 2000
servo_pos = min_pulse + (max_pulse-min_pulse) // 2 # midpoint
servo_step_size = 15
limit_pin = 6  # or 26
# because we have no bottom limit pin, we need to keep track of steps
total_steps = 0

pi = pigpio.pi()
if not pi.connected:
    print("Failed to connect to pigpiod. Is it running?")
    exit(1)

# GPIO setup
GPIO.setmode(GPIO.BCM)  # GPIO numbers not board numbers
GPIO.setup(m2_pin, GPIO.OUT)
GPIO.setup(m1_pin, GPIO.OUT)
GPIO.setup(m0_pin, GPIO.OUT)
GPIO.setup(slp_pin, GPIO.OUT)
GPIO.setup(rst_pin, GPIO.OUT)
GPIO.output(slp_pin, GPIO.HIGH)
GPIO.output(rst_pin, GPIO.HIGH)
# 400 steps
GPIO.output(m2_pin, GPIO.LOW)
GPIO.output(m1_pin, GPIO.LOW)
GPIO.output(m0_pin, GPIO.HIGH)

GPIO.setup(ena_pin, GPIO.OUT)
GPIO.setup(dir_pin, GPIO.OUT)
GPIO.setup(stp_pin, GPIO.OUT)
GPIO.setup(limit_pin, GPIO.IN, pull_up_down=GPIO.PUD_UP)


def isTopPressed():
    return GPIO.input(limit_pin) == GPIO.LOW

def goHome():
    global current_level, target_level, total_steps
    GPIO.output(ena_pin, GPIO.LOW)
    GPIO.output(dir_pin, GPIO.HIGH)
    print("Going home...")

    while not isTopPressed():
        # step pulse
        GPIO.output(stp_pin, GPIO.HIGH)
        sleep(0.001)
        GPIO.output(stp_pin, GPIO.LOW)
        sleep(0.001)

    total_steps = 0
    current_level = 1
    target_level = 1
    print("Homing complete. Current level: 0")
    GPIO.output(ena_pin, GPIO.HIGH)
    return

def stepUp():
    global total_steps
    if isTopPressed() or total_steps<=0:
        total_steps = 0
        return
    GPIO.output(dir_pin, GPIO.HIGH)
    for i in range(motor_step_size):
        GPIO.output(stp_pin, GPIO.HIGH)
        sleep(0.0005)
        GPIO.output(stp_pin, GPIO.LOW)
        sleep(0.0005)
        total_steps -= 1

def stepDown():
    global total_steps
    if total_steps >= max_steps:
        return
    GPIO.output(dir_pin, GPIO.LOW)
    for i in range(motor_step_size):
        GPIO.output(stp_pin, GPIO.HIGH)
        sleep(0.0005)
        GPIO.output(stp_pin, GPIO.LOW)
        sleep(0.0005)
        total_steps += 1

def stepTo(target_step):
    global total_steps
    while target_step < total_steps - motor_step_size or target_step > total_steps + motor_step_size:
        if target_step < total_steps:
            stepUp()
        else:
            stepDown()
    return

def panCCW():
    global servo_pos
    # servo_pos = max(min_pulse, servo_pos - servo_step_size)
    # pi.set_servo_pulsewidth(servo_pin, servo_pos)
    for i in range(servo_step_size):
        servo_pos = max(min_pulse, servo_pos - 1)
        pi.set_servo_pulsewidth(servo_pin, servo_pos)
        sleep(0.01)
def panCW():
    global servo_pos
    servo_pos = min(max_pulse, servo_pos + servo_step_size)
    pi.set_servo_pulsewidth(servo_pin, servo_pos)
    sleep(0.01)

def panTo(target_pulse):
    global servo_pos
    while target_pulse < servo_pos - servo_step_size or target_pulse > servo_pos - servo_step_size:
        if target_pulse < servo_pos:
            panCCW()
        else:
            panCW()
    return

# Keep track of connected clients
connected_clients = set()

# WebSocket handler with better error handling and connection management
async def handleCommand(websocket, path):
    """Handle WebSocket connections and commands"""
    client_address = f"{websocket.remote_address[0]}:{websocket.remote_address[1]}"
    logger.info(f"New WebSocket connection from {client_address}")

    # Add client to connected set
    connected_clients.add(websocket)

    try:
        # Send initial connection confirmation
        await websocket.send(json.dumps({
            "status": "connected",
            "message": "WebSocket connection established",
            "servo_position": servo_pos,
            "total_steps": total_steps
        }))

        async for message in websocket:
            try:
                # Handle both string and binary messages
                if isinstance(message, bytes):
                    message = message.decode('utf-8')

                data = json.loads(message)
                command = data.get('command')
                camera = data.get('camera', 'unknown')

                logger.info(f"Received command: {command} from camera: {camera}")

                # Map commands to direction characters for easier handling
                command_map = {
                    '↑': 'u',
                    '↓': 'd',
                    '←': 'l',
                    '→': 'r'
                }

                # Use mapped command if it exists, otherwise use original
                cmd = command_map.get(command, command)

                if cmd == 'u' and camera == this_cam:  # Up arrow
                    stepUp()
                    logger.info("Executed stepUp")
                elif cmd == 'd' and camera == this_cam:  # Down arrow
                    stepDown()
                    logger.info("Executed stepDown")
                elif cmd == 'l' and camera == this_cam:  # Left arrow
                    panCCW()
                    logger.info("Executed panCCW")
                elif cmd == 'r' and camera == this_cam:  # Right arrow
                    panCW()
                    logger.info("Executed panCW")
                elif command == '1' and camera == this_cam:
                    stepTo(tray_steps*1)
                elif command == '2' and camera == this_cam:
                    stepTo(tray_steps*2)
                elif command == '3' and camera == this_cam:
                    stepTo(tray_steps*3)
                elif command == '4' and camera == this_cam:
                    stepTo(tray_steps*4)
                elif command == '5' and camera == this_cam:
                    stepTo(tray_steps*5)
                elif command == '6' and camera == this_cam:
                    stepTo(tray_steps*6)
                elif command == '7' and camera == this_cam:
                    stepTo(tray_steps*7)
                elif command == '8' and camera == this_cam:
                    stepTo(tray_steps*8)
                elif command == '9' and camera == this_cam:
                    stepTo(tray_steps*9)
                elif command == '10' and camera == this_cam:
                    stepTo(tray_steps*10)
                elif cmd == 'home' and camera == this_cam:  # Home command
                    goHome()
                    logger.info("Executed goHome")
                else:
                    logger.warning(f"Unknown command: {command}")

                # Send acknowledgment back to client
                response = {
                    "status": "executed",
                    "command": command,
                    "camera": camera,
                    "servo_position": servo_pos,
                    "total_steps": total_steps
                }
                await websocket.send(json.dumps(response))

            except json.JSONDecodeError as e:
                logger.error(f"JSON decode error: {e}")
                await websocket.send(json.dumps({
                    "status": "error",
                    "message": "Invalid JSON format"
                }))
            except Exception as e:
                logger.error(f"Error processing command: {e}")
                await websocket.send(json.dumps({
                    "status": "error",
                    "message": str(e)
                }))

    except websockets.exceptions.ConnectionClosed:
        logger.info(f"WebSocket connection closed normally for {client_address}")
    except websockets.exceptions.ConnectionClosedError as e:
        logger.warning(f"WebSocket connection closed with error for {client_address}: {e}")
    except Exception as e:
        logger.error(f"Unexpected error in WebSocket handler for {client_address}: {e}")
    finally:
        # Remove client from connected set
        connected_clients.discard(websocket)
        logger.info(f"Client {client_address} disconnected. Active connections: {len(connected_clients)}")

# Health check endpoint simulation
async def health_check():
    """Periodically log system health"""
    while True:
        try:
            await asyncio.sleep(30)  # Check every 30 seconds
            logger.info(f"Health check - Active WebSocket connections: {len(connected_clients)}")
            logger.info(f"Servo position: {servo_pos}, Total steps: {total_steps}")
        except Exception as e:
            logger.error(f"Health check error: {e}")

# !! IMPORTANT note: pans and homes before starting websocket server
async def main():
    """Main function to start WebSocket server"""
    # Start health check task
    health_task = asyncio.create_task(health_check())
    panTo(servo_pos)
    goHome()
    GPIO.output(ena_pin, GPIO.LOW)

    try:
        # Create WebSocket server with specific settings for Cloudflare Tunnel compatibility
        server = await websockets.serve(
            handleCommand,
            "0.0.0.0",  # Bind to all interfaces
            8765,       # Port
            # WebSocket server configuration
            ping_interval=20,  # Send ping every 20 seconds
            ping_timeout=10,   # Wait 10 seconds for pong
            close_timeout=10,  # Wait 10 seconds for close
            max_size=2**20,    # Max message size (1MB)
            max_queue=32,      # Max queued messages
            compression=None,  # Disable compression for better compatibility
            # Add headers for better Cloudflare compatibility
            extra_headers={
                "Server": "EARTI-WebSocket-Server",
                "X-Content-Type-Options": "nosniff"
            }
        )

        logger.info("WebSocket server started on ws://0.0.0.0:8765")
        logger.info("Server ready to accept connections...")

        # Keep the server running
        await server.wait_closed()

    except KeyboardInterrupt:
        logger.info("Received keyboard interrupt, shutting down...")
    except Exception as e:
        logger.error(f"Server error: {e}")
    finally:
        # Clean up
        health_task.cancel()
        if pi.connected:
            try:
                pi.set_servo_pulsewidth(servo_pin, 0)
                pi.stop()
                logger.info("GPIO cleanup completed")
            except Exception as e:
                logger.error(f"Error during pigpio cleanup: {e}")

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nShutdown requested by user")
    except Exception as e:
        logger.error(f"Fatal error: {e}")
        print(f"Fatal error: {e}")
