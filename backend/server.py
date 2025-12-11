from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, File, UploadFile, Form
from fastapi.responses import JSONResponse, FileResponse
from contextlib import asynccontextmanager
import uvicorn
import json
import os
import uuid
import base64
import io
from PIL import Image
import numpy as np
from datetime import datetime
import time
import traceback
from dotenv import load_dotenv
from vectorfaces import FaceAnalyzer, VectorSearch
from chain import FaceAnalysisHandler, VectorSearchHandler, ResponseBuilder

load_dotenv("env.local")

face_analyzer = FaceAnalyzer()
vector_search = VectorSearch()

# Track initialization status
face_analyzer_initialized = False

# Create uploads directory
UPLOADS_DIR = "/home/vectorfaces/uploads"
os.makedirs(UPLOADS_DIR, exist_ok=True)

def initialize_services():
    global face_analyzer_initialized
    
    print("Starting FastAPI server with WebSocket support...")
    print("Initializing FaceAnalyzer...")
    if face_analyzer.initialize():
        print("✅ FaceAnalyzer initialized successfully")
        face_analyzer_initialized = True
    else:
        print("❌ FaceAnalyzer initialization failed")
        face_analyzer_initialized = False
    
    print("Connecting to Elasticsearch...")
    if vector_search.connect():
        if vector_search.check_index_exists():
            print("✅ Elasticsearch connected and index exists")
        else:
            print("⚠️ Elasticsearch connected but index does not exist")
    else:
        print("⚠️ Elasticsearch connection failed - continuing without vector search")

@asynccontextmanager
async def lifespan(app: FastAPI):
    initialize_services()
    yield
    print("Shutting down services...")

app = FastAPI(lifespan=lifespan)

active_connections = []

# ============================================================================
# REST API Endpoints
# ============================================================================

@app.get("/api/health")
async def health_check():
    """API health check endpoint"""
    return {"status": "healthy", "service": "vectorfaces-backend"}

@app.get("/api/stats")
async def get_stats():
    """Get server and index statistics"""
    server_status = "running" if face_analyzer_initialized else "initializing"
    
    stats = {
        "server": {
            "status": server_status,
            "active_connections": len(active_connections),
            "timestamp": datetime.now().isoformat(),
            "face_analyzer_initialized": face_analyzer_initialized
        }
    }
    
    if vector_search.is_connected:
        stats["elasticsearch"] = vector_search.get_index_stats()
    else:
        stats["elasticsearch"] = {"status": "disconnected"}
    
    return stats

@app.post("/api/analyze")
async def analyze_frame(request: dict):
    """Analyze a single frame/image via REST API (face analysis only, no vector search)"""
    try:
        image_data = request.get('image')
        timestamp = request.get('timestamp')
        
        if not image_data:
            raise HTTPException(status_code=400, detail="No image data provided")
        
        context = {
            'image_data': image_data,
            'timestamp': timestamp
        }
        
        processor = FaceAnalysisHandler(face_analyzer)
        
        context = await processor.handle(context)
        
        response = ResponseBuilder.build_response(context)
        
        return JSONResponse(content=response)
        
    except Exception as e:
        print(f"Error in analyze endpoint: {e}")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

