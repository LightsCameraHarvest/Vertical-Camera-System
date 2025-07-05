# In /home/helena/rtsp-controller/app.py on Pi

from flask import Flask, render_template, jsonify
import subprocess
import time
import socket
import os
import signal

app = Flask(__name__)

mediamtx_proc = None
stream_proc = None

MEDIAMTX_CONFIG = "/home/helena/mediamtx.yml"

def wait_for_port(host, port, timeout=10):
    start_time = time.time()
    while time.time() - start_time < timeout:
        try:
            with socket.create_connection((host, port), timeout=1):
                return True
        except OSError:
            time.sleep(0.5)
    return False

@app.route('/')
def index():
    mediamtx_running = mediamtx_proc is not None and mediamtx_proc.poll() is None
    stream_running = stream_proc is not None and stream_proc.poll() is None
    is_running = mediamtx_running and stream_running
    return render_template('index.html', is_running=is_running)

@app.route('/start-stream')
def start_stream():
    global mediamtx_proc, stream_proc

    if mediamtx_proc is None or mediamtx_proc.poll() is not None:
        mediamtx_cmd = f"mediamtx {MEDIAMTX_CONFIG} --verbose"
        mediamtx_proc = subprocess.Popen(mediamtx_cmd, shell=True)

        if not wait_for_port('localhost', 8554, timeout=15):
            mediamtx_proc.terminate()
            mediamtx_proc.wait()
            mediamtx_proc = None
            return jsonify({"error": "MediaMTX did not start in time"}), 500

    if stream_proc is None or stream_proc.poll() is not None:
        stream_cmd = (
            "libcamera-vid -t 0 --width 640 --height 480 --codec h264 --inline --nopreview -o - | "
            "ffmpeg -f h264 -i - -c copy -f rtsp rtsp://localhost:8554/cam"
        )
        stream_proc = subprocess.Popen(
            stream_cmd,
            shell=True,
            preexec_fn=os.setsid  # Important for group termination
        )

    return jsonify({"status": "stream started"})

@app.route('/stop-stream')
def stop_stream():
    global mediamtx_proc, stream_proc

    if stream_proc is not None and stream_proc.poll() is None:
        os.killpg(os.getpgid(stream_proc.pid), signal.SIGTERM)
        stream_proc.wait()
        stream_proc = None

    if mediamtx_proc is not None and mediamtx_proc.poll() is None:
        mediamtx_proc.terminate()
        mediamtx_proc.wait()
        mediamtx_proc = None

    return jsonify({"status": "stream stopped"})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
