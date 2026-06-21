import sys
import os
import cv2
import numpy as np
import json
import time
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

MAP_WIDTH = 300
MAP_HEIGHT = 700

CLASS_INFO = {
    0: {
        "name": "Car",
        "color": (0, 255, 255)      
    },
    1: {
        "name": "Motorcycle",
        "color": (255, 0, 255)     
    },
    2: {
        "name": "Bus",
        "color": (0, 165, 255)      
    },
    3: {
        "name": "Truck",
        "color": (0, 255, 0)        
    }
}


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


def draw_legend(canvas):
    legend_top = MAP_HEIGHT - 95

    cv2.rectangle(
        canvas,
        (0, legend_top),
        (MAP_WIDTH, MAP_HEIGHT),
        (30, 30, 30),
        -1
    )

    cv2.putText(
        canvas,
        "Legend",
        (10, legend_top + 20),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.55,
        (255, 255, 255),
        1
    )

    legend_items = [
        (0, 10, legend_top + 45),
        (1, 150, legend_top + 45),
        (2, 10, legend_top + 70),
        (3, 150, legend_top + 70),
    ]

    for class_id, x, y in legend_items:
        info = CLASS_INFO[class_id]
        color = info["color"]
        name = info["name"]

        cv2.circle(canvas, (x + 8, y - 5), 6, color, -1)
        cv2.putText(
            canvas,
            name,
            (x + 20, y),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.42,
            (220, 220, 220),
            1
        )

    cv2.putText(
        canvas,
        "Press 'Q' to finish",
        (10, MAP_HEIGHT - 8),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.45,
        (200, 200, 200),
        1
    )


def draw_map(vehicle_points):
    canvas = np.full((MAP_HEIGHT, MAP_WIDTH, 3), 50, dtype=np.uint8)

    cv2.line(canvas, (20, 0), (20, MAP_HEIGHT), (255, 255, 255), 3)
    cv2.line(canvas, (MAP_WIDTH - 20, 0), (MAP_WIDTH - 20, MAP_HEIGHT), (255, 255, 255), 3)

    center_x = MAP_WIDTH // 2

    for y in range(10, MAP_HEIGHT, 40):
        cv2.line(canvas, (center_x, y), (center_x, y + 20), (255, 255, 255), 2)

    for vid, data in vehicle_points.items():
        x, y, class_id = data

        if 0 <= x < MAP_WIDTH and 0 <= y < MAP_HEIGHT:
            info = CLASS_INFO.get(class_id, {
                "name": "Unknown",
                "color": (255, 255, 255)
            })

            color = info["color"]

            cv2.circle(canvas, (x, y), 6, color, -1)

            cv2.putText(
                canvas,
                str(vid),
                (x + 8, y + 5),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.4,
                color,
                1
            )

    draw_legend(canvas)

    return canvas


def reopen_capture(video_source):
    cap = cv2.VideoCapture(video_source)
    return cap


def main():
    if len(sys.argv) < 3:
        sys.exit(1)

    video_source = sys.argv[1]
    coords_str = sys.argv[2]

    try:
        coords_list = list(map(int, coords_str.split(",")))
        src_points = np.array(coords_list, dtype=np.float32).reshape(4, 2)
        roi_poly = src_points.astype(np.int32)
    except Exception:
        sys.exit(1)

    try:
        model = YOLO(MODEL_PATH, verbose=False)
    except Exception:
        sys.exit(1)

    H = get_homography_matrix(src_points)

    cap = reopen_capture(video_source)

    frame_count = 0

    while True:
        ret, frame = cap.read()

        if not ret:
            try:
                cap.release()
            except Exception:
                pass

            time.sleep(2)
            cap = reopen_capture(video_source)
            continue

        frame_count += 1

        if frame_count % 4 != 0:
            continue

        frame = cv2.resize(frame, (1280, 720))

        results = model.track(
            frame,
            persist=True,
            verbose=False,
            tracker="bytetrack.yaml",
            classes=VEHICLE_CLASSES,
            conf=CONFIDENCE_THRESHOLD,
            imgsz=IMG_SIZE
        )

        current_vehicle_data = {}

        if results and results[0].boxes is not None and results[0].boxes.id is not None:
            boxes = results[0].boxes.xyxy.cpu().numpy()
            ids = results[0].boxes.id.cpu().numpy().astype(int)
            cls_ids = results[0].boxes.cls.cpu().numpy().astype(int)

            for box, obj_id, class_id in zip(boxes, ids, cls_ids):
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

                current_vehicle_data[obj_id] = (mx, my, class_id)

        map_2d = draw_map(current_vehicle_data)
        cv2.imshow("Bird's Eye View Map - Live Simulation", map_2d)

        if cv2.waitKey(1) & 0xFF == ord("q"):
            break

    cap.release()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
