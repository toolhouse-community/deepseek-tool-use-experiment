import requests
import os
from helpers import read_config
from llms import generate_stream


def get_users():
    try:
        toolhouse_api_key = os.environ.get("TOOLHOUSE_API_KEY")
        response = requests.get(
            "https://api.toolhouse.ai/v1/users",
            headers={"Authorization": f"Bearer {toolhouse_api_key}"},
        )
        if not response.ok:
            raise ValueError(f"API error {response.status_code}: {response.text}")
        return response.json().get("data", [])
    except Exception as e:
        return []


async def main():
    # Get users (each adventai user will be formatted as appname-email)
    print("Running daily actions")
    configurations = {}
    users = get_users()
    for user in users:
        # Extract appname
        appname = user.split("-")[0]
        if appname == user:
            continue

        # Get configuration from prompts. If no prompt, fail silently.
        if not (config := configurations.get(appname)):
            if not (config := read_config(f"./prompts/{appname}.toml")):
                continue

            configurations[appname] = config

        print(f"Found user for {config.get("main").get("title")}: {user.split("-")[1]}")
        # Run prompt for that user
        async for chunk in generate_stream(
            messages=[
                {
                    "role": "user",
                    "content": config.get("prompts", {})
                    .get("recurring_action", {})
                    .get("text"),
                }
            ],
            model=config.get("main").get("model") or os.environ.get("MODEL"),
            bundle=config.get("main").get("recurring_action_bundle", "default"),
            email=user,
        ):
            print(chunk, end="")

        print("\n")


if __name__ == "__main__":
    import asyncio

    asyncio.run(main())
