"""Read-only BookStack API boundary. Local ACL overrides are not effective ACLs."""
from .http_client import JsonTransport

class BookStackConnector:
    def __init__(self, base_url: str, token_id: str, token_secret: str, transport=None):
        if not token_id or not token_secret:
            raise ValueError('BookStack service credentials are required')
        self.transport = transport or JsonTransport(base_url, {'Authorization':f'Token {token_id}:{token_secret}'})

    def read_object(self, native_id: str) -> dict:
        if not str(native_id).isdigit():
            raise ValueError('BookStack page ID must be numeric')
        page = self.transport.request('GET', f'/api/pages/{native_id}')
        overrides = self.transport.request('GET', f'/api/content-permissions/page/{native_id}')
        return {'native_id':str(page['id']), 'title':page['name'], 'revision':page.get('updated_at'),
                'html':page.get('html',''), 'local_permission_overrides':overrides,
                'effective_authorization':'unknown', 'verified_identity':None,
                'reason':'Token-owner visibility and local overrides do not establish another identity’s effective permissions.'}

    def probe_identity(self, native_id: str, identity: str) -> dict:
        return {'identity':identity, 'native_id':native_id, 'outcome':'unknown',
                'reason':'Requires an actual credential/delegation for the named identity; service-token substitution is prohibited.'}