@app.post("/api/upload")
async def upload_image(
    image: UploadFile = File(...),
    timestamp: str = Form(...)
):
    """Upload image endpoint for face detection and analysis (no indexing)"""
    try:
        if not image.content_type.startswith('image/'):
            raise HTTPException(status_code=400, detail="File must be an image")
        
        image_data = await image.read()
        
        image_base64 = base64.b64encode(image_data).decode('utf-8')
        image_base64_with_header = f"data:image/jpeg;base64,{image_base64}"
        
        print(f"Processing uploaded image: {image.filename}")
        
        context = {
            'image_data': image_base64_with_header,
            'timestamp': timestamp
        }
        
        processor = FaceAnalysisHandler(face_analyzer)
        
        context = await processor.handle(context)
        
        response = ResponseBuilder.build_response(context)
        
        return JSONResponse(content=response)
        
    except Exception as e:
        print(f"Error in upload endpoint: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.post("/api/index")
async def index_base64_image(request: dict):
    """Index face embeddings from base64 image to Elasticsearch"""
    try:
        image_base64 = request.get('image')
        timestamp = request.get('timestamp', datetime.now().isoformat())
        name = request.get('name')
        
        if not image_base64:
            raise HTTPException(status_code=400, detail="No image data provided")
        
        if not image_base64.startswith('data:image'):
            image_base64 = f"data:image/jpeg;base64,{image_base64}"
        
        print(f"Indexing image{f' for {name}' if name else ''}")
        
        face_analysis_start = time.time()
        analysis_result = face_analyzer.analyze_from_base64(image_base64)
        face_analysis_time_ms = (time.time() - face_analysis_start) * 1000
        
        timing_stats = {
            "face_analysis_ms": round(face_analysis_time_ms, 2)
        }
        
        if not analysis_result or not analysis_result.get('success'):
            return JSONResponse(content={
                "success": False,
                "error": analysis_result.get('error', 'Face analysis failed'),
                "faces": [],
                "timing_stats": timing_stats
            })
        
        faces = analysis_result.get('faces', [])
        indexed_faces = []
        
        image_base64_clean = image_base64.split(',')[1] if ',' in image_base64 else image_base64
        image_bytes = base64.b64decode(image_base64_clean)
        
        for i, face in enumerate(faces):
            try:
                bbox = face.get('bbox', [])
                confidence = face.get('confidence', 0.0)
                embedding = face.get('embedding')
                gender = face.get('gender')
                age = face.get('age')
                
                if not embedding:
                    print(f"No embedding found for face {i+1}, skipping")
                    continue
                
                face_uuid = str(uuid.uuid4())
                image_filename = f"{face_uuid}.jpg"
                image_path = os.path.join(UPLOADS_DIR, image_filename)

                with open(image_path, 'wb') as f:
                    f.write(image_bytes)
                print(f"Saved image to {image_path}")
                
                gender_str = "M" if gender == 1 else "F" if gender == 0 else "U"
                
                metadata = {
                    "gender": gender_str,
                    "image_path": f"/uploads/{image_filename}",
                    "age": int(age) if age is not None else None,
                    "confidence": float(confidence),
                    "bbox": [float(b) for b in bbox] if bbox else [],
                    "uploaded_at": timestamp
                }
                
                if name:
                    metadata["name"] = name
                
                index_result = vector_search.index_face(
                    embedding=embedding,
                    index_name=vector_search.index_name,
                    metadata=metadata,
                    face_id=face_uuid,
                    document_id=face_uuid
                )
                
                if index_result.get('success'):
                    print(f"Successfully indexed face {face_uuid}{f' for {name}' if name else ''}")
                    face_info = {
                        "id": face_uuid,
                        "bbox": bbox,
                        "confidence": confidence,
                        "gender": gender_str,
                        "age": age,
                        "image_path": image_path,
                        "elasticsearch_result": index_result
                    }
                    if name:
                        face_info["name"] = name
                    indexed_faces.append(face_info)
                else:
                    print(f"Failed to index face {face_uuid}: {index_result.get('error')}")
                    
            except Exception as e:
                print(f"Error indexing face {i}: {e}")
                continue
        
        timing_stats["total_faces"] = len(faces)
        timing_stats["successfully_indexed"] = len(indexed_faces)
        
        return JSONResponse(content={
            "success": True,
            "message": f"Successfully indexed {len(indexed_faces)} face(s)",
            "faces": indexed_faces,
            "total_faces": len(faces),
            "timestamp": timestamp,
            "timing_stats": timing_stats
        })
        
    except Exception as e:
        print(f"Error in index endpoint: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

# ============================================================================
# WebSocket Endpoints
# ============================================================================

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for receiving webcam frames"""
    await websocket.accept()
    active_connections.append(websocket)
    
    print(f"WebSocket connection established. Total connections: {len(active_connections)}")

    # Set up the processing chain
    processor = FaceAnalysisHandler(face_analyzer)
    processor.set_next(VectorSearchHandler(vector_search))
    
    try:
        while True:
            print("Waiting for data...")
            data = await websocket.receive_text()
            
            try:
                message = json.loads(data)
                
                if message.get('type') == 'frame':
                    timestamp = message.get('timestamp')
                    image_data = message.get('image')
                    settings = message.get('settings')
                    
                    context = {
                        'image_data': image_data,
                        'timestamp': timestamp,
                        'settings': settings
                    }
                    
                    context = await processor.handle(context)
                    
                    response = ResponseBuilder.build_response(context)
                    
                    await websocket.send_text(json.dumps(response))

            except json.JSONDecodeError:
                print("Received invalid JSON data")
                
    except WebSocketDisconnect:
        print("WebSocket disconnected")
    except Exception as e:
        print(f"[WebSocket] chain error: {e}")
        traceback.print_exc()
        

    finally:
        if websocket in active_connections:
            active_connections.remove(websocket)
        print(f"WebSocket connection closed. Total connections: {len(active_connections)}")


if __name__ == "__main__":
    initialize_services()
    print("Open http://localhost:8000 in your browser to access the webcam stream")
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="debug")