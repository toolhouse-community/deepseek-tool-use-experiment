from starlette.applications import Starlette
from starlette.responses import FileResponse, JSONResponse
from starlette.routing import Route
from starlette.routing import Mount
from starlette.staticfiles import StaticFiles
from starlette.middleware import Middleware
from starlette.middleware.base import BaseHTTPMiddleware
import api.chat
import api.config
import api.cron
import dotenv
import os
import pathlib

dotenv.load_dotenv()


class DisableCacheMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
        return response


async def serve_index(request):
    return FileResponse("static/index.html")


async def serve_static(request):
    path = request.path_params.get("path")
    file_path = pathlib.Path("static") / path

    if file_path.exists():
        return FileResponse(file_path)
    else:
        return FileResponse("static/index.html")


# Determine middleware and debug based on environment
middleware = (
    [Middleware(DisableCacheMiddleware)]
    if os.environ.get("ENVIRONMENT") == "development"
    else []
)
debug = os.environ.get("ENVIRONMENT") == "development"

app = Starlette(
    debug=debug,
    middleware=middleware,
    routes=[
        Route("/api/chat", api.chat.post, methods=["POST"]),
        Route("/api/config", api.config.get, methods=["GET"]),
        Route("/api/cron", api.cron.post, methods=["POST"]),
        Route("/app/{path:path}", serve_static),
        Mount(
            "/",
            StaticFiles(directory="adventai", html=True),
            name="adventai",
        ),
    ],
)
