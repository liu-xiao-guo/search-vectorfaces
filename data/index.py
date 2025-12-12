#!/usr/bin/env python3
import sys
import json
from pathlib import Path
from elasticsearch import Elasticsearch, helpers


def load_ndjson_data(ndjson_file: Path):
    """Generator to load data from NDJSON file."""
    if not ndjson_file.exists():
        raise FileNotFoundError(f"Data file not found: {ndjson_file}")
    
    with open(ndjson_file, 'r') as f:
        for line in f:
            line = line.strip()
            if line:
                yield json.loads(line)


def bulk_index_data(es: Elasticsearch, index_name: str, ndjson_file: Path, batch_size: int = 1000):
    """Bulk index data from NDJSON file."""
    def generate_actions():
        for doc in load_ndjson_data(ndjson_file):
            yield {
                '_index': index_name,
                '_id': doc.get('id'),
                '_source': doc
            }
    
    print(f"Indexing data from {ndjson_file}...")
    success_count = 0
    error_count = 0
    
    for ok, result in helpers.streaming_bulk(
        es,
        generate_actions(),
        chunk_size=batch_size,
        raise_on_error=False,
        max_retries=3
    ):
        if ok:
            success_count += 1
        else:
            error_count += 1
            print(f"Error indexing document: {result}")
        
        if (success_count + error_count) % batch_size == 0:
            print(f"Indexed {success_count} documents, {error_count} errors...")
    
    print(f"Indexing complete. Success: {success_count}, Errors: {error_count}")
    return success_count, error_count


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python index.py <index_name> [--ndjson-file <file>] [--batch-size <size>] [--es_url <url>] [--es_apikey <key>]")
        sys.exit(1)
    
    index_name = sys.argv[1]
    ndjson_file = 'vectorfaces.ndjson'
    batch_size = 1000
    es_url = "http://localhost:9200"
    es_apikey = None
    
    i = 2
    while i < len(sys.argv):
        if sys.argv[i] == '--ndjson-file' and i + 1 < len(sys.argv):
            ndjson_file = sys.argv[i + 1]
            i += 2
        elif sys.argv[i] == '--batch-size' and i + 1 < len(sys.argv):
            batch_size = int(sys.argv[i + 1])
            i += 2
        elif sys.argv[i] == '--es_url' and i + 1 < len(sys.argv):
            es_url = sys.argv[i + 1]
            i += 2
        elif sys.argv[i] == '--es_apikey' and i + 1 < len(sys.argv):
            es_apikey = sys.argv[i + 1]
            i += 2
        else:
            i += 1
    
    script_dir = Path(__file__).parent
    ndjson_file_path = (script_dir / ndjson_file).resolve()
    
    print(f"Connecting to Elasticsearch at {es_url}...")
    
    es_kwargs = {'hosts': [es_url]}
    if es_apikey:
        es_kwargs['api_key'] = es_apikey
    
    es = Elasticsearch(**es_kwargs)
    
    if not es.ping():
        raise ConnectionError("Could not connect to Elasticsearch")
    
    print("Connected to Elasticsearch successfully.")
    
    bulk_index_data(es, index_name, ndjson_file_path, batch_size)
    
    es.indices.refresh(index=index_name)
    count = es.count(index=index_name)['count']
    print(f"Index '{index_name}' now contains {count} documents.")

