import sys
import cv2
import numpy as np
import json
import time
from ultralytics import YOLO
import logging

logging.getLogger("ultralytics").setLevel(logging.ERROR)

MODEL_PATH = "yolo11s.pt"
CONFIDENCE_THRESHOLD = 0.25 
VEHICLE_CLASSES = [2, 3, 5, 7]

MAP_WIDTH = 300 
MAP_HEIGHT = 700

def get_homography_matrix(src_points):
    dst_points = np.float32([
        [50, MAP_HEIGHT - 50],
        [MAP_WIDTH - 50, MAP_HEIGHT - 50],
        [MAP_WIDTH - 50, 50],
        [50, 50]
    ])
    return cv2.getPerspectiveTransform(src_points, dst_points)

def point_inside_polygon(x, y, polygon):
    return cv2.pointPolygonTest(polygon.astype(np.int32), (float(x), float(y)), False) >= 0

def draw_map(vehicle_points, total_count):
    canvas = np.full((MAP_HEIGHT, MAP_WIDTH, 3), 50, dtype=np.uint8)
    cv2.line(canvas, (20, 0), (20, MAP_HEIGHT), (255,255,255), 3)
    cv2.line(canvas, (MAP_WIDTH-20, 0), (MAP_WIDTH-20, MAP_HEIGHT), (255,255,255), 3)
    
    center_x = MAP_WIDTH // 2
    for y in range(10, MAP_HEIGHT, 40):
        cv2.line(canvas, (center_x, y), (center_x, y+20), (255,255,255), 2)
        
    for vid, (x, y) in vehicle_points.items():
        if 0 <= x < MAP_WIDTH and 0 <= y < MAP_HEIGHT:
            cv2.circle(canvas, (x, y), 6, (255, 255, 0), -1) 
            cv2.putText(canvas, str(vid), (x+8, y+5), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0,255,0), 1)
            
    cv2.rectangle(canvas, (0, MAP_HEIGHT - 60), (MAP_WIDTH, MAP_HEIGHT), (30,30,30), -1)
    cv2.putText(canvas, f"Total Vehicles: {total_count}", (10, MAP_HEIGHT - 35), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 255), 1)
    cv2.putText(canvas, "Press 'Q' to finish", (10, MAP_HEIGHT - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (200, 200, 200), 1)
            
    return canvas

def main():
    if len(sys.argv) < 3:
        sys.exit(1)

    video_source = sys.argv[1]
    coords_str = sys.argv[2]

    try:
        coords_list = list(map(int, coords_str.split(',')))
        src_points = np.array(coords_list, dtype=np.float32).reshape(4, 2)
        roi_poly = src_points.astype(np.int32)
    except Exception:
        sys.exit(1)

    model = YOLO(MODEL_PATH, verbose=False)
    H = get_homography_matrix(src_points)

    cap = cv2.VideoCapture(video_source)
    unique_vehicles = set()
    frame_count = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            time.sleep(2)
            cap = cv2.VideoCapture(video_source)
            continue

        frame_count += 1
        if frame_count % 4 != 0:
            continue

        frame = cv2.resize(frame, (1280, 720))

        results = model.track(frame, persist=True, verbose=False, tracker="bytetrack.yaml", classes=VEHICLE_CLASSES, conf=CONFIDENCE_THRESHOLD)
        current_vehicle_data = {}

        if results[0].boxes and results[0].boxes.id is not None:
            boxes = results[0].boxes.xyxy.cpu().numpy()
            ids = results[0].boxes.id.cpu().numpy().astype(int)

            for box, obj_id in zip(boxes, ids):
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

                unique_vehicles.add(obj_id)
                current_vehicle_data[obj_id] = (mx, my)

        map_2d = draw_map(current_vehicle_data, len(unique_vehicles))
        cv2.imshow("Bird's Eye View Map - Live Simulation", map_2d)

        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    cap.release()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    main()