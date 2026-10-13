import os
import sys
import urllib.parse

# Ensure the project root directory is in sys.path for module resolution
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from backend.app import create_app


class VercelSubpathMiddleware:
    """
    Extracts the subpath query parameter and reconstructs the original API PATH_INFO.
    """
    def __init__(self, wsgi_app):
        self.wsgi_app = wsgi_app

    def __call__(self, environ, start_response):
        query_string = environ.get("QUERY_STRING", "")
        if "subpath=" in query_string:
            params = urllib.parse.parse_qs(query_string, keep_blank_values=True)
            if "subpath" in params:
                subpath = params.pop("subpath")[0].lstrip("/")
                environ["PATH_INFO"] = f"/api/{subpath}"
                environ["QUERY_STRING"] = urllib.parse.urlencode(params, doseq=True)

        return self.wsgi_app(environ, start_response)


# Vercel serverless function entrypoint
app = create_app()
app.wsgi_app = VercelSubpathMiddleware(app.wsgi_app)
