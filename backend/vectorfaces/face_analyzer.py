"""
Face Analysis Module for vectorfaces
Handles face detection, analysis, and embedding generation using InsightFace
"""

import cv2
import numpy as np
from insightface.app import FaceAnalysis
from PIL import Image
import io
import base64
from typing import Dict, List, Optional, Union


class FaceAnalyzer:
    """Face analysis class using InsightFace"""
    
    def __init__(self, providers: List[str] = None, det_size: tuple = (640, 640)):
        """
        Initialize the FaceAnalyzer
        
        Args:
            providers: List of execution providers (default: ['CPUExecutionProvider'])
            det_size: Detection size for face analysis
        """
        self.face_app = None
        self.providers = providers or ['CPUExecutionProvider']
        self.det_size = det_size
        self.is_initialized = False
    
    def initialize(self) -> bool:
        """
        Initialize the FaceAnalysis model
        
        Returns:
            bool: True if initialization successful, False otherwise
        """
        try:
            self.face_app = FaceAnalysis(providers=self.providers)
            self.face_app.prepare(ctx_id=0, det_size=self.det_size)
            self.is_initialized = True
            print("FaceAnalyzer initialized successfully")
            return True
        except Exception as e:
            print(f"Error initializing FaceAnalyzer: {e}")
            self.face_app = None
            self.is_initialized = False
            return False
    
    def analyze_from_base64(self, image_base64: str) -> Dict:
        """
        Analyze faces in a base64 encoded image
        
        Args:
            image_base64: Base64 encoded image (with or without data URL prefix)
        
        Returns:
            dict: Analysis results containing face information
        """
        if not self.is_initialized or self.face_app is None:
            return {"error": "FaceAnalyzer not initialized"}
        
        try:
            # Remove data URL prefix if present
            if image_base64.startswith('data:image'):
                image_base64 = image_base64.split(',')[1]
            
            # Decode base64 to bytes
            image_bytes = base64.b64decode(image_base64)
            
            # Convert to PIL Image
            pil_image = Image.open(io.BytesIO(image_bytes))
            
            # Convert PIL to OpenCV format (BGR)
            opencv_image = cv2.cvtColor(np.array(pil_image), cv2.COLOR_RGB2BGR)
            
            return self.analyze_from_opencv(opencv_image)
            
        except Exception as e:
            return {"error": f"Base64 image analysis failed: {str(e)}"}
    
    def analyze_from_opencv(self, opencv_image: np.ndarray) -> Dict:
        """
        Analyze faces in an OpenCV image
        
        Args:
            opencv_image: OpenCV image in BGR format
        
        Returns:
            dict: Analysis results containing face information
        """
        if not self.is_initialized or self.face_app is None:
            return {"error": "FaceAnalyzer not initialized"}
        
        try:
            # Analyze faces
            faces = self.face_app.get(opencv_image)
            
            # Extract face information
            face_results = []
            for face in faces:
                face_info = {
                    "bbox": face.bbox.tolist(),  # Bounding box [x1, y1, x2, y2]
                    "confidence": float(face.det_score),  # Detection confidence
                    "age": int(face.age) if hasattr(face, 'age') else None,
                    "gender": int(face.gender) if hasattr(face, 'gender') else None,  # 0: female, 1: male
                    "embedding": face.embedding.tolist() if hasattr(face, 'embedding') else None,
                    "landmark": face.landmark_2d_106.tolist() if hasattr(face, 'landmark_2d_106') else None
                }
                face_results.append(face_info)
            
            return {
                "success": True,
                "face_count": len(faces),
                "faces": face_results,
                "image_shape": opencv_image.shape
            }
            
        except Exception as e:
            return {"error": f"OpenCV image analysis failed: {str(e)}"}
    
    def extract_face_embedding(self, image_base64: str, face_index: int = 0) -> Optional[List[float]]:
        """
        Extract face embedding for a specific face
        
        Args:
            image_base64: Base64 encoded image
            face_index: Index of the face to extract embedding for (default: 0)
        
        Returns:
            List of floats representing the face embedding, or None if failed
        """
        result = self.analyze_from_base64(image_base64)
        
        if result.get("success") and result.get("faces"):
            faces = result["faces"]
            if 0 <= face_index < len(faces):
                return faces[face_index].get("embedding")
        
        return None
    
    def get_face_info(self, image_base64: str) -> Dict:
        """
        Get simplified face information (count, ages, genders)
        
        Args:
            image_base64: Base64 encoded image
        
        Returns:
            dict: Simplified face information
        """
        result = self.analyze_from_base64(image_base64)
        
        if not result.get("success"):
            return result
        
        faces = result.get("faces", [])
        face_info = {
            "face_count": len(faces),
            "ages": [face.get("age") for face in faces if face.get("age") is not None],
            "genders": [face.get("gender") for face in faces if face.get("gender") is not None],
            "confidences": [face.get("confidence") for face in faces]
        }
        
        return {"success": True, "info": face_info}