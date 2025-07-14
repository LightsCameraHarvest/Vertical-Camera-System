import asyncio
import cv2
import websockets

async def stream(websocket, path):
    print("streaming")
    cap = cv2.VideoCapture(0)

    while True:
        ret, frame = cap.read()
        if not ret:
            print("rip1")
            break

        # Encode frame as JPEG
        ret, buffer = cv2.imencode('.jpg', frame)
        if not ret:
            print("rip")
            break

        await websocket.send(buffer.tobytes())
        await asyncio.sleep(1/30)  # ~30 fps

    cap.release()

async def main():
    async with websockets.serve(stream, "0.0.0.0", 8765):
        print("serving")
        await asyncio.Future()  # run forever

asyncio.run(main())
