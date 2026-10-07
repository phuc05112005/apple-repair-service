#!/usr/bin/env python3
"""Run the internal experimental inference API."""

import uvicorn

if __name__ == "__main__":
    uvicorn.run("runtime_api.app:app", host="127.0.0.1", port=8001, reload=False)
