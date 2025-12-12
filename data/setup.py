#!/usr/bin/env python3
import sys
import json
from pathlib import Path
from elasticsearch import Elasticsearch


def load_all_index_definitions(data_dir: Path) -> dict:
    """Load all index definitions from JSON files in directory."""
    definitions = {}
    
    for json_file in data_dir.glob("*.json"):
        index_name = json_file.stem
        with open(json_file, 'r') as f:
            definitions[index_name] = json.load(f)
    
    return definitions


def create_index(es: Elasticsearch, index_name: str, definition: dict):
    """Create index with the provided definition."""
    if es.indices.exists(index=index_name):
        print(f"Index '{index_name}' already exists. Deleting...")
        es.indices.delete(index=index_name)
    
    print(f"Creating index '{index_name}'...")
    es.indices.create(
        index=index_name,
        mappings=definition.get('mappings'),
        settings=definition.get('settings'),
        aliases=definition.get('aliases')
    )
    print(f"Index '{index_name}' created successfully.")


if __name__ == "__main__":
    es_url = "http://localhost:9200"
    es_apikey = None
    
    i = 1
    while i < len(sys.argv):
        if sys.argv[i] == '--es_url' and i + 1 < len(sys.argv):
            es_url = sys.argv[i + 1]
            i += 2
        elif sys.argv[i] == '--es_apikey' and i + 1 < len(sys.argv):
            es_apikey = sys.argv[i + 1]
            i += 2
        else:
            i += 1
    
    print(f"Connecting to Elasticsearch at {es_url}...")
    
    es_kwargs = {'hosts': [es_url]}
    if es_apikey:
        es_kwargs['api_key'] = es_apikey
    
    es = Elasticsearch(**es_kwargs)
    
    if not es.ping():
        raise ConnectionError("Could not connect to Elasticsearch")
    
    print("Connected to Elasticsearch successfully.")
    
    script_dir = Path(__file__).parent
    definitions = load_all_index_definitions(script_dir)
    
    if not definitions:
        print("No JSON files found in current directory.")
        sys.exit(1)
    
    print(f"Found {len(definitions)} index definition(s): {', '.join(definitions.keys())}")
    
    for index_name, definition in definitions.items():
        create_index(es, index_name, definition)
    
    print(f"\nAll {len(definitions)} index(es) are ready for indexing.")
