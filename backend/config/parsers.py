from rest_framework.parsers import JSONParser


class PlainTextJSONParser(JSONParser):
    """Parse JSON bodies even when clients send text/plain."""

    media_type = "text/plain"