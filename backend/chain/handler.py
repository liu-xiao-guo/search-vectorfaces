from abc import ABC, abstractmethod
from typing import Optional, Dict, Any

class FrameHandler(ABC):
    def __init__(self):
        self._next_handler: Optional['FrameHandler'] = None
    
    def set_next(self, handler: 'FrameHandler') -> 'FrameHandler':
        self._next_handler = handler
        return handler
    
    @abstractmethod
    async def handle(self, context: Dict[str, Any]) -> Dict[str, Any]:
        pass
    
    async def _pass_to_next(self, context: Dict[str, Any]) -> Dict[str, Any]:
        if self._next_handler:
            return await self._next_handler.handle(context)
        return context
