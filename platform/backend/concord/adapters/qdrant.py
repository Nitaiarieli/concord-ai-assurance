"""Untested live Qdrant transport boundary, not a production authorization layer."""
from urllib.parse import quote
import json
from uuid import uuid5, NAMESPACE_URL
from .http_client import JsonTransport

class QdrantAdapter:
    def __init__(self, base_url: str, collection: str, tenant: str, api_key: str = '', transport=None):
        if not collection or not tenant:
            raise ValueError('Explicit collection and tenant are required')
        self.collection = quote(collection, safe='')
        self.tenant = tenant
        self.transport = transport or JsonTransport(base_url, {'api-key':api_key} if api_key else {})

    def point_id(self, artifact_id: str) -> str:
        return str(uuid5(NAMESPACE_URL, json.dumps([self.tenant, artifact_id], separators=(',', ':'))))

    def upsert(self, artifact_id: str, vector: list[float], payload: dict) -> dict:
        if not vector:
            raise ValueError('A real embedding vector is required')
        record = {**payload, 'tenant_id':self.tenant, 'artifact_id':artifact_id}
        return self.transport.request('PUT', f'/collections/{self.collection}/points?wait=true',
                                      {'points':[{'id':self.point_id(artifact_id),'vector':vector,'payload':record}]})

    def read(self, artifact_id: str) -> dict | None:
        response = self.transport.request('POST', f'/collections/{self.collection}/points',
            {'ids':[self.point_id(artifact_id)], 'with_payload':True, 'with_vector':False})
        records = response.get('result',[])
        if not records:
            return None
        payload = records[0].get('payload',{})
        if payload.get('tenant_id') != self.tenant or payload.get('artifact_id') != artifact_id:
            raise ValueError('Destination scope mismatch')
        return payload

    def delete(self, artifact_id: str) -> dict:
        return self.transport.request('POST', f'/collections/{self.collection}/points/delete?wait=true',
                                      {'points':[self.point_id(artifact_id)]})

    def query(self, vector: list[float], allowed_artifact_ids: list[str], limit: int = 5) -> dict:
        # Allowed IDs must be computed from trusted current source authorization by the caller.
        if not allowed_artifact_ids:
            return {'result':{'points':[]}}
        if not 1 <= limit <= 100:
            raise ValueError('Limit out of range')
        return self.transport.request('POST', f'/collections/{self.collection}/points/query',
            {'query':vector, 'limit':limit, 'with_payload':True,
             'filter':{'must':[{'key':'tenant_id','match':{'value':self.tenant}},
                               {'key':'artifact_id','match':{'any':allowed_artifact_ids}}]}})
