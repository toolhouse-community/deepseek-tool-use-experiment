import requests
import os


def stream_url_response(url, app_name):
    """
    Stream the response from a given URL until the entire content is received.

    :param url: The URL to make the streaming request to
    """
    try:
        # Send a GET request with stream=True to enable streaming
        config = {
            "url": url,
            "name": app_name,
        }

        with requests.post(url, stream=True, json=config, verify=False) as response:
            response.raise_for_status()

            for chunk in response.iter_content(chunk_size=128):
                if chunk:
                    print(chunk.decode("utf-8"), end="")

        print("\nStreaming complete.")

    except requests.RequestException as e:
        print(f"An error occurred while streaming the response: {e}")


# Example usage
def get_url():
    if os.environ.get("RENDER_EXTERNAL_URL"):
        return os.environ.get("RENDER_EXTERNAL_URL") + "/api/cron"
    else:
        raise Exception("Unknown environment.")


if __name__ == "__main__":
    url = get_url()
    app_name = "mealplanner"
    stream_url_response(url, app_name)
