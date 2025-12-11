"""
Vector Search Module for vectorfaces
Handles Elasticsearch operations for face embedding similarity search
"""

from elasticsearch import Elasticsearch
from typing import List, Dict, Optional, Any
import json
import os
import uuid
from datetime import datetime
import logging
from dotenv import load_dotenv


class VectorSearch:
    """Vector search class for face embeddings using Elasticsearch (search-only)"""
    
    def __init__(self, 
                 hosts: List[str] = None, 
                 index_name: str = None,
                 api_key: str = None,
                 embedding_dim: int = 512,
                 env_file: str = None):
        """
        Initialize the VectorSearch client
        
        Args:
            hosts: List of Elasticsearch host URLs (default: from ES_HOST env var)
            index_name: Name of the Elasticsearch index (default: from ES_INDEX env var)
            api_key: Elasticsearch API key (default: from ES_API_KEY env var)
            embedding_dim: Dimension of face embeddings (default: 512 for InsightFace)
            env_file: Path to environment file (default: env.local)
        """
        # Load environment variables
        env_file = env_file or "env.local"
        if os.path.exists(env_file):
            load_dotenv(env_file)
        else:
            load_dotenv()  # Load from .env if env.local doesn't exist
        
        # Set configuration from environment variables or parameters
        self.hosts = hosts or [os.getenv('ES_HOST', 'http://localhost:9200')]
        self.index_name = index_name or os.getenv('ES_INDEX', 'vectorfaces')
        self.api_key = api_key or os.getenv('ES_API_KEY')
        self.embedding_dim = embedding_dim
        self.client = None
        self.is_connected = False
        self.index_stats = {}
        
        # Setup logging
        self.logger = logging.getLogger(__name__)
        
        # Log configuration (without sensitive data)
        self.logger.info(f"VectorSearch configured with:")
        self.logger.info(f"  Host: {self.hosts[0]}")
        self.logger.info(f"  Index: {self.index_name}")
        self.logger.info(f"  API Key: {'***' if self.api_key else 'Not provided'}")
        
        # Auto-connect and create index during initialization
        if self.connect():
            self.create_uploads_index_if_not_exists()
            self.index_stats = self.collect_index_stats()
    
    def connect(self) -> bool:
        """
        Connect to Elasticsearch
        
        Returns:
            bool: True if connection successful, False otherwise
        """
        try:
            # Configure connection parameters
            connection_params = {
                "hosts": self.hosts,
                "timeout": 30,
                "max_retries": 3,
                "retry_on_timeout": True
            }
            
            # Add API key authentication if provided
            if self.api_key:
                connection_params["api_key"] = self.api_key
                self.logger.info("Using API key authentication")
            else:
                self.logger.info("No API key provided, using default authentication")
            
            self.client = Elasticsearch(**connection_params)
            
            # Test connection
            if self.client.ping():
                self.is_connected = True
                self.logger.info("Connected to Elasticsearch successfully")
                
                # Log cluster info (optional)
                try:
                    info = self.client.info()
                    self.logger.info(f"Elasticsearch version: {info.get('version', {}).get('number', 'Unknown')}")
                except Exception as e:
                    self.logger.warning(f"Could not retrieve cluster info: {e}")
                
                return True
            else:
                self.logger.error("Failed to ping Elasticsearch")
                return False
                
        except Exception as e:
            self.logger.error(f"Error connecting to Elasticsearch: {e}")
            self.client = None
            self.is_connected = False
            return False
    
    def search_similar_faces(self, 
                           query_embedding: List[float],
                           top_k: int = 10,
                           num_candidates: int = 100,
                           filters: Dict = None,
                           must_not: Dict = None,
                           exclude_indices: List[str] = None) -> List[Dict]:
        
        if not self.is_connected:
            self.logger.error("Not connected to Elasticsearch")
            return [], {"took": 0, "timed_out": False, "total_hits": 0, "max_score": None, "error": "Not connected to Elasticsearch"}
        
        if len(query_embedding) != self.embedding_dim:
            self.logger.error(f"Query embedding dimension mismatch: expected {self.embedding_dim}, got {len(query_embedding)}")
            return [], {"took": 0, "timed_out": False, "total_hits": 0, "max_score": None, "error": f"Embedding dimension mismatch: expected {self.embedding_dim}, got {len(query_embedding)}"}
        
        try:
            # Build KNN query
            body = {
                "size": top_k,
                "collapse": {
                    "field": "id"
                },
                "query": {
                    "bool": {
                        "must": [
                            {
                                "knn": {
                                    "field": "face_embeddings",
                                    "k": top_k,
                                    "num_candidates": num_candidates,
                                    "query_vector": query_embedding
                                }
                            }
                            
                        ],
                        "must_not": [],
                        "filter": []
                    }
                }
            }
            
            # Add filters if provided
            if filters:
                body["query"]["bool"]["filter"] = []
                for field, value in filters.items():
                    body["query"]["bool"]["filter"].append({
                        "term": {f"metadata.{field}": value}
                    })
            
            # Add must_not conditions if provided
            if must_not:
                body["query"]["bool"]["must_not"] = []
                for field, value in must_not.items():
                    body["query"]["bool"]["must_not"].append({
                        "term": {f"metadata.{field}": value}
                    })

            if exclude_indices:
                clause = {
                    "terms": {
                        "_index": exclude_indices
                    }
                }
                body["query"]["bool"]["must_not"].append(clause)

            # Execute search
            response = self.client.search(
                index=self.index_name,
                body=body
            )
            
            results = []
            for hit in response['hits']['hits']:
                result = {
                    "index": hit['_index'],
                    "face_id": hit['_source'].get('face_id'),
                    "score": hit['_score'],
                    "metadata": hit['_source'].get('metadata', {}),
                    "timestamp": hit['_source'].get('timestamp'),
                    "document": hit['_source']  # Full document for additional data
                }
                results.append(result)
            
            # Extract timing information from Elasticsearch response
            search_timing = {
                "took": response.get('took', 0),  # Time in milliseconds
                "timed_out": response.get('timed_out', False),
                "total_hits": response['hits']['total']['value'] if isinstance(response['hits']['total'], dict) else response['hits']['total'],
                "max_score": response['hits'].get('max_score')
            }
            
            self.logger.info(f"Found {len(results)} similar faces using KNN search (took: {search_timing['took']}ms)")
            return results, search_timing
            
        except Exception as e:
            self.logger.error(f"Error searching similar faces: {e}")
            return [], {"took": 0, "timed_out": False, "total_hits": 0, "max_score": None, "error": str(e)}
    
    def check_index_exists(self) -> bool:
        """
        Check if the index exists
        
        Returns:
            bool: True if index exists, False otherwise
        """
        if not self.is_connected:
            return False
        
        try:
            return self.client.indices.exists(index=self.index_name)
        except Exception as e:
            self.logger.error(f"Error checking index existence: {e}")
            return False
    
    def get_face_count(self) -> int:
        """
        Get total number of faces in the index
        
        Returns:
            int: Number of faces stored
        """
        if not self.is_connected:
            return 0
        
        try:
            response = self.client.count(index=self.index_name)
            return response['count']
        except Exception as e:
            self.logger.error(f"Error getting face count: {e}")
            return 0
    
    def get_index_stats(self) -> Dict:
        """
        Get index statistics
        
        Returns:
            dict: Index statistics
        """
        return self.index_stats

    def collect_index_stats(self) -> Dict[str, Dict]:
        """
        Collect statistics for all indices specified in ES_INDICES environment variable
        
        Returns:
            dict: Dictionary with index names as keys and their stats as values
        """
        if not self.is_connected:
            self.logger.error("Not connected to Elasticsearch")
            return {}
        
        self.logger.info("Collecting index stats...")
        # Get indices from environment variable
        indices_str = os.getenv('ES_INDICES', '')
        if not indices_str:
            self.logger.warning("ES_INDICES environment variable not set")
            return {}
        
        # Parse comma-separated indices
        indices = [idx.strip() for idx in indices_str.split(',') if idx.strip()]
        if not indices:
            self.logger.warning("No indices found in ES_INDICES")
            return {}
        
        stats_dict = {}
        
        for index_name in indices:
            try:
                # Check if index exists
                if not self.client.indices.exists(index=index_name):
                    self.logger.warning(f"Index '{index_name}' does not exist")
                    stats_dict[index_name] = {"error": "Index does not exist"}
                    continue
                
                # Query stats with filter_path
                response = self.client.indices.stats(
                    index=index_name,
                    filter_path="_all.primaries.docs,_all.primaries.dense_vector"
                )
                
                stats_dict[index_name] = response
                
                # Log summary
                if '_all' in response and 'primaries' in response['_all']:
                    primaries = response['_all']['primaries']
                    doc_count = primaries.get('docs', {}).get('count', 0)
                    vector_count = primaries.get('dense_vector', {}).get('value_count', 0)
                    self.logger.info(f"Index '{index_name}': {doc_count} docs, {vector_count} vectors")
                
            except Exception as e:
                self.logger.error(f"Error collecting stats for index '{index_name}': {e}")
                stats_dict[index_name] = {"error": str(e)}
        
        return stats_dict

    def create_uploads_index_if_not_exists(self) -> bool:
        """
        Create the uploads index if it does not exist
        
        Returns:
            bool: True if index created or already exists, False otherwise
        """
        if not self.is_connected:
            self.logger.error("Not connected to Elasticsearch")
            return False
        
        mapping = {
            "aliases": {
                "faces": {}
            },
            "mappings": {
                "dynamic_templates": [
                {
                    "default_keywords": {
                    "match_mapping_type": "string",
                        "mapping": {
                            "type": "keyword"
                        }
                    }
                }
                ],
                "properties": {
                    "face_embeddings": {
                        "type": "dense_vector",
                        "dims": 512,
                        "index": True,
                        "index_options": {
                            "type": "bbq_hnsw"
                        }
                    }
                }
            },
            "settings": {
                "number_of_shards": 1,
                "number_of_replicas": 1,
                "index": {
                    "refresh_interval": "1s"
                }
            }
        }
        try:
            if not self.client.indices.exists(index=os.getenv('ES_UPLOADS_INDEX')):
                self.client.indices.create(index=os.getenv('ES_UPLOADS_INDEX'), body=mapping)
                self.logger.info(f"Created index: {os.getenv('ES_UPLOADS_INDEX')} ")
            else:
                self.logger.info(f"Index already exists: {os.getenv('ES_UPLOADS_INDEX')}")
            return True
        except Exception as e:
            self.logger.error(f"Error creating uploads index: {e}")
            return False

    def index_face(self,
                   embedding: List[float],
                   index_name: str,
                   metadata: Dict[str, Any] = None,
                   face_id: str = None,
                   document_id: str = None) -> Dict[str, Any]:
        """
        Index a face embedding into Elasticsearch
        
        Args:
            embedding: Face embedding vector (must match embedding_dim)
            index_name: Target index name
            metadata: Optional metadata (e.g., name, source, age, gender)
            face_id: Optional unique face identifier (auto-generated if not provided)
            document_id: Optional Elasticsearch document ID (auto-generated if not provided)
        
        Returns:
            dict: Indexing result with success status, document_id, and timing info
        """
        if not self.is_connected:
            self.logger.error("Not connected to Elasticsearch")
            return {
                "success": False,
                "error": "Not connected to Elasticsearch"
            }
        
        if len(embedding) != self.embedding_dim:
            error_msg = f"Embedding dimension mismatch: expected {self.embedding_dim}, got {len(embedding)}"
            self.logger.error(error_msg)
            return {
                "success": False,
                "error": error_msg
            }
        
        try:
            face_id = face_id or str(uuid.uuid4())
            document_id = document_id or str(uuid.uuid4())
            
            document = {
                "id": face_id,
                "face_embeddings": embedding,
                "metadata": metadata or {},
                "timestamp": datetime.now().isoformat(),
                "indexed_at": datetime.now().isoformat()
            }
            
            response = self.client.index(
                index=os.getenv('ES_UPLOADS_INDEX'),
                id=document_id,
                document=document
            )
            
            result = {
                "success": True,
                "document_id": response['_id'],
                "id": face_id,
                "index": response['_index'],
                "result": response['result'],
                "version": response.get('_version')
            }
            
            self.logger.info(f"Successfully indexed face {face_id} into {index_name} (doc_id: {document_id})")
            return result
            
        except Exception as e:
            self.logger.error(f"Error indexing face: {e}")
            return {
                "success": False,
                "error": str(e),
                "face_id": face_id if 'face_id' in locals() else None
            }