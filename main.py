from starlette.applications import Starlette
from starlette.requests import Request
from starlette.responses import FileResponse, HTMLResponse
from starlette.routing import Route
from starlette.routing import Mount
from starlette.staticfiles import StaticFiles
from starlette.middleware import Middleware
from starlette.middleware.base import BaseHTTPMiddleware
from helpers import read_config
import api.chat
import api.config
import api.gifts
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


def get_app_name(request: Request):
    path_segments = request.url.path.strip("/").split("/")
    return path_segments[-1] if path_segments else None


async def serve_static(request: Request):
    # Extract the requested path
    path = request.path_params.get("path", "")
    request
    file_path = pathlib.Path("static") / path

    # Check if the file exists
    if file_path.is_file():
        return FileResponse(file_path)

    appname = get_app_name(request)
    if read_config(f"./prompts/{appname}.toml"):
        with open("static/index.html", "r") as file:
            html_content = file.read()
            page = html_content.replace(
                '<meta property="og:url" content="https://adventai.dev/app/">',
                f'<meta property="og:url" content="https://adventai.dev/app/{appname}">',
            )
            page = page.replace(
                '<meta property="og:image" content="https://adventai.dev/og/adventai.png">',
                f'<meta property="og:image" content="https://adventai.dev/og/{appname}.png">',
            )
            return HTMLResponse(page)

    # Default to serving the index.html
    return FileResponse("static/index.html", status_code=404)


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
        Route("/api/gifts", api.gifts.get, methods=["GET"]),
        Route("/app/{path:path}", serve_static),
        Mount(
            "/",
            StaticFiles(directory="adventai", html=True),
            name="adventai",
        ),
    ],
)
