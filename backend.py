from fastapi import FastAPI, UploadFile, File, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from ultralytics import YOLO
from PIL import Image
import io
import base64
import json
from io import BytesIO

PRODUCT_DB = {
    "papula": {
        "ingredients": [
            "Salicylic Acid",
            "Niacinamide",
            "Zinc",
            "Centella Asiatica"
        ],
        "products": [
            {"name": "Emina Ms Pimple", "price": "Rp 30k"},
            {"name": "Wardah Acnederm", "price": "Rp 40k"},
            {"name": "Hanasui Acne Serum", "price": "Rp 35k"},
            {"name": "Avoskin Serum", "price": "Rp 120k"},
            {"name": "Somethinc Niacinamide", "price": "Rp 100k"},
            {"name": "Whitelab Serum", "price": "Rp 90k"},
            {"name": "COSRX BHA", "price": "Rp 200k"},
            {"name": "Paula's Choice BHA", "price": "Rp 400k"},
            {"name": "The Ordinary Niacinamide", "price": "Rp 150k"},
            {"name": "Skintific Ceramide", "price": "Rp 130k"}
        ]
    },
    "pustula": {
        "ingredients": [
            "Benzoyl Peroxide",
            "Salicylic Acid",
            "Niacinamide",
            "Sulfur"
        ],
        "products": [
            {"name": "Emina Spot Gel", "price": "Rp 25k"},
            {"name": "Wardah Spot Treatment", "price": "Rp 35k"},
            {"name": "Hanasui Acne Gel", "price": "Rp 30k"},
            {"name": "Avoskin SA Serum", "price": "Rp 120k"},
            {"name": "Somethinc Acne Shot", "price": "Rp 110k"},
            {"name": "Whitelab Acne Cream", "price": "Rp 95k"},
            {"name": "La Roche Effaclar", "price": "Rp 300k"},
            {"name": "COSRX Patch", "price": "Rp 80k"},
            {"name": "CeraVe Acne Gel", "price": "Rp 250k"},
            {"name": "Paula's Choice Treatment", "price": "Rp 400k"}
        ]
    },
    "kistik": {
        "ingredients": [
            "Ceramide",
            "Niacinamide",
            "Hyaluronic Acid",
            "Centella Asiatica"
        ],
        "products": [
            {"name": "Hanasui Ceramide", "price": "Rp 40k"},
            {"name": "Wardah Hydra Rose", "price": "Rp 50k"},
            {"name": "Emina Skin Buddy", "price": "Rp 45k"},
            {"name": "Skintific Ceramide", "price": "Rp 130k"},
            {"name": "Somethinc Ceramic", "price": "Rp 140k"},
            {"name": "Avoskin Ceramide", "price": "Rp 150k"},
            {"name": "CeraVe Cream", "price": "Rp 250k"},
            {"name": "La Roche Cicaplast", "price": "Rp 300k"},
            {"name": "COSRX Snail Cream", "price": "Rp 220k"},
            {"name": "Laneige Sleeping Mask", "price": "Rp 350k"}
        ]
    }
}

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

import os
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
model_path = os.path.join(BASE_DIR, "acne_model.pt")
model = YOLO(model_path)

def get_product_recommendations(detections):
    acne_types = {item["class_name"] for item in detections}
    recommendations = []

    for acne_type in acne_types:
        if acne_type in PRODUCT_DB:
            recommendations.append({
                "acne_type": acne_type,
                "ingredients": PRODUCT_DB[acne_type]["ingredients"],
                "products": PRODUCT_DB[acne_type]["products"]
            })

    return recommendations


@app.get("/")
def read_root():
    return {"message": "API YOLO jalan"}


@app.post("/detect")
async def detect(file: UploadFile = File(...)):
    try:
        image_bytes = await file.read()
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")

        results = model(image)
        detections = []

        for box in results[0].boxes:
            cls_id = int(box.cls[0].item())
            conf = float(box.conf[0].item())
            x1, y1, x2, y2 = box.xyxy[0].tolist()

            detections.append({
                "class_id": cls_id,
                "class_name": model.names[cls_id],
                "confidence": conf,
                "x1": x1,
                "y1": y1,
                "x2": x2,
                "y2": y2
            })

        recommendations = get_product_recommendations(detections)

        return {
            "detections": detections,
            "recommendations": recommendations
        }

    except Exception as e:
        return {"error": str(e)}


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            # Receive base64 frame from frontend
            data = await websocket.receive_text()
            frame_data = json.loads(data)
            img_b64 = frame_data["image"]
            
            # Decode base64 to image
            img_bytes = base64.b64decode(img_b64.split(',')[1])  # Skip data:image/jpeg;base64,
            image = Image.open(BytesIO(img_bytes)).convert("RGB")
            
            # YOLO inference
            results = model(image)
            detections = []
            
            for box in results[0].boxes:
                cls_id = int(box.cls[0].item())
                conf = float(box.conf[0].item())
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                
                detections.append({
                    "class_id": cls_id,
                    "class_name": model.names[cls_id],
                    "confidence": conf,
                    "x1": x1,
                    "y1": y1,
                    "x2": x2,
                    "y2": y2
                })
            
            recommendations = get_product_recommendations(detections)
            
            # Send back results
            response = {
                "detections": detections,
                "recommendations": recommendations
            }
            await websocket.send_text(json.dumps(response))
            
    except WebSocketDisconnect:
        print("WebSocket client disconnected")
    except Exception as e:
        print(f"WebSocket error: {e}")
        await websocket.close(code=1011, reason=str(e))
