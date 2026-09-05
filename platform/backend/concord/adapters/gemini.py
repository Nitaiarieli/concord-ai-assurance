"""Optional explanation adapter; never part of an authorization decision."""
import os

class GeminiExplainer:
    def __init__(self, model: str | None = None):
        self.model = model or os.environ.get('CONCORD_GEMINI_MODEL')
        if not self.model:
            raise ValueError('Choose an available Gemini model in CONCORD_GEMINI_MODEL')

    def explain(self, proof: dict) -> str:
        # Only minimized counts are sent. No content, identities, tokens, locators, or trace inputs.
        if not os.environ.get('GOOGLE_API_KEY'):
            raise ValueError('Set a server-side GOOGLE_API_KEY')
        from langchain_google_genai import ChatGoogleGenerativeAI
        model = ChatGoogleGenerativeAI(model=self.model, temperature=0)
        facts = {'result':proof['result'], 'checks':len(proof['checks']),
                 'passed':sum(bool(c['passed']) for c in proof['checks']),
                 'affected_count':len(proof['affected']), 'scope':proof['scope']}
        response = model.invoke('Explain these measured test facts in two short sentences. Do not infer live security or compliance. '+str(facts))
        return str(response.content)
