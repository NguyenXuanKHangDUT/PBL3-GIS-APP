import sys
import cv2
import json
import base64
import time

FRAME_WIDTH = 1280
FRAME_HEIGHT = 720

def main():
    if len(sys.argv) < 2:
        print(json.dumps({
            "success": False,
            "message": "Missing video link argument."
        }))
        sys.exit(1)

    video_source = sys.argv[1]

    cap = cv2.VideoCapture(video_source)

    ret = False
    frame = None

    # Try reading multiple frames to avoid m3u8 stream not being ready
    for _ in range(30):
        ret, frame = cap.read()
        if ret and frame is not None:
            break
        time.sleep(0.2)

    cap.release()

    if not ret or frame is None:
        print(json.dumps({
            "success": False,
            "message": "Cannot get frame from camera stream. Please check the link."
        }))
        sys.exit(1)

    frame = cv2.resize(frame, (FRAME_WIDTH, FRAME_HEIGHT))

    ok, buffer = cv2.imencode(".jpg", frame, [int(cv2.IMWRITE_JPEG_QUALITY), 85])

    if not ok:
        print(json.dumps({
            "success": False,
            "message": "Cannot encode frame."
        }))
        sys.exit(1)

    image_base64 = base64.b64encode(buffer).decode("utf-8")

    print(json.dumps({
        "success": True,
        "width": FRAME_WIDTH,
        "height": FRAME_HEIGHT,
        "image": image_base64
    }))
    sys.stdout.flush()

if __name__ == "__main__":
    main()