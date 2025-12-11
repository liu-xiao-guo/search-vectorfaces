import time
from typing import Dict, Any
from .handler import FrameHandler
from vectorfaces import FaceAnalyzer

class FaceAnalysisHandler(FrameHandler):
    def __init__(self, analyzer: FaceAnalyzer):
        super().__init__()
        self.analyzer = analyzer
    
    async def handle(self, context: Dict[str, Any]) -> Dict[str, Any]:
        image_data = context.get('image_data')
        timestamp = context.get('timestamp')
        
        print(f"Received frame at {timestamp}")
        
        face_analysis_start = time.time()
        face_analysis_result = self.analyzer.analyze_from_base64(image_data)
        face_analysis_time_ms = (time.time() - face_analysis_start) * 1000
        
        context['timing_stats'] = {
            'face_analysis_ms': round(face_analysis_time_ms, 2)
        }
        
        if face_analysis_result.get('success'):
            face_count = face_analysis_result.get('face_count', 0)
            print(f"Found {face_count} face(s) in frame")
            
            for i, face in enumerate(face_analysis_result.get('faces', [])):
                print(f"Face {i+1}: confidence={face['confidence']:.3f}, "
                      f"age={face.get('age', 'N/A')}, "
                      f"gender={'Male' if face.get('gender') == 1 else 'Female' if face.get('gender') == 0 else 'N/A'}")
            
            context['face_analysis_result'] = face_analysis_result
            context['face_count'] = face_count
            
            if face_count == 0:
                context['response_type'] = 'not_found'
                return context
            
            return await self._pass_to_next(context)
        else:
            print(f"Face analysis error: {face_analysis_result.get('error')}")
            context['error'] = face_analysis_result.get('error')
            context['response_type'] = 'error'
            return context
