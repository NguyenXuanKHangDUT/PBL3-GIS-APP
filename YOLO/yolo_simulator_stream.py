import sys
import os
import cv2
import numpy as np
import json
import time
import threading
from ultralytics import YOLO
import logging

logging.getLogger("ultralytics").setLevel(logging.ERROR)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

MODEL_PATH = os.path.join(BASE_DIR, "yolo11s_traffic_best_v2.pt")

CONFIDENCE_THRESHOLD = 0.30

# Custom model:
# 0 = car
# 1 = motorcycle
# 2 = bus
# 3 = truck
VEHICLE_CLASSES = [0, 1, 2, 3]

IMG_SIZE = 640

FRAME_WIDTH = 1280
FRAME_HEIGHT = 720

MAP_WIDTH = 300
MAP_HEIGHT = 700

# Web simulator does not need 30 FPS.
# 5–8 FPS is enough for a smooth Bird's Eye View.
TARGET_FPS = 6

CLASS_NAMES = {
    0: "Car",
    1: "Motorcycle",
    2: "Bus",
    3: "Truck"
}


def send_json(data):
    print(json.dumps(data, ensure_ascii=False, separators=(",", ":")))
    sys.stdout.flush()


class LatestFrameReader:
    def __init__(self, video_source):
        self.video_source = video_source
        self.cap = None
        self.frame = None
        self.lock = threading.Lock()
        self.running = False
        self.thread = None
        self.last_frame_time = 0

    def start(self):
        self.running = True
        self.thread = threading.Thread(target=self._read_loop, daemon=True)
        self.thread.start()

    def stop(self):
        self.running = False

        try:
            if self.cap is not None:
                self.cap.release()
        except Exception:
            pass

    def get_latest_frame(self):
        with self.lock:
            if self.frame is None:
                return None
            return self.frame.copy()

    def _open_capture(self):
        try:
            cap = cv2.VideoCapture(self.video_source)

            # Has an effect on some camera/file backends, not all m3u8 streams are accepted.
            try:
                cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
            except Exception:
                pass

            return cap
        except Exception:
            return None

    def _read_loop(self):
        self.cap = self._open_capture()
        fail_count = 0

        while self.running:
            if self.cap is None or not self.cap.isOpened():
                time.sleep(0.5)
                self.cap = self._open_capture()
                continue

            ret, frame = self.cap.read()

            if not ret or frame is None:
                fail_count += 1

                if fail_count >= 10:
                    try:
                        self.cap.release()
                    except Exception:
                        pass

                    self.cap = None
                    fail_count = 0
                    time.sleep(0.5)
                else:
                    time.sleep(0.05)

                continue

            fail_count = 0

            with self.lock:
                self.frame = frame
                self.last_frame_time = time.time()

            # sleep a tiny bit to avoid busy waiting, but not too long to keep the frame rate high
            time.sleep(0.001)


def get_homography_matrix(src_points):
    dst_points = np.float32([
        [50, MAP_HEIGHT - 50],
        [MAP_WIDTH - 50, MAP_HEIGHT - 50],
        [MAP_WIDTH - 50, 50],
        [50, 50]
    ])

    return cv2.getPerspectiveTransform(src_points, dst_points)


def point_inside_polygon(x, y, polygon):
    return cv2.pointPolygonTest(
        polygon.astype(np.int32),
        (float(x), float(y)),
        False
    ) >= 0


