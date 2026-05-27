import sys
import cv2
import numpy as np
import time
import json
from ultralytics import YOLO
import logging

logging.getLogger("ultralytics").setLevel(logging.ERROR)

MODEL_PATH = "yolo11n.pt"
CONFIDENCE_THRESHOLD = 0.15 
VEHICLE_CLASSES = [2, 3, 5, 7]

def get_median_line(coords_list):
    pts = np.array(coords_list).reshape(4, 2).tolist()
    pts.sort(key=lambda p: p[1])
    top = sorted(pts[:2], key=lambda p: p[0]) 
    bottom = sorted(pts[2:], key=lambda p: p[0]) 
    
    left_mid = ((top[0][0] + bottom[0][0]) / 2, (top[0][1] + bottom[0][1]) / 2)
    right_mid = ((top[1][0] + bottom[1][0]) / 2, (top[1][1] + bottom[1][1]) / 2)
    return left_mid, right_mid

def ccw(A, B, C):
    return (C[1]-A[1]) * (B[0]-A[0]) > (B[1]-A[1]) * (C[0]-A[0])

def intersect(A, B, C, D):
    return ccw(A,C,D) != ccw(B,C,D) and ccw(A,B,C) != ccw(A,B,D)

def main():
    if len(sys.argv) < 3:
        sys.exit(1)

    video_source = sys.argv[1] 
    coords_str = sys.argv[2] 

    try:
        coords_list = list(map(int, coords_str.split(',')))
        line_A, line_B = get_median_line(coords_list)
    except Exception:
        sys.exit(1)

    try:
        model = YOLO(MODEL_PATH, verbose=False)
    except Exception:
        sys.exit(1)

    print(json.dumps({"status": "started", "message": "Bắt đầu luồng đếm ngầm siêu nhạy..."}))
    sys.stdout.flush()

    track_history = {} 
    counted_ids = set() 
    start_time = time.time()
    
    cap = cv2.VideoCapture(video_source)

    while True:
        ret, frame = cap.read()
        
        if not ret:
            time.sleep(2)
            cap = cv2.VideoCapture(video_source)
            continue
            
        frame = cv2.resize(frame, (1280, 720))

        results = model.track(frame, persist=True, verbose=False, tracker="botsort.yaml", classes=VEHICLE_CLASSES, conf=CONFIDENCE_THRESHOLD)
        
        if results[0].boxes and results[0].boxes.id is not None:
            boxes = results[0].boxes.xyxy.cpu().numpy()
            ids = results[0].boxes.id.cpu().numpy().astype(int)

            for box, obj_id in zip(boxes, ids):
                x_center = int((box[0] + box[2]) / 2)
                y_center = int((box[1] + box[3]) / 2)
                curr_pos = (x_center, y_center)

                if obj_id in track_history:
                    prev_pos = track_history[obj_id]
                    if obj_id not in counted_ids:
                        if intersect(prev_pos, curr_pos, line_A, line_B):
                            counted_ids.add(obj_id) 
                
                track_history[obj_id] = curr_pos

        if len(track_history) > 3000:
            track_history.clear()

        current_time = time.time()
        if current_time - start_time >= 60:
            
            scaled_count = len(counted_ids) * 8
            
            print(json.dumps({"cars_per_minute": scaled_count}))
            sys.stdout.flush() 
            counted_ids.clear()
            start_time = current_time

if __name__ == "__main__":
    main()