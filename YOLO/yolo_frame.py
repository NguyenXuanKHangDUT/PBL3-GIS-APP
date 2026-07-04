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
            "message": "Thiếu link video."
        }))
        sys.exit(1)

    video_source = sys.argv[1]

    cap = cv2.VideoCapture(video_source)

    ret = False
    frame = None

    # Thử đọc nhiều frame để tránh stream m3u8 chưa kịp mở
    for _ in range(30):
        ret, frame = cap.read()
        if ret and frame is not None:
            break
        time.sleep(0.2)

    cap.release()

    if not ret or frame is None:
        print(json.dumps({
            "success": False,
            "message": "Không thể lấy frame từ luồng camera. Vui lòng kiểm tra link."
        }))
        sys.exit(1)

    frame = cv2.resize(frame, (FRAME_WIDTH, FRAME_HEIGHT))

    ok, buffer = cv2.imencode(".jpg", frame, [int(cv2.IMWRITE_JPEG_QUALITY), 85])

    if not ok:
        print(json.dumps({
            "success": False,
            "message": "Không thể mã hóa frame."
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