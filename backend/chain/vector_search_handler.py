from typing import Dict, Any
from .handler import FrameHandler
from vectorfaces import VectorSearch
import os


class VectorSearchHandler(FrameHandler):
    def __init__(self, search_service: VectorSearch):
        super().__init__()
        self.search_service = search_service
    
    async def handle(self, context: Dict[str, Any]) -> Dict[str, Any]:
        if not self.search_service.is_connected:
            print("Vector search not connected, skipping similarity search")
            context['timing_stats']['elasticsearch_total_ms'] = 0
            context['timing_stats']['total_processing_ms'] = round(
                context['timing_stats']['face_analysis_ms'], 2
            )
            context['matching_faces'] = []
            context['response_type'] = 'analysis'
            return await self._pass_to_next(context)
        
        face_analysis_result = context.get('face_analysis_result', {})
        settings = context.get('settings', {})
        matching_faces = []
        
        for i, face in enumerate(face_analysis_result.get('faces', [])):
            if face.get('embedding'):
                gender_filter = "M" if face.get('gender') == 1 else "F"

                must_not_indices = []

                # add indices that are "selected":False in must_not_indices
                if settings.get('indices'):
                    for i in settings['indices']:
                        if not i.get('selected', False):
                            must_not_indices.append(i['name'])

 

                k = int(settings.get('k'))
                num_candidates = int(settings.get('num_candidates', 200))

                #trim k and num_candidates for sanitization
                k = max(5, min(100, k))
                num_candidates = max(50, min(1000, num_candidates))
                        
                similar_faces, search_timing = self.search_service.search_similar_faces(
                    face['embedding'],
                    top_k=k,
                    num_candidates=num_candidates,
                    filters={"gender": gender_filter},
                    exclude_indices=must_not_indices
                )
                
                if similar_faces:
                    
                    for match in similar_faces:
                        matching_faces.append({
                            'metadata': match.get('metadata'),
                            'score': match['score'],
                            'index': match.get('index')
                        })
                        print(f"  - [{match.get('index')}] {match['score']:.3f} - {match.get('metadata')} ")
        
        context['timing_stats']['elasticsearch_total_hits'] = search_timing.get('total_hits', 0)
        context['timing_stats']['elasticsearch_total_ms'] = search_timing.get('took', 0)
        context['timing_stats']['total_processing_ms'] = round(
            context['timing_stats']['face_analysis_ms'] + search_timing.get('took', 0), 2
        )
        context['matching_faces'] = matching_faces
        context['response_type'] = 'analysis'
        
        return await self._pass_to_next(context)
