import sys
import cv2
import json
import numpy as np

selected_points = []

def mouse_callback(event, x, y, flags, param):
    global selected_points
    if event == cv2.EVENT_LBUTTONDOWN:
        if len(selected_points) < 4:
            selected_points.append((x, y))

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "message": "Thiếu tham số link video."}))
        sys.exit(1)

    video_source = sys.argv[1]
    cap = cv2.VideoCapture(video_source)
    ret = False
    frame = None
    
    for _ in range(10):
        ret, frame = cap.read()
        if ret:
            break
        cv2.waitKey(500)
        
    cap.release()

    if not ret or frame is None:
        print(json.dumps({"success": False, "message": "Không thể kết nối luồng m3u8. Vui lòng thử lại!"}))
        sys.exit(1)

    frame = cv2.resize(frame, (1280, 720))

    cv2.namedWindow("Setup Camera - Select 4 Points")
    cv2.setMouseCallback("Setup Camera - Select 4 Points", mouse_callback)

    while True:
        temp = frame.copy()
        for i, p in enumerate(selected_points):
            cv2.circle(temp, p, 6, (0, 0, 255), -1)
            cv2.putText(temp, str(i+1), (p[0]+5, p[1]-5), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0,255,0), 2)
            
        if len(selected_points) == 4:
            cv2.polylines(temp, [np.array(selected_points)], True, (255,0,0), 2)
            
        cv2.imshow("Setup Camera - Select 4 Points", temp)
        key = cv2.waitKey(1) & 0xFF
        
        if key == 13 and len(selected_points) == 4:
            coords_str = ",".join([f"{x},{y}" for x, y in selected_points])
            print(json.dumps({"success": True, "coords": coords_str}))
            break
            
        if key == 27:
            print(json.dumps({"success": False, "message": "Đã hủy."}))
            break

    cv2.destroyAllWindows()

if __name__ == "__main__":
    main()