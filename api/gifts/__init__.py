from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.status import HTTP_404_NOT_FOUND
from helpers import read_config
from datetime import datetime


apps = [
    "mealplanner",
    "x-digest",
    "news-digest",
    "random-pet-fact",
    "career-coach",
]


async def get(request: Request):
    try:
        current_date = datetime.now().date()
        start_date = datetime(2024, 12, 14).date()
        days_difference = (current_date - start_date).days

        if days_difference < 0:
            return JSONResponse([])

        num_elements = min(days_difference + 1, len(apps))
        current_apps = apps[:num_elements]
        out = []
        for app in current_apps:
            config = read_config(f"./prompts/{app}.toml")
            out.append({"app_name": app, "title": config.get("main", {}).get("title")})

        return JSONResponse(out)
    except Exception as e:
        print(e)
        return JSONResponse({}, status_code=HTTP_404_NOT_FOUND)
