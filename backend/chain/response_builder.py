from typing import Dict, Any
from datetime import datetime

class ResponseBuilder:
    @staticmethod
    def build_response(context: Dict[str, Any]) -> Dict[str, Any]:

        print(f"stats: {context['timing_stats']}")

        response = {
            'type': context.get('response_type', 'analysis'),
            'timestamp': datetime.now().isoformat(),
            'timing_stats': context.get('timing_stats', {})
        }
        
        if context.get('response_type') == 'error':
            response['error'] = context.get('error')
        elif context.get('response_type') == 'not_found':
            pass
        else:
            response['face_analysis'] = context.get('face_analysis_result')
            matching_faces = context.get('matching_faces', [])
            if matching_faces:
                response['matching_faces'] = matching_faces
        
        return response