def main():
    if len(sys.argv) < 3:
        send_json({
            "type": "sim_status",
            "success": False,
            "message": "Missing video_source or camera_coords."
        })
        sys.exit(1)

    video_source = sys.argv[1]
    coords_str = sys.argv[2]

    try:
        coords_list = list(map(int, coords_str.split(",")))

        if len(coords_list) != 8:
            raise ValueError("camera_coords must contain exactly 8 numbers.")

        src_points = np.array(coords_list, dtype=np.float32).reshape(4, 2)
        roi_poly = src_points.astype(np.int32)

    except Exception as e:
        send_json({
            "type": "sim_status",
            "success": False,
            "message": f"Error parsing ROI: {str(e)}"
        })
        sys.exit(1)

    try:
        model = YOLO(MODEL_PATH, verbose=False)
    except Exception as e:
        send_json({
            "type": "sim_status",
            "success": False,
            "message": f"Cannot load YOLO model: {str(e)}"
        })
        sys.exit(1)

    H = get_homography_matrix(src_points)

    reader = LatestFrameReader(video_source)
    reader.start()

    send_json({
        "type": "sim_status",
        "success": True,
        "message": "Web simulator started. Waiting for camera frames...",
        "width": MAP_WIDTH,
        "height": MAP_HEIGHT
    })

    # wait for the first frame, but not more than 21 seconds
    first_frame = None
    wait_start = time.time()

    while time.time() - wait_start < 21:
        first_frame = reader.get_latest_frame()

        if first_frame is not None:
            break

        time.sleep(0.1)

    if first_frame is None:
        send_json({
            "type": "sim_status",
            "success": False,
            "message": "Cannot get initial frame from camera after 21 seconds."
        })
        reader.stop()
        sys.exit(1)

    send_json({
        "type": "sim_status",
        "success": True,
        "message": "Camera frame received. Running YOLO simulation..."
    })

    last_emit_time = 0
    min_interval = 1.0 / TARGET_FPS

    try:
        while True:
            now = time.time()

            if now - last_emit_time < min_interval:
                time.sleep(0.005)
                continue

            frame = reader.get_latest_frame()

            if frame is None:
                send_json({
                    "type": "sim_status",
                    "success": True,
                    "message": "Waiting for new frame from camera..."
                })
                time.sleep(0.2)
                continue

            frame = cv2.resize(frame, (FRAME_WIDTH, FRAME_HEIGHT))

            try:
                results = model.track(
                    frame,
                    persist=True,
                    verbose=False,
                    tracker="botsort.yaml",
                    classes=VEHICLE_CLASSES,
                    conf=CONFIDENCE_THRESHOLD,
                    imgsz=IMG_SIZE,
                    device=0
                )
            except Exception as e:
                send_json({
                    "type": "sim_status",
                    "success": False,
                    "message": f"Error YOLO tracking: {str(e)}"
                })
                time.sleep(1)
                continue

            vehicles = []

            if results and results[0].boxes is not None and results[0].boxes.id is not None:
                boxes = results[0].boxes.xyxy.cpu().numpy()
                ids = results[0].boxes.id.cpu().numpy().astype(int)
                cls_ids = results[0].boxes.cls.cpu().numpy().astype(int)

                for box, obj_id, class_id in zip(boxes, ids, cls_ids):
                    # Dùng điểm chân xe để map Homography, giống simulator cũ.
                    x_foot = int((box[0] + box[2]) / 2)
                    y_foot = int(box[3])

                    if not point_inside_polygon(x_foot, y_foot, roi_poly):
                        continue

                    pt = np.array([[[x_foot, y_foot]]], dtype=np.float32)
                    dst = cv2.perspectiveTransform(pt, H)

                    mx = int(dst[0][0][0])
                    my = int(dst[0][0][1])

                    if mx < 0 or mx >= MAP_WIDTH or my < 0 or my >= MAP_HEIGHT:
                        continue

                    vehicles.append({
                        "id": int(obj_id),
                        "x": mx,
                        "y": my,
                        "class_id": int(class_id),
                        "class_name": CLASS_NAMES.get(int(class_id), "Unknown")
                    })

            send_json({
                "type": "sim_frame",
                "width": MAP_WIDTH,
                "height": MAP_HEIGHT,
                "vehicles": vehicles,
                "timestamp": time.time()
            })

            last_emit_time = now

    except KeyboardInterrupt:
        pass
    finally:
        reader.stop()

        send_json({
            "type": "sim_status",
            "success": True,
            "message": "Web simulator stopped."
        })


if __name__ == "__main__":
    main()