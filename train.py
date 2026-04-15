from ultralytics import YOLO

model = YOLO("yolo11n.pt")  # bisa pakai model kecil dulu
model.train(data="/Users/sucifaradilla/Downloads/deteksi jerawat-2/data.yaml ", epochs=50, imgsz=640)